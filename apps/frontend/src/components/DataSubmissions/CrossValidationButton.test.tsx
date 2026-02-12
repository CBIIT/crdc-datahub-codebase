import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  VALIDATE_SUBMISSION,
  ValidateSubmissionInput,
  ValidateSubmissionResp,
} from "../../graphql";
import { render, waitFor } from "../../test-utils";
import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import { CrossValidationButton } from "./CrossValidationButton";

const baseSubmissionCtx: SubmissionCtxState = submissionCtxStateFactory.build({
  status: SubmissionCtxStatus.LOADING,
  data: null,
  error: null,
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  refetch: vi.fn(),
  updateQuery: vi.fn(),
});

const basePermissions: AuthPermissions[] = ["data_submission:view", "data_submission:review"];

type ParentProps = {
  mocks?: MockedResponse[];
  authCtxState?: AuthCtxState;
  submissionCtxState?: SubmissionCtxState;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  authCtxState = authCtxStateFactory.build(),
  submissionCtxState = baseSubmissionCtx,
  mocks = [],
  children,
}: ParentProps) => (
  <AuthCtx.Provider value={authCtxState}>
    <SubmissionContext.Provider value={submissionCtxState}>
      <MockedProvider mocks={mocks} showWarnings>
        {children}
      </MockedProvider>
    </SubmissionContext.Provider>
  </AuthCtx.Provider>
);

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "example-sub-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
            }),
          })}
        />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "example-sub-id",
            status: "Submitted",
            crossSubmissionStatus: null,
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              // NOTE: this is needed otherwise the button won't render
              Submitted: ["submitted-id"],
            }),
          })}
          disabled
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() =>
      render(
        <TestParent
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({ role: "Admin", permissions: basePermissions }),
          })}
        >
          <CrossValidationButton
            submission={submissionFactory.build({
              _id: "smoke-test-id",
              status: null,
              otherSubmissions: null,
              crossSubmissionStatus: null,
            })}
          />
        </TestParent>
      )
    ).not.toThrow();
  });

  it("should initiate cross validation when clicked", async () => {
    const submissionID = "base-success-test-onclick-id";
    let called = false;
    const mocks: MockedResponse<ValidateSubmissionResp, ValidateSubmissionInput>[] = [
      {
        request: {
          query: VALIDATE_SUBMISSION,
          variables: {
            _id: submissionID,
            types: ["cross-submission"],
            scope: "All",
          },
        },
        result: () => {
          called = true;

          return {
            data: {
              validateSubmission: {
                success: true,
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: submissionID,
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(called).toBe(false);

    userEvent.click(getByTestId("cross-validate-button"));

    await waitFor(() => {
      expect(called).toBe(true);
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Validation process is starting; this may take some time. Please wait before initiating another validation.",
        {
          variant: "success",
        }
      );
      expect(getByTestId("cross-validate-button")).toBeDisabled();
    });
  });

  it("should handle API network errors gracefully", async () => {
    const submissionID = "base-network-error-test-id";
    const mocks: MockedResponse<ValidateSubmissionResp, ValidateSubmissionInput>[] = [
      {
        request: {
          query: VALIDATE_SUBMISSION,
        },
        variableMatcher: () => true,
        error: new Error("Mock network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: submissionID,
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("cross-validate-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to initiate validation process.", {
        variant: "error",
      });
      expect(getByTestId("cross-validate-button")).toBeEnabled();
    });
  });

  it("should handle API GraphQL errors gracefully", async () => {
    const submissionID = "base-GraphQL-error-test-id";
    const mocks: MockedResponse<ValidateSubmissionResp, ValidateSubmissionInput>[] = [
      {
        request: {
          query: VALIDATE_SUBMISSION,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Mock GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent
        mocks={mocks}
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: submissionID,
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("cross-validate-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to initiate validation process.", {
        variant: "error",
      });
      expect(getByTestId("cross-validate-button")).toBeEnabled();
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should be named 'Cross Validate'", () => {
    const { getByText } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "example-sub-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByText("Cross Validate")).toBeInTheDocument();
  });

  it("should render as disabled with text 'Validating...' when the submission is validating", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "validating-test-id",
            status: "Submitted",
            crossSubmissionStatus: "Validating",
            otherSubmissions: JSON.stringify({
              "In Progress": ["some-other-id"],
              Submitted: ["submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeDisabled();
    expect(getByTestId("cross-validate-button")).toHaveTextContent("Validating...");
  });

  it("should update back to the default text when the submission is no longer validating", () => {
    const submission: Submission = submissionFactory.build({
      _id: "validating-test-id",
      status: "Submitted",
      crossSubmissionStatus: "Validating",
      otherSubmissions: JSON.stringify({
        "In Progress": [],
        Submitted: ["submitted-id"],
        Released: [],
      }),
    });

    const { getByTestId, rerender } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton submission={submission} />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeDisabled();
    expect(getByTestId("cross-validate-button")).toHaveTextContent("Validating...");

    rerender(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={{
            ...submission,
            crossSubmissionStatus: "Passed",
          }}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeEnabled();
    expect(getByTestId("cross-validate-button")).toHaveTextContent(/validate/i);
  });

  it("should be enabled only if there are other related Submitted submissions", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "validating-test-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id", "another-submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeInTheDocument();
    expect(getByTestId("cross-validate-button")).toBeEnabled();
  });

  it("should be enabled only if there are other related Released submissions", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "validating-test-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: [],
              Released: ["submitted-id", "another-submitted-id"],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeInTheDocument();
    expect(getByTestId("cross-validate-button")).toBeEnabled();
  });

  it("should be HIDDEN if there are no other related Submitted submissions", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "validating-test-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": ["in-prog-id", "another-in-prog-id"],
              Submitted: [], // NOTE: This disables the button
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(() => getByTestId("cross-validate-button")).toThrow();
  });

  it.each<CrossSubmissionStatus>(["Passed", "Error"])(
    "should not be disabled based on the crossSubmissionStatus (checking '%s')",
    (status) => {
      const { getByTestId } = render(
        <TestParent
          authCtxState={authCtxStateFactory.build({
            user: userFactory.build({ role: "Admin", permissions: basePermissions }),
          })}
        >
          <CrossValidationButton
            submission={submissionFactory.build({
              _id: `not-disabled-assertion-${status}-id`,
              status: "Submitted",
              crossSubmissionStatus: status,
              otherSubmissions: JSON.stringify({
                "In Progress": ["submitted-id", "another-submitted-id"],
                Submitted: ["submitted-id", "another-submitted-id"],
                Released: ["submitted-id", "another-submitted-id"],
              }),
            })}
          />
        </TestParent>
      );

      expect(getByTestId("cross-validate-button")).toBeInTheDocument();
      expect(getByTestId("cross-validate-button")).toBeEnabled();
    }
  );

  it("should always render for user with the required permissions while other Submissions are present", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({
            role: "Admin",
            permissions: basePermissions,
          }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            status: "Submitted",
            _id: `render-role-test-id`,
            crossSubmissionStatus: null,
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["submitted-id", "another-submitted-id"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeInTheDocument();
  });

  it("should never render for user without the required permissions while other Submissions are present", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: [] }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: `role-test-id`,
            status: "Submitted",
            crossSubmissionStatus: null,
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              // NOTE: Even with these values, the button should not render
              Submitted: ["submitted-id", "another-submitted-id"],
              Released: ["x", "y", "z"],
            }),
          })}
        />
      </TestParent>
    );

    expect(() => getByTestId("cross-validate-button")).toThrow();
  });

  it("should only be enabled for the Submission status of 'Submitted'", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: "render-status-test-Submitted-id",
            status: "Submitted",
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["this-enables-the-button"],
              Released: [],
            }),
          })}
        />
      </TestParent>
    );

    expect(getByTestId("cross-validate-button")).toBeInTheDocument();
    expect(getByTestId("cross-validate-button")).toBeEnabled();
  });

  it.each<Submission["status"]>([
    "New",
    "In Progress",
    "Withdrawn",
    "Released",
    "Completed",
    "Canceled",
    "fake status" as Submission["status"],
  ])("should never be visible for the Submission status of '%s'", (status) => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ role: "Admin", permissions: basePermissions }),
        })}
      >
        <CrossValidationButton
          submission={submissionFactory.build({
            _id: `render-status-test-${status}-id`,
            status,
            crossSubmissionStatus: "New",
            otherSubmissions: JSON.stringify({
              "In Progress": [],
              Submitted: ["this-enables-the-button"],
              Released: ["also-would-enable-the-button"],
            }),
          })}
        />
      </TestParent>
    );

    expect(() => getByTestId("cross-validate-button")).toThrow();
  });
});
