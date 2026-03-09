import { MockedResponse, MockedProvider } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, ReactNode, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  GetSubmissionResp,
  LIST_POTENTIAL_COLLABORATORS,
  ListPotentialCollaboratorsInput,
  ListPotentialCollaboratorsResp,
  UPDATE_SUBMISSION_INFO,
  UpdateSubmissionInfoInput,
  UpdateSubmissionInfoResp,
} from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import SubmissionUpdate from "./index";

const mockListAvailableModelVersions = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  listAvailableModelVersions: async (...args) => mockListAvailableModelVersions(...args),
}));

const mockDC = "MOCK-DC";

const MockParent: FC<{
  mocks?: MockedResponse[];
  user?: Partial<User>;
  submission?: Partial<Submission>;
  updateQuery?: SubmissionCtxState["updateQuery"];
  children: ReactNode;
}> = ({ mocks, submission, user, updateQuery = vi.fn(), children }) => {
  const authCtxState = useMemo<AuthCtxState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ _id: "current-user", ...user }),
      }),
    [user]
  );

  const submissionContextState = useMemo<SubmissionCtxState>(
    () => ({
      data: {
        getSubmission: submissionFactory.build({
          submitterID: "current-user",
          dataCommons: mockDC,
          ...submission,
        }),
        submissionStats: null,
        getSubmissionAttributes: null,
      },
      updateQuery,
      status: SubmissionCtxStatus.LOADED,
      error: null,
    }),
    [submission, updateQuery]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthContext.Provider value={authCtxState}>
        <SubmissionContext.Provider value={submissionContextState}>
          {children}
        </SubmissionContext.Provider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

beforeEach(() => {
  mockListAvailableModelVersions.mockReset();
  sessionStorage.clear();
});

describe("Accessibility", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have no violations for the button", async () => {
    const { container, getByTestId } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ status: "New" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("update-submission-button")).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for the button (disabled)", async () => {
    const { container, getByTestId } = render(<SubmissionUpdate icon={<span />} disabled />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ status: "New" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("update-submission-button")).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() =>
      render(<SubmissionUpdate icon={<span />} />, {
        wrapper: ({ children }) => (
          <MockParent submission={null} user={null}>
            {children}
          </MockParent>
        ),
      })
    ).not.toThrow();
  });

  it("should show a snackbar when the change operation fails (GraphQL Error)", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mock: MockedResponse<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput> = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };

    const { getByTestId } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock]}
          submission={{ status: "New", modelVersion: "1.0.0" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("update-submission-button"));

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Simulated GraphQL error", {
        variant: "error",
      });
    });
  });

  it("should show a snackbar when the change operation fails (Network Error)", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mock: MockedResponse<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput> = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };

    const { getByTestId } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock]}
          submission={{ status: "New", modelVersion: "1.0.0" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("update-submission-button"));

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Simulated network error", {
        variant: "error",
      });
    });
  });

  it("should show a snackbar when the change operation fails (API Error)", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mock: MockedResponse<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput> = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      result: {
        data: {
          updateSubmissionInfo: null,
        },
      },
    };

    const { getByTestId } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock]}
          submission={{ status: "New", modelVersion: "1.0.0" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("update-submission-button"));

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unknown API error", {
        variant: "error",
      });
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not be rendered when the user is missing the required permission", () => {
    render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ status: "New" }}
          user={{
            role: "Data Commons Personnel",
            permissions: [],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(() => within(document.body).getByTestId("update-submission-button")).toThrow();
  });

  it("should not be rendered when the user is not assigned to the same data commons", () => {
    render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          submission={{ dataCommons: "a different dc", status: "New" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: ["A fake data commons that is not definitely not MOCK-DC"],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(() => within(document.body).getByTestId("update-submission-button")).toThrow();
  });

  it("should update the local cache state when the model version is changed", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mockUpdateQuery = vi.fn();

    const mock: MockedResponse<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput> = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      result: {
        data: {
          updateSubmissionInfo: {
            _id: "mock-uuid",
            modelVersion: "API RESPONSE VERSION",
            submitterID: "mock-user-id",
            submitterName: "Mock User",
          },
        },
      },
    };

    const { getByTestId } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock]}
          updateQuery={mockUpdateQuery}
          submission={{ status: "New", modelVersion: "1.0.0" }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("update-submission-button"));

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(mockUpdateQuery).toHaveBeenCalledTimes(1);
    });
  });

  it("should reset validation results only if the model version is changed", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const prevState: GetSubmissionResp = {
      getSubmission: submissionFactory.build({
        submitterID: "current-user",
        submitterName: "Current User",
        dataCommons: mockDC,
        status: "New",
        modelVersion: "1.0.0",
        metadataValidationStatus: "Passed",
        fileValidationStatus: "Passed",
      }),
      submissionStats: {
        stats: [
          { nodeName: "node1", error: 10, passed: 10, warning: 10, new: 0, total: 30 },
          { nodeName: "node2", error: 0, passed: 0, warning: 0, new: 10, total: 10 },
          { nodeName: "node3", error: 0, passed: 0, warning: 0, new: 0, total: 0 },
        ],
      },
      getSubmissionAttributes: {
        submissionAttributes: submissionAttributesFactory
          .pick(["hasOrphanError", "isBatchUploading"])
          .build({
            hasOrphanError: false,
            isBatchUploading: false,
          }),
      },
    };

    let updateQueryResult: GetSubmissionResp | undefined;
    const mockUpdateQuery = vi.fn(
      (updateCallback: (prev: GetSubmissionResp) => GetSubmissionResp) => {
        updateQueryResult = updateCallback(prevState);
      }
    );

    const mock: MockedResponse<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput> = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      result: {
        data: {
          updateSubmissionInfo: {
            _id: "mock-uuid",
            modelVersion: "2.0.0",
            submitterID: prevState.getSubmission.submitterID,
            submitterName: prevState.getSubmission.submitterName,
          },
        },
      },
    };

    const { getByTestId, getByText } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mock]}
          updateQuery={mockUpdateQuery}
          submission={{ ...prevState.getSubmission }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(updateQueryResult).toBeUndefined();

    userEvent.click(getByTestId("update-submission-button")); // Open Dialog

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    userEvent.click(within(getByTestId("update-submission-version-field")).getByRole("button"));

    await waitFor(() => {
      expect(getByText("v2.0.0")).toBeVisible();
    });

    userEvent.click(getByText("v2.0.0")); // Select new version

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(mockUpdateQuery).toHaveBeenCalledTimes(1);
    });

    expect(updateQueryResult).toBeDefined();
    expect(updateQueryResult.getSubmission.metadataValidationStatus).toBe("New");
    expect(updateQueryResult.getSubmission.fileValidationStatus).toBe("New");
    expect(updateQueryResult.getSubmission.modelVersion).toBe("2.0.0");
    expect(updateQueryResult.submissionStats.stats).toEqual([
      { nodeName: "node1", error: 0, passed: 0, warning: 0, new: 30, total: 30 },
      { nodeName: "node2", error: 0, passed: 0, warning: 0, new: 10, total: 10 },
      { nodeName: "node3", error: 0, passed: 0, warning: 0, new: 0, total: 0 },
    ]);
  });

  it("should change the submitter only if it changed", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0"]);

    const prevState: GetSubmissionResp = {
      getSubmission: submissionFactory.build({
        _id: "a mock uuid",
        submitterID: "submitter-uuid-1",
        submitterName: "Submitter User 1",
        dataCommons: mockDC,
        modelVersion: "1.0.0",
        status: "New",
      }),
      submissionStats: {
        stats: [],
      },
      getSubmissionAttributes: null,
    };

    let updateQueryResult: GetSubmissionResp | undefined;
    const mockUpdateQuery = vi.fn(
      (updateCallback: (prev: GetSubmissionResp) => GetSubmissionResp) => {
        updateQueryResult = updateCallback(prevState);
      }
    );

    const mockCollaboratorsMatcher = vi.fn().mockImplementation(() => true);
    const mockListCollaborators: MockedResponse<
      ListPotentialCollaboratorsResp,
      ListPotentialCollaboratorsInput
    > = {
      request: {
        query: LIST_POTENTIAL_COLLABORATORS,
      },
      variableMatcher: mockCollaboratorsMatcher,
      result: {
        data: {
          listPotentialCollaborators: userFactory
            .pick(["_id", "firstName", "lastName"])
            .build(2, (idx) => ({
              _id: `user-${idx + 1}`,
              firstName: `First ${idx + 1}`,
              lastName: `Last ${idx + 1}`,
            }))
            .withTypename("User"),
        },
      },
      maxUsageCount: Infinity,
    };

    const mockUpdateSubmission: MockedResponse<
      UpdateSubmissionInfoResp,
      UpdateSubmissionInfoInput
    > = {
      request: {
        query: UPDATE_SUBMISSION_INFO,
      },
      variableMatcher: () => true,
      result: {
        data: {
          updateSubmissionInfo: {
            _id: "mock-uuid",
            modelVersion: "1.0.0",
            submitterID: "user-1",
            submitterName: "First 1 Last 1",
          },
        },
      },
    };

    const { getByTestId, getByText } = render(<SubmissionUpdate icon={<span />} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockListCollaborators, mockUpdateSubmission]}
          updateQuery={mockUpdateQuery}
          submission={{ ...prevState.getSubmission }}
          user={{
            role: "Data Commons Personnel",
            permissions: ["data_submission:review"],
            dataCommons: [mockDC],
            dataCommonsDisplayNames: [mockDC],
          }}
        >
          {children}
        </MockParent>
      ),
    });

    expect(updateQueryResult).toBeUndefined();

    userEvent.click(getByTestId("update-submission-button")); // Open Dialog

    await waitFor(() => {
      expect(getByTestId("update-submission-dialog")).toBeVisible();
    });

    await waitFor(() => {
      expect(mockCollaboratorsMatcher).toHaveBeenCalled();
    });

    userEvent.click(within(getByTestId("update-submission-submitter-field")).getByRole("button"));

    await waitFor(() => {
      expect(getByText(/First 1 Last 1/i)).toBeVisible();
    });

    userEvent.click(getByText(/First 1 Last 1/i)); // Select a different user

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(mockUpdateQuery).toHaveBeenCalledTimes(1);
    });

    expect(updateQueryResult).toBeDefined();
    expect(updateQueryResult.getSubmission.submitterID).toBe("user-1");
    expect(updateQueryResult.getSubmission.submitterName).toBe("First 1 Last 1");
  });
});
