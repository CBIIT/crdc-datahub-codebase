import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  CANCEL_APP,
  CancelAppInput,
  CancelAppResp,
  RESTORE_APP,
  RestoreAppInput,
  RestoreAppResp,
} from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthContextState } from "../Contexts/AuthContext";

import Button from "./index";

type TestParentProps = {
  user?: Partial<User>;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: React.FC<TestParentProps> = ({ mocks = [], user = {}, children }) => {
  const authCtxValue = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ ...user }),
      }),
    [user]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <AuthContext.Provider value={authCtxValue}>{children}</AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations for the component (cancel)", async () => {
    const { container, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("application-cancel-icon")).toBeInTheDocument(); // Sanity check for Cancel
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for the component (restore)", async () => {
    const { container, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("application-restore-icon")).toBeInTheDocument(); // Sanity check for Restore
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for the component (cancel disabled)", async () => {
    const { container, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
        disabled
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("application-cancel-icon")).toBeInTheDocument(); // Sanity check for Cancel
    expect(getByTestId("cancel-restore-application-button")).toBeDisabled(); // Sanity check for disabled
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations for the component (restore disabled)", async () => {
    const { container, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
        disabled
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("application-restore-icon")).toBeInTheDocument(); // Sanity check for Restore
    expect(getByTestId("cancel-restore-application-button")).toBeDisabled(); // Sanity check for disabled
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", async () => {
    const { queryByTestId } = render(<Button application={null} />, {
      wrapper: TestParent,
    });

    await waitFor(() => {
      expect(queryByTestId("cancel-restore-application-button")).not.toBeInTheDocument();
    });
  });

  it("should show a snackbar when the cancel operation fails (GraphQL Error)", async () => {
    const mocks: MockedResponse<CancelAppResp, CancelAppInput>[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to cancel that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the delete operation fails (Network Error)", async () => {
    const mocks: MockedResponse<CancelAppResp, CancelAppInput>[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to cancel that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the delete operation fails (API Error)", async () => {
    const mocks: MockedResponse<CancelAppResp, CancelAppInput>[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: () => true,
        result: {
          data: {
            cancelApplication: {
              _id: undefined,
            },
          },
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to cancel that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should call the onCancel callback when the cancel operation is successful", async () => {
    const onCancel = vi.fn();
    const mocks: MockedResponse<CancelAppResp, CancelAppInput>[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: () => true,
        result: {
          data: {
            cancelApplication: {
              _id: "some id",
            },
          },
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
        onCancel={onCancel}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it("should show a snackbar when the restore operation fails (GraphQL Error)", async () => {
    const mocks: MockedResponse<RestoreAppResp, RestoreAppInput>[] = [
      {
        request: {
          query: RESTORE_APP,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to restore that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the restore operation fails (Network Error)", async () => {
    const mocks: MockedResponse<RestoreAppResp, RestoreAppInput>[] = [
      {
        request: {
          query: RESTORE_APP,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to restore that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when the restore operation fails (API Error)", async () => {
    const mocks: MockedResponse<RestoreAppResp, RestoreAppInput>[] = [
      {
        request: {
          query: RESTORE_APP,
        },
        variableMatcher: () => true,
        result: {
          data: {
            restoreApplication: {
              _id: undefined,
            },
          },
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to restore that Submission Request",
        {
          variant: "error",
        }
      );
    });
  });

  it("should call the onCancel callback when the restore operation is successful", async () => {
    const onCancel = vi.fn();
    const mocks: MockedResponse<RestoreAppResp, RestoreAppInput>[] = [
      {
        request: {
          query: RESTORE_APP,
        },
        variableMatcher: () => true,
        result: {
          data: {
            restoreApplication: {
              _id: "some id",
            },
          },
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
        onCancel={onCancel}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    // Enter reason for action
    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "mock reason");

    // Click dialog confirm button once it is enabled
    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a tooltip present on the Cancel button", async () => {
    const { getByTestId, findByRole } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.hover(getByTestId("cancel-restore-application-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("Cancel submission request");

    userEvent.unhover(getByTestId("cancel-restore-application-button"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should have a tooltip present on the Restore button", async () => {
    const { getByTestId, findByRole } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.hover(getByTestId("cancel-restore-application-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("Restore submission request");

    userEvent.unhover(getByTestId("cancel-restore-application-button"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should dismiss the dialog when the 'Cancel' dialog button is clicked", async () => {
    const { findByRole, getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = await findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const button = await within(dialog).findByRole("button", { name: /cancel/i });
    userEvent.click(button);

    await waitFor(() => {
      expect(() => getByRole("dialog")).toThrow();
    });
  });

  // NOTE: They own the application, but the permission is missing
  it("should not be rendered when the user is missing the required permissions", async () => {
    const { queryByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "In Progress",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: [] }}>{children}</TestParent>
        ),
      }
    );

    await waitFor(() => {
      expect(queryByTestId("cancel-restore-application-button")).not.toBeInTheDocument();
    });
  });

  // NOTE: This is just a sanity check against component logic, and does not
  // cover all of the requirements. See the hasPermission checks for that.
  it.each<ApplicationStatus>(["Canceled", "Deleted"])(
    "should render as the 'Restore' variant for the Submission Request status '%s'",
    (status) => {
      const { getByTestId } = render(
        <Button
          application={applicationFactory.build({
            status,
            applicant: applicantFactory.build({ applicantID: "owner" }),
          })}
        />,
        {
          wrapper: ({ children }) => (
            <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
              {children}
            </TestParent>
          ),
        }
      );

      expect(getByTestId("cancel-restore-application-button")).toBeVisible();
      expect(getByTestId("application-restore-icon")).toBeInTheDocument();
    }
  );

  // NOTE: This is just a sanity check against component logic, and does not
  // cover all of the requirements. See the hasPermission checks for that.
  it.each<ApplicationStatus>(["New", "In Progress"])(
    "should render as the 'Cancel' variant for the Submission Request status '%s'",
    (status) => {
      const { getByTestId } = render(
        <Button
          application={applicationFactory.build({
            status,
            applicant: applicantFactory.build({ applicantID: "owner" }),
          })}
        />,
        {
          wrapper: ({ children }) => (
            <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
              {children}
            </TestParent>
          ),
        }
      );

      expect(getByTestId("cancel-restore-application-button")).toBeVisible();
      expect(getByTestId("application-cancel-icon")).toBeInTheDocument();
    }
  );

  it("should render tailored dialog content for the 'Restore' variant from Canceled", async () => {
    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Canceled",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByTestId("delete-dialog-header")).toHaveTextContent("Restore Submission Request");
    expect(getByTestId("delete-dialog-description")).toHaveTextContent(
      "Are you sure you want to restore the previously canceled submission request for the study listed below?"
    ); // Ignore study info, that is checked elsewhere
  });

  it("should render tailored dialog content for the 'Restore' variant from Deleted", async () => {
    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "Deleted",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByTestId("delete-dialog-header")).toHaveTextContent("Restore Submission Request");
    expect(getByTestId("delete-dialog-description")).toHaveTextContent(
      "Are you sure you want to restore the previously deleted submission request for the study listed below?"
    ); // Ignore study info, that is checked elsewhere
  });

  it("should render tailored dialog content for the 'Cancel' variant", async () => {
    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByTestId("delete-dialog-header")).toHaveTextContent("Cancel Submission Request");
    expect(getByTestId("delete-dialog-description")).toHaveTextContent(
      "Are you sure you want to cancel the submission request for the study listed below?"
    ); // Ignore study info, that is checked elsewhere
  });

  it("should render the Study Abbreviation in the dialog description", async () => {
    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          studyAbbreviation: "TEST",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByTestId("delete-dialog-description")).toHaveTextContent("Study: TEST");
  });

  it("should fallback to 'NA' for the Study Abbreviation in the dialog description", async () => {
    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          status: "New",
          studyAbbreviation: "",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent user={{ _id: "owner", permissions: ["submission_request:cancel"] }}>
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("cancel-restore-application-button"));

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByTestId("delete-dialog-description")).toHaveTextContent("Study: NA");
  });

  it("should require a reason for canceling", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mocks: MockedResponse<CancelAppResp, CancelAppInput>[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: mockMatcher,
        result: {
          data: {
            cancelApplication: {
              _id: "some id",
            },
          },
        },
      },
    ];

    const { getByRole, getByTestId } = render(
      <Button
        application={applicationFactory.build({
          _id: "mock-id-cancel-reason",
          status: "New",
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    expect(button).toBeDisabled();

    const input = await within(getByRole("dialog")).findByRole("textbox");
    userEvent.type(input, "this is a mock reason xyz 123");

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith({
        _id: "mock-id-cancel-reason",
        comment: "this is a mock reason xyz 123",
      });
    });
  });

  it.each<{ scenario: string; status: ApplicationStatus }>([
    { scenario: "Cancel", status: "New" },
    { scenario: "Restore", status: "Canceled" },
  ])("should limit the reason field to 500 characters ($scenario Action)", async ({ status }) => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CANCEL_APP,
        },
        variableMatcher: mockMatcher,
        result: {
          data: null,
        },
      },
      {
        request: {
          query: RESTORE_APP,
        },
        variableMatcher: mockMatcher,
        result: {
          data: null,
        },
      },
    ];

    const { rerender, getByRole, getByTestId, findByRole } = render(
      <Button
        application={applicationFactory.build({
          status,
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={mocks}
            user={{ _id: "owner", permissions: ["submission_request:cancel"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    // Open confirmation dialog
    userEvent.click(getByTestId("cancel-restore-application-button"));

    await findByRole("dialog");

    const button = await within(getByRole("dialog")).findByRole("button", { name: /confirm/i });

    expect(button).toBeDisabled();

    const input = await within(getByRole("dialog")).findByRole("textbox");

    userEvent.type(input, "X".repeat(550));

    // NOTE: Force rerender to ensure the input is re-evaluated for maxLength
    rerender(
      <Button
        application={applicationFactory.build({
          status,
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />
    );

    // NOTE: the button is still enabled because of the maxLength on the input field
    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    userEvent.click(button);

    expect(mockMatcher).toHaveBeenCalledWith({
      _id: expect.any(String),
      comment: "X".repeat(500),
    });
  });
});
