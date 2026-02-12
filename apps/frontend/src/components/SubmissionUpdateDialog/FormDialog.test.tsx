import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, ReactNode, useMemo } from "react";
import { axe } from "vitest-axe";

import {
  SubmissionCtxState,
  SubmissionCtxStatus,
  SubmissionContext,
} from "@/components/Contexts/SubmissionContext";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput,
  LIST_POTENTIAL_COLLABORATORS,
} from "@/graphql";
import { render, waitFor, within } from "@/test-utils";
import { Logger } from "@/utils";

import FormDialog from "./FormDialog";

const mockListAvailableModelVersions = vi.fn();
vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  listAvailableModelVersions: async (...args) => mockListAvailableModelVersions(...args),
}));

vi.mock("@/utils/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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
        .build(5, (idx) => ({
          _id: `user-${idx + 1}`,
          firstName: `First ${idx + 1}`,
          lastName: `Last ${idx + 1}`,
        }))
        .withTypename("User"),
    },
  },
  maxUsageCount: Infinity,
};

const MockParent: FC<{
  mocks?: MockedResponse[];
  submission?: Partial<Submission>;
  children: ReactNode;
}> = ({ mocks, submission, children }) => {
  const submissionContextState = useMemo<SubmissionCtxState>(
    () => ({
      data: {
        getSubmission: submissionFactory.build({
          ...submission,
        }),
        submissionStats: null,
        getSubmissionAttributes: null,
      },
      status: SubmissionCtxStatus.LOADED,
      error: null,
    }),
    [submission]
  );

  return (
    <MockedProvider mocks={mocks}>
      <SubmissionContext.Provider value={submissionContextState}>
        {children}
      </SubmissionContext.Provider>
    </MockedProvider>
  );
};

beforeEach(() => {
  mockListAvailableModelVersions.mockReset();
  mockCollaboratorsMatcher.mockClear();
  sessionStorage.clear();
});

describe("Accessibility", () => {
  // NOTE: This is disabled due to nonstop act warnings
  it.skip("should have no violations", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const { container } = render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockListCollaborators]}
          submission={{
            _id: "mock-submission-id",
            submitterName: "mock-name",
            submitterID: "mock-id",
            modelVersion: "1.0.0",
            dataCommons: "mock-data-commons",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockCollaboratorsMatcher).toHaveBeenCalledTimes(1);
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should close the dialog when the 'Cancel' button is clicked", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mockOnClose = vi.fn();

    const { getByTestId } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={mockOnClose} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("update-submission-dialog-cancel-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mockOnClose = vi.fn();

    const { getByTestId } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={mockOnClose} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("update-submission-dialog-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const mockOnClose = vi.fn();

    const { getByTestId } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={mockOnClose} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("update-submission-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should fetch available model versions when the dialog opens", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    expect(mockListAvailableModelVersions).not.toHaveBeenCalled();

    const { rerender } = render(
      <FormDialog open={false} onSubmitForm={vi.fn()} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    expect(mockListAvailableModelVersions).not.toHaveBeenCalled();

    rerender(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    expect(mockListAvailableModelVersions).toHaveBeenCalledWith("MOCK-DC-TEST");
  });

  it("should call the onSubmitForm function with the selected options", async () => {
    const mockOnSubmitForm = vi.fn().mockResolvedValueOnce(undefined);
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "2.0.0"]);

    const { getByTestId } = render(
      <FormDialog open onSubmitForm={mockOnSubmitForm} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
              modelVersion: "1.0.0",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockCollaboratorsMatcher).toHaveBeenCalledTimes(1);
    });

    userEvent.click(getByTestId("update-submission-dialog-submit-button"));

    await waitFor(() => {
      expect(mockOnSubmitForm).toHaveBeenCalledTimes(1);
    });

    // Unchanged from the defaults
    expect(mockOnSubmitForm).toHaveBeenCalledWith({
      submitterID: "mock-id",
      version: "1.0.0",
    });
  });

  it("should gracefully handle API Errors (GraphQL)", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => []);

    const mockCollabError: MockedResponse<
      ListPotentialCollaboratorsResp,
      ListPotentialCollaboratorsInput
    > = {
      request: {
        query: LIST_POTENTIAL_COLLABORATORS,
      },
      variableMatcher: mockCollaboratorsMatcher,
      result: {
        errors: [new GraphQLError("mock error message")],
      },
    };

    render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockCollabError]}
          submission={{
            _id: "mock-submission-id",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "Error fetching submitter options",
        expect.any(Object)
      );
    });
  });

  it("should gracefully handle API Errors (Network)", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => []);

    const mockCollabError: MockedResponse<
      ListPotentialCollaboratorsResp,
      ListPotentialCollaboratorsInput
    > = {
      request: {
        query: LIST_POTENTIAL_COLLABORATORS,
      },
      variableMatcher: mockCollaboratorsMatcher,
      error: new Error("Network error"),
    };

    render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockCollabError]}
          submission={{
            _id: "mock-submission-id",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "Error fetching submitter options",
        expect.any(Object)
      );
    });
  });
});

describe("Implementation Requirements", () => {
  it("should pre-select the current model version", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["3.1.0", "1.0.0", "2.0.0"]);

    const { getByTestId } = render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockListCollaborators]}
          submission={{
            _id: "mock-submission-id",
            submitterName: "mock-name",
            submitterID: "mock-id",
            dataCommons: "MOCK-DC-TEST",
            modelVersion: "1.0.0",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("update-submission-version-field")).toHaveTextContent("1.0.0");
  });

  it("should pre-select the current data submission owner", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "1.2.0"]);

    const { getByTestId } = render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockListCollaborators]}
          submission={{
            _id: "mock-submission-id",
            submitterName: "mock-name",
            submitterID: "mock-id",
            dataCommons: "MOCK-DC-TEST",
            modelVersion: "1.0.0",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(mockCollaboratorsMatcher).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("update-submission-submitter-field")).toHaveTextContent("mock-name");
  });

  it("should populate with all available submitter options", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => ["1.0.0", "1.2.0"]);

    const { getByTestId, getAllByText, getByText } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
              modelVersion: "1.0.0",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    await waitFor(() => {
      expect(mockCollaboratorsMatcher).toHaveBeenCalledTimes(1);
    });

    userEvent.click(within(getByTestId("update-submission-submitter-field")).getByRole("button"));

    expect(getAllByText("mock-name")).toHaveLength(2); // Input field and dropdown

    await waitFor(() => {
      expect(getByText(/First 1 Last 1/i)).toBeInTheDocument();
    });

    expect(getByText(/First 2 Last 2/i)).toBeInTheDocument();
    expect(getByText(/First 3 Last 3/i)).toBeInTheDocument();
    expect(getByText(/First 4 Last 4/i)).toBeInTheDocument();
    expect(getByText(/First 5 Last 5/i)).toBeInTheDocument();
  });

  it("should populate with all available model versions", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => [
      "model-version-ABC",
      "model-version-123",
      "model-version-XXZ",
      "1.2.0",
    ]);

    const { getByTestId, getByText, getAllByText } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
              modelVersion: "model-version-ABC",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    userEvent.click(within(getByTestId("update-submission-version-field")).getByRole("button"));

    expect(getAllByText(/vMODEL-VERSION-ABC/i)).toHaveLength(2); // Input field and dropdown
    expect(getByText(/vMODEL-VERSION-123/i)).toBeInTheDocument();
    expect(getByText(/vMODEL-VERSION-XXZ/i)).toBeInTheDocument();
    expect(getByText(/v1.2.0/i)).toBeInTheDocument();
  });

  it("should prefix the model version with 'v' if not already present", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => [
      "3.9.0-WO-VERSION",
      "v3.5.9",
      "6.1.1",
      "v9.1.9",
    ]);

    const { getByTestId, getByText, getAllByText } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
              modelVersion: "6.1.1",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    userEvent.click(within(getByTestId("update-submission-version-field")).getByRole("button"));

    expect(getAllByText("v6.1.1")).toHaveLength(2); // Input field and dropdown
    expect(getByText("v3.9.0-WO-VERSION")).toBeInTheDocument();
    expect(getByText("v3.5.9")).toBeInTheDocument();
    expect(getByText("v9.1.9")).toBeInTheDocument();
  });

  it("should still populate with the current model version if no versions are available", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => []);

    const { getByTestId } = render(<FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent
          mocks={[mockListCollaborators]}
          submission={{
            _id: "mock-submission-id",
            submitterName: "mock-name",
            submitterID: "mock-id",
            dataCommons: "MOCK-DC-TEST",
            modelVersion: "update-submission-1.2.3",
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId("update-submission-version-field")).toHaveTextContent(
      "vupdate-submission-1.2.3"
    );
  });

  it("should have the correct title, tooltips, and button text", async () => {
    mockListAvailableModelVersions.mockImplementationOnce(() => []);

    const { getByTestId, findByRole } = render(
      <FormDialog open onSubmitForm={vi.fn()} onClose={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <MockParent
            mocks={[mockListCollaborators]}
            submission={{
              _id: "mock-submission-id",
              submitterName: "mock-name",
              submitterID: "mock-id",
              dataCommons: "MOCK-DC-TEST",
              modelVersion: "model-version-ABC",
            }}
          >
            {children}
          </MockParent>
        ),
      }
    );

    await waitFor(() => {
      expect(mockListAvailableModelVersions).toHaveBeenCalledTimes(1);
    });

    // Dialog content
    expect(getByTestId("update-submission-dialog-header")).toHaveTextContent(
      "Update Data Submission"
    );
    expect(getByTestId("update-submission-dialog-submit-button")).toHaveTextContent("Save");
    expect(getByTestId("update-submission-dialog-cancel-button")).toHaveTextContent("Cancel");

    // Submitter tooltip
    userEvent.click(getByTestId("submitter-input-tooltip"));
    expect(await findByRole("tooltip")).toHaveTextContent(
      "Transfers data submission ownership; previous Submitter may lose access."
    );

    userEvent.click(getByTestId("submitter-input-tooltip"));

    // Version tooltip
    userEvent.click(getByTestId("version-input-tooltip"));
    expect(await findByRole("tooltip")).toHaveTextContent(
      "Changing the model version for an in-progress submission will reset all validation results. The submitter must re-run validation to align with the new model version."
    );

    userEvent.click(getByTestId("version-input-tooltip"));
  });
});
