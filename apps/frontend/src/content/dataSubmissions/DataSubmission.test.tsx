import { ApolloError } from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { fireEvent } from "@testing-library/react";
import { GraphQLError } from "graphql";
import { useMemo } from "react";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthStatus,
} from "@/components/Contexts/AuthContext";
import {
  Context as SearchParamsContext,
  LastSearchParams,
} from "@/components/Contexts/SearchParamsContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "@/components/Contexts/SubmissionContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { SUBMISSION_ACTION, SubmissionActionInput, SubmissionActionResp } from "@/graphql";
import { render, TestRouter, waitFor } from "@/test-utils";
import * as utils from "@/utils";

import DataSubmission from "./DataSubmission";

const mockNavigate = vi.fn();
const mockGetSubmission = vi.fn();
const mockRefresh = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../components/DataSubmissions/DataSubmissionSummary", () => ({
  __esModule: true,
  default: () => <div data-testid="submission-summary" />,
}));

vi.mock("../../components/DataSubmissions/DataUpload", () => ({
  __esModule: true,
  DataUpload: () => <div data-testid="data-upload" />,
}));

vi.mock("../../components/DataSubmissions/LinkTab", () => ({
  __esModule: true,
  default: ({ value, selected }: { value: string; selected: boolean }) => (
    <button data-testid={`link-tab-${value}`} data-selected={selected} type="button">
      tab
    </button>
  ),
}));

vi.mock("../../components/DataSubmissions/MetadataUpload", () => ({
  __esModule: true,
  default: ({ onCreateBatch, onUpload, readOnly }) => (
    <div>
      <button
        data-testid="metadata-upload-create-batch"
        onClick={() => onCreateBatch?.()}
        type="button"
      >
        create batch
      </button>
      <button
        data-testid="metadata-upload-upload"
        onClick={() => onUpload?.("Upload complete", "success")}
        type="button"
      >
        upload
      </button>
      <div data-testid="metadata-upload-readonly">{String(readOnly)}</div>
    </div>
  ),
}));

vi.mock("../../components/DataSubmissions/ValidationControls", () => ({
  __esModule: true,
  default: () => <div data-testid="validation-controls" />,
}));

vi.mock("../../components/DataSubmissions/ValidationStatistics", () => ({
  __esModule: true,
  default: () => <div data-testid="validation-statistics" />,
}));

vi.mock("./CrossValidation", () => ({
  __esModule: true,
  default: () => <div data-testid="cross-validation" />,
}));

vi.mock("./DataActivity", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: ReactModule.forwardRef((_props, ref) => {
      ReactModule.useImperativeHandle(ref, () => ({
        tableRef: {
          refresh: mockRefresh,
        },
      }));
      return <div data-testid="data-activity" />;
    }),
  };
});

vi.mock("./DataSubmissionActions", () => ({
  __esModule: true,
  default: ({ onAction }) => (
    <button
      data-testid="trigger-submission-action"
      onClick={() => onAction?.("Submit", "review comment")}
      type="button"
    >
      trigger action
    </button>
  ),
}));

vi.mock("./QualityControl", () => ({
  __esModule: true,
  default: () => <div data-testid="quality-control" />,
}));

vi.mock("./SubmittedData", () => ({
  __esModule: true,
  default: () => <div data-testid="submitted-data" />,
}));

type MockParentProps = {
  mocks?: MockedResponse[];
  authCtx?: Partial<AuthContextState>;
  submissionCtx?: Partial<SubmissionCtxState>;
  lastSearchParams?: LastSearchParams;
  children: React.ReactNode;
};

const MockParent = ({
  mocks = [],
  authCtx = {},
  submissionCtx = {},
  lastSearchParams = { "/data-submissions": "?page=2" },
  children,
}: MockParentProps) => {
  const authCtxValue: AuthContextState = authCtxStateFactory.build({
    status: AuthStatus.LOADED,
    isLoggedIn: true,
    user: userFactory.build({
      _id: "current-user",
      role: "Submitter",
      permissions: ["data_submission:view", "data_submission:create"],
    }),
    ...authCtx,
  });

  const searchParamsCtxValue = useMemo(
    () => ({
      lastSearchParams,
      searchParams: new URLSearchParams(),
      setSearchParams: vi.fn(),
    }),
    [lastSearchParams]
  );

  const submissionCtxValue: SubmissionCtxState = submissionCtxStateFactory.build({
    status: SubmissionCtxStatus.LOADED,
    data: {
      getSubmission: submissionFactory.build({
        _id: "sub-1",
        status: "In Progress",
        crossSubmissionStatus: null,
        dataCommonsDisplayName: "CDS",
      }),
      submissionStats: null,
      getSubmissionAttributes: null,
    },
    error: null,
    refetch: mockGetSubmission,
    ...submissionCtx,
  });

  return (
    <TestRouter>
      <MockedProvider mocks={mocks} addTypename={false}>
        <AuthContext.Provider value={authCtxValue}>
          <SearchParamsContext.Provider value={searchParamsCtxValue}>
            <SubmissionContext.Provider value={submissionCtxValue}>
              {children}
            </SubmissionContext.Provider>
          </SearchParamsContext.Provider>
        </AuthContext.Provider>
      </MockedProvider>
    </TestRouter>
  );
};

describe("DataSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubmission.mockResolvedValue({ data: {} });
  });

  it("should navigate back to list page when submissionId is invalid", async () => {
    render(<DataSubmission submissionId="" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/data-submissions?page=2", {
        state: { error: "Oops! An invalid Data Submission ID was provided." },
      });
    });
  });

  it("should navigate back to list page when submission context returns an error", async () => {
    render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => (
        <MockParent
          submissionCtx={{
            error: new ApolloError({ errorMessage: "context error" }),
          }}
        >
          {children}
        </MockParent>
      ),
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/data-submissions?page=2", {
        state: { error: "Oops! An error occurred while retrieving that Data Submission." },
      });
    });
  });

  it("should redirect to Upload Activity when an invalid tab is provided", async () => {
    render(<DataSubmission submissionId="sub-1" tab="invalid-tab" />, {
      wrapper: ({ children }) => <MockParent>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/data-submission/sub-1/upload-activity", {
        replace: true,
      });
    });
  });

  it("should execute submission action and refetch submission on success", async () => {
    const submissionActionMock: MockedResponse<SubmissionActionResp, SubmissionActionInput> = {
      request: {
        query: SUBMISSION_ACTION,
        variables: {
          submissionID: "sub-1",
          action: "Submit",
          comment: "review comment",
        },
      },
      result: {
        data: {
          submissionAction: {
            _id: "action-1",
          },
        },
      },
    };

    const { getByTestId } = render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent mocks={[submissionActionMock]}>{children}</MockParent>,
    });

    fireEvent.click(getByTestId("trigger-submission-action"));

    await waitFor(() => {
      expect(mockGetSubmission).toHaveBeenCalledTimes(1);
    });
  });

  it("should log and show an error snackbar when mutation returns no submission action id", async () => {
    const loggerSpy = vi.spyOn(utils.Logger, "error");
    const submissionActionMock: MockedResponse<SubmissionActionResp, SubmissionActionInput> = {
      request: {
        query: SUBMISSION_ACTION,
        variables: {
          submissionID: "sub-1",
          action: "Submit",
          comment: "review comment",
        },
      },
      result: {
        data: {
          submissionAction: null,
        },
      },
    };

    const { getByTestId } = render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent mocks={[submissionActionMock]}>{children}</MockParent>,
    });

    fireEvent.click(getByTestId("trigger-submission-action"));

    await waitFor(() => {
      expect(loggerSpy).toHaveBeenCalledWith("Submission Action Error", undefined);
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Error occurred while performing 'Submit' submission action.",
        { variant: "error" }
      );
    });
  });

  it("should show an error snackbar when mutation returns GraphQL/network errors", async () => {
    const submissionActionMock: MockedResponse<SubmissionActionResp, SubmissionActionInput> = {
      request: {
        query: SUBMISSION_ACTION,
        variables: {
          submissionID: "sub-1",
          action: "Submit",
          comment: "review comment",
        },
      },
      result: {
        errors: [new GraphQLError("Network failure")],
      },
    };

    const { getByTestId } = render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent mocks={[submissionActionMock]}>{children}</MockParent>,
    });

    fireEvent.click(getByTestId("trigger-submission-action"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(expect.stringContaining("Network failure"), {
        variant: "error",
      });
    });
  });

  it("should show upload message and trigger refresh + refetch on metadata upload", async () => {
    const { getByTestId } = render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent>{children}</MockParent>,
    });

    fireEvent.click(getByTestId("metadata-upload-upload"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Upload complete", { variant: "success" });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockGetSubmission).toHaveBeenCalledTimes(1);
    });
  });

  it("should refresh batch table when metadata upload requests create-batch", async () => {
    const { getByTestId } = render(<DataSubmission submissionId="sub-1" tab="upload-activity" />, {
      wrapper: ({ children }) => <MockParent>{children}</MockParent>,
    });

    fireEvent.click(getByTestId("metadata-upload-create-batch"));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
