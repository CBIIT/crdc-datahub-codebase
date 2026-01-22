import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { batchFactory } from "@/factories/submission/BatchFactory";
import { batchFileInfoFactory } from "@/factories/submission/BatchFileInfoFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { fileURLFactory } from "@/factories/submission/FileURLFactory";
import { newBatchFactory } from "@/factories/submission/NewBatchFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { CREATE_BATCH, CreateBatchResp, UPDATE_BATCH, UpdateBatchResp } from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";
import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import MetadataUpload from "./MetadataUpload";

type ParentProps = {
  mocks?: MockedResponse[];
  authCtx?: Partial<AuthCtxState>;
  submission?: Submission;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  authCtx = {},
  submission = null,
  mocks = [],
  children,
}: ParentProps) => {
  const submissionCtx = useMemo<SubmissionCtxState>(
    () => ({
      data: {
        getSubmission: submission,
        submissionStats: null,
        getSubmissionAttributes: null,
      },
      status: SubmissionCtxStatus.LOADED,
      error: null,
    }),
    [submission]
  );

  return (
    <TestRouter>
      <AuthCtx.Provider
        value={authCtxStateFactory.build({
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
          }),
          ...authCtx,
        })}
      >
        <SubmissionContext.Provider value={submissionCtx}>
          <MockedProvider mocks={mocks} showWarnings>
            {children}
          </MockedProvider>
        </SubmissionContext.Provider>
      </AuthCtx.Provider>
    </TestRouter>
  );
};

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "example-accessibility-enabled-id",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "example-accessibility-disabled-id",
          metadataValidationStatus: null, // NOTE: these properties disable the component
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload
          onCreateBatch={vi.fn()}
          onUpload={vi.fn()}
          readOnly // NOTE: this property also disables the component
        />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations for the Model Version element", async () => {
    const { getByTestId } = render(<MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[]}
          authCtx={{
            user: userFactory.build({
              _id: "current-user",
              permissions: ["data_submission:view", "data_submission:create"],
              role: "Submitter",
            }),
          }}
          submission={submissionFactory.build({
            _id: "id-upload-button-text",
            metadataValidationStatus: "New",
            fileValidationStatus: "New",
            dataCommons: "Test Data Common",
            dataCommonsDisplayName: "Display Name of TDC",
            modelVersion: "1.9.3",
            submitterID: "current-user",
          })}
        >
          {children}
        </TestParent>
      ),
    });

    expect(getByTestId("metadata-upload-model-version")).toBeInTheDocument();
    expect(await axe(getByTestId("metadata-upload-model-version"))).toHaveNoViolations();
  });
});

describe("MetadataUpload Tooltip", () => {
  it("should display tooltip on hover with correct text", async () => {
    const { findByRole, getByLabelText } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onCreateBatch-callback",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const tooltipText =
      "The metadata uploaded will be compared with existing data within the submission. All new data will be added to the submission, including updates to existing information.";

    const tooltipBtn = getByLabelText("Toggle Tooltip");
    userEvent.hover(tooltipBtn);

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(tooltipText);

    userEvent.unhover(tooltipBtn);

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() =>
      render(
        <TestParent
          authCtx={{
            user: userFactory.build({
              _id: "current-user",
              permissions: ["data_submission:view", "data_submission:create"],
              role: "Submitter",
            }),
          }}
          submission={null}
        >
          <MetadataUpload onCreateBatch={null} onUpload={null} readOnly />
        </TestParent>
      )
    ).not.toThrow();
  });

  it("should show an alert when navigating away WITH selected files", () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-navigation-alert",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("should not show an alert when navigating away WITHOUT selected files", () => {
    render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-no-navigation-alert",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("should call onCreateBatch when successfully creating a batch", async () => {
    const onCreateBatchMock = vi.fn();
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            createBatch: newBatchFactory.build({
              fileCount: 1,
              files: [
                fileURLFactory.build({ fileName: "metadata.txt", signedURL: "example-signed-url" }),
              ],
            }),
          },
        },
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            updateBatch: batchFactory.build(),
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onCreateBatch-callback",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={onCreateBatchMock} onUpload={vi.fn()} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() => {
      expect(onCreateBatchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("should call onUpload when successfully uploading metadata", async () => {
    const onUploadMock = vi.fn();
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            createBatch: newBatchFactory.build({
              fileCount: 1,
              files: [
                fileURLFactory.build({ fileName: "metadata.txt", signedURL: "example-signed-url" }),
              ],
            }),
          },
        },
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            updateBatch: batchFactory.build(),
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onUpload-callback-pass",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={onUploadMock} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() => {
      expect(onUploadMock).toHaveBeenCalledWith(expect.any(String), "success");
    });
  });

  it("should call onUpload when failing to upload metadata (CREATE BATCH)", async () => {
    const onUploadMock = vi.fn();
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        error: new Error("error"),
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            updateBatch: batchFactory.build({
              fileCount: 1,
              files: batchFileInfoFactory.build(1, { fileName: "metadata.txt" }),
            }),
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onUpload-callback-fail",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={onUploadMock} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() => {
      expect(onUploadMock).toHaveBeenCalledWith(expect.any(String), "error");
    });
  });

  it("should call onUpload when failing to upload metadata (UPDATE BATCH)", async () => {
    const onUploadMock = vi.fn();
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            createBatch: newBatchFactory.build({
              fileCount: 1,
              files: [
                fileURLFactory.build({ fileName: "metadata.txt", signedURL: "example-signed-url" }),
              ],
            }),
          },
        },
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        error: new Error("error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onUpload-callback-fail-batch",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={onUploadMock} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() => {
      expect(onUploadMock).toHaveBeenCalledWith(expect.any(String), "error");
    });
  });

  it("should call onUpload when failing to upload metadata (FETCH)", async () => {
    vi.spyOn(window, "fetch").mockImplementationOnce(() => Promise.reject(new Error("simulated")));

    const onUploadMock = vi.fn();
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            createBatch: newBatchFactory.build({
              fileCount: 1,
              files: [
                fileURLFactory.build({ fileName: "metadata.txt", signedURL: "example-signed-url" }),
              ],
            }),
          },
        },
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            updateBatch: batchFactory.build(),
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-onUpload-callback-fail-create",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={onUploadMock} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() => {
      expect(onUploadMock).toHaveBeenCalledWith(expect.any(String), "error");
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render the Data Model version if it's provided", () => {
    const { getByText, getByTestId } = render(
      <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[]}
            authCtx={{
              user: userFactory.build({
                _id: "current-user",
                permissions: ["data_submission:view", "data_submission:create"],
                role: "Submitter",
              }),
            }}
            submission={submissionFactory.build({
              _id: "id-upload-button-text",
              metadataValidationStatus: "New",
              fileValidationStatus: "New",
              dataCommons: "Test Data Common",
              dataCommonsDisplayName: "Display Name of TDC",
              modelVersion: "1.9.3",
              submitterID: "current-user",
            })}
          >
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("metadata-upload-model-version")).toBeInTheDocument();
    expect(getByText(/Display Name of TDC Data Model/i)).toBeVisible();
    expect(getByText(/v1.9.3/i)).toBeVisible();
  });

  it("should not render the Data Model version if it's not provided", () => {
    const { queryByTestId } = render(
      <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[]}
            authCtx={{
              user: userFactory.build({
                _id: "current-user",
                permissions: ["data_submission:view", "data_submission:create"],
                role: "Submitter",
              }),
            }}
            submission={submissionFactory.build({
              _id: "id-upload-button-text",
              metadataValidationStatus: "New",
              fileValidationStatus: "New",
              submitterID: "current-user",
            })}
          >
            {children}
          </TestParent>
        ),
      }
    );

    expect(queryByTestId("metadata-upload-model-version")).not.toBeInTheDocument();
  });

  it("should render the Upload with text 'Uploading...' when metadata is uploading", async () => {
    const mocks: MockedResponse<CreateBatchResp | UpdateBatchResp>[] = [
      {
        request: {
          query: CREATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            createBatch: newBatchFactory.build({
              fileCount: 1,
              files: [
                fileURLFactory.build({
                  fileName: "metadata.txt",
                  signedURL: "example-signed-url",
                }),
              ],
            }),
          },
        },
      },
      {
        request: {
          query: UPDATE_BATCH,
        },
        variableMatcher: () => true,
        result: {
          data: {
            updateBatch: batchFactory.build({ status: "Uploaded" }),
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-upload-button-text",
          metadataValidationStatus: "New",
          fileValidationStatus: "New",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    // NOTE: We're not awaiting this because we want to test the button state before the upload is complete
    userEvent.click(getByTestId("metadata-upload-file-upload-button"));

    await waitFor(() =>
      expect(getByTestId("metadata-upload-file-upload-button")).toHaveTextContent(/Uploading.../i)
    );
  });

  it("should show the total count of valid files selected", async () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-file-count-test",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const files = new Array(10).fill(
      new File(["unused-content"], "fake-metadata.txt", { type: "text/plain" })
    );
    userEvent.upload(getByTestId("metadata-upload-file-input"), files);
    expect(getByTestId("metadata-upload-file-count")).toHaveTextContent(/10 files selected/i);
  });

  it("should reset the selected files if the user uploads no files after selecting some", async () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-file-count-test",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const file = new File(["unused-content"], "fake-metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);
    expect(getByTestId("metadata-upload-file-count")).toHaveTextContent(/1 file selected/i);

    userEvent.upload(getByTestId("metadata-upload-file-input"), []);
    expect(getByTestId("metadata-upload-file-count")).toHaveTextContent(/No files selected/i);
  });

  it.each<{ ext: string; type: string }>([
    { ext: ".txt", type: "text/plain" },
    { ext: ".tsv", type: "text/tab-separated-values" },
  ])("should accept '$ext' extension for metadata files", async ({ ext, type }) => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-approved-file-exts",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const file = new File(["unused-content"], `allowed-text${ext}`, { type });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);
    expect(getByTestId("metadata-upload-file-count")).toHaveTextContent(/1 file selected/i);
  });

  // NOTE: This is just a generic smoke test, not a comprehensive test for all possible file types
  it.each<{ ext: string; type: string }>([
    { ext: ".json", type: "application/json" },
    { ext: ".csv", type: "text/csv" },
    { ext: ".xls", type: "application/vnd.ms-excel" },
  ])("should not accept '$ext' extension for metadata files", async ({ ext, type }) => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-blacklisted-file-exts",
          metadataValidationStatus: null,
          fileValidationStatus: null,
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    // NOTE: this is already selected by default

    const file = new File(["unused-content"], `NOT-text${ext}`, { type });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);
    expect(getByTestId("metadata-upload-file-count")).toHaveTextContent(/No files selected/i);
  });

  it("should not be enabled when user is missing the required permissions", async () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "not-owner",
            role: "Submitter",
            permissions: [],
          }),
        }}
        submission={submissionFactory.build({
          _id: `readonly-for-non-owner`,
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "random-id-owner",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("metadata-upload-file-select-button")).toBeDisabled();
  });

  it("should be enabled when user has the required permissions", async () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            role: "Submitter",
            _id: "test-user",
            permissions: ["data_submission:view", "data_submission:create"],
          }),
        }}
        submission={submissionFactory.build({
          _id: "readonly-for-non-owner",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "test-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    const uploadButton = getByTestId("metadata-upload-file-select-button");

    expect(uploadButton).toBeEnabled();
  });

  it("should disable the Choose Files button when readOnly is true", () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "current-user",
            permissions: ["data_submission:view", "data_submission:create"],
            role: "Submitter",
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-readonly-choose-files",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "current-user",
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} readOnly />
      </TestParent>
    );

    expect(getByTestId("metadata-upload-file-select-button")).toBeDisabled();
  });

  it("should disable the 'Choose Files' and 'Upload' buttons when a non-submission owner user does not have create permissions and is not a collaborator", () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "other-user-2",
            role: "Submitter",
            permissions: ["data_submission:view"],
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-readonly-choose-files",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "some-other-user",
          collaborators: [
            collaboratorFactory.build({
              collaboratorID: "other-user",
              collaboratorName: "",
              permission: "Can Edit",
            }),
          ],
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("metadata-upload-file-select-button")).toBeDisabled();
    expect(getByTestId("metadata-upload-file-upload-button")).toBeDisabled();
  });

  it("should enable the 'Choose Files' and 'Upload' buttons when user is a collaborator without create permissions", () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "other-user",
            role: "Submitter",
            permissions: ["data_submission:view"],
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-readonly-choose-files",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "some-other-user",
          collaborators: [
            collaboratorFactory.build({
              collaboratorID: "other-user",
              collaboratorName: "",
              permission: "Can Edit",
            }),
          ],
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("metadata-upload-file-select-button")).toBeEnabled();
    expect(getByTestId("metadata-upload-file-upload-button")).toBeDisabled();

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    expect(getByTestId("metadata-upload-file-upload-button")).toBeEnabled();
  });

  it("should enable the 'Choose Files' and 'Upload' buttons when when a collaborator has permissions", () => {
    const { getByTestId } = render(
      <TestParent
        authCtx={{
          user: userFactory.build({
            _id: "collaborator-user",
            role: "Submitter",
            permissions: ["data_submission:view", "data_submission:create"],
          }),
        }}
        submission={submissionFactory.build({
          _id: "id-readonly-choose-files",
          metadataValidationStatus: "Passed",
          fileValidationStatus: "Passed",
          submitterID: "some-other-user",
          collaborators: [
            collaboratorFactory.build({
              collaboratorID: "collaborator-user",
              collaboratorName: "",
              permission: "Can Edit",
            }),
          ],
        })}
      >
        <MetadataUpload onCreateBatch={vi.fn()} onUpload={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("metadata-upload-file-select-button")).toBeEnabled();
    expect(getByTestId("metadata-upload-file-upload-button")).toBeDisabled();

    const file = new File(["unused-content"], "metadata.txt", { type: "text/plain" });
    userEvent.upload(getByTestId("metadata-upload-file-input"), file);

    expect(getByTestId("metadata-upload-file-upload-button")).toBeEnabled();
  });
});
