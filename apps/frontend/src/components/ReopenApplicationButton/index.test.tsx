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
  LIST_USERS,
  ListUsersResp,
  REOPEN_APPROVED_SR,
  ReopenApprovedSRInput,
  ReopenApprovedSRResp,
} from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthContextState } from "../Contexts/AuthContext";

import Button from "./index";

type TestParentProps = {
  user?: Partial<User>;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const listUsersMock: MockedResponse<ListUsersResp> = {
  request: {
    query: LIST_USERS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listUsers: [
        userFactory.build({ _id: "user-1", firstName: "John", lastName: "Doe", role: "User" }),
        userFactory.build({
          _id: "user-2",
          firstName: "Jane",
          lastName: "Smith",
          role: "Submitter",
        }),
      ],
    },
  },
};

const createApplication = (overrides: Partial<Application> = {}) =>
  applicationFactory.build({
    _id: "app-1",
    status: "Approved",
    nextRevisionId: null,
    studyName: "Study One",
    studyAbbreviation: "S1",
    programName: "Program One",
    programAbbreviation: "P1",
    applicant: applicantFactory.build({
      applicantID: "owner-1",
      applicantName: "Current Owner",
    }),
    ...overrides,
  });

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
  it("should not have any violations", async () => {
    const { container } = render(
      <Button
        application={applicationFactory.build({
          status: "Approved",
          nextRevisionId: null,
          applicant: applicantFactory.build({ applicantID: "owner" }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock]}
            user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should render the Reopen button for an internal user with permission", () => {
    const { getByTestId } = render(<Button application={createApplication()} />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[listUsersMock]}
          user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
        >
          {children}
        </TestParent>
      ),
    });

    expect(getByTestId("reopen-application-button")).toBeInTheDocument();
    expect(getByTestId("reopen-application-button")).toHaveTextContent("Reopen");
  });

  it("should render a disabled Reopen button when disabled prop is true", () => {
    const { getByTestId } = render(<Button application={createApplication()} disabled />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[listUsersMock]}
          user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
        >
          {children}
        </TestParent>
      ),
    });

    expect(getByTestId("reopen-application-button")).toBeDisabled();
  });

  it("should open the dialog and prefill study/program/owner values", async () => {
    const { getByRole, getByTestId, getByDisplayValue, findByRole } = render(
      <Button application={createApplication()} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock]}
            user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("reopen-application-button"));

    const dialog = await findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    expect(getByDisplayValue("Study One (S1)")).toBeInTheDocument();
    expect(getByDisplayValue("Program One (P1)")).toBeInTheDocument();

    const confirmButton = within(dialog).getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeEnabled();
    expect(within(dialog).getByTestId("reopen-dialog-owner-autocomplete")).toBeInTheDocument();

    const cancelButton = getByRole("button", { name: /cancel/i });
    userEvent.click(cancelButton);

    await waitFor(() => {
      expect(() => getByRole("dialog")).toThrow();
    });
  });

  it("should show an error snackbar when owners cannot be loaded", async () => {
    const failingListUsersMock: MockedResponse<ListUsersResp> = {
      request: {
        query: LIST_USERS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Unable to list users")],
      },
    };

    const { getByTestId } = render(<Button application={createApplication()} />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[failingListUsersMock]}
          user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(getByTestId("reopen-application-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("There was an issue loading owners.", {
        variant: "error",
      });
    });
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not render the button when the user lacks reopen permission", async () => {
    const { queryByTestId } = render(<Button application={createApplication()} />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[listUsersMock]}
          user={{ _id: "admin-1", role: "Admin", permissions: [] }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(queryByTestId("reopen-application-button")).not.toBeInTheDocument();
    });
  });

  it.each<ApplicationStatus>([
    "New",
    "In Progress",
    "Inquired",
    "Submitted",
    "In Review",
    "Reopened",
    "Canceled",
    "Deleted",
    "Rejected",
  ])("should not render the button when status is '%s'", async (status) => {
    const { queryByTestId } = render(
      <Button application={createApplication({ status, nextRevisionId: null })} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock]}
            user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    await waitFor(() => {
      expect(queryByTestId("reopen-application-button")).not.toBeInTheDocument();
    });
  });

  it("should not render the button when application has a next revision", async () => {
    const { queryByTestId } = render(
      <Button application={createApplication({ nextRevisionId: "next-revision-1" })} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock]}
            user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    await waitFor(() => {
      expect(queryByTestId("reopen-application-button")).not.toBeInTheDocument();
    });
  });

  it("should render for a non-owner submitter when reopen permission is present", () => {
    const { getByTestId } = render(
      <Button
        application={createApplication({
          applicant: applicantFactory.build({
            applicantID: "someone-else",
            applicantName: "Another User",
          }),
        })}
      />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock]}
            user={{
              _id: "submitter-1",
              role: "Submitter",
              permissions: ["submission_request:reopen"],
            }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    expect(getByTestId("reopen-application-button")).toBeInTheDocument();
  });

  it("should hide owner field in dialog for non-internal users", async () => {
    const { findByRole, getByTestId } = render(<Button application={createApplication()} />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[listUsersMock]}
          user={{
            _id: "submitter-1",
            role: "Submitter",
            permissions: ["submission_request:reopen"],
          }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(getByTestId("reopen-application-button"));

    const dialog = await findByRole("dialog");
    expect(within(dialog).queryByText("Owner")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByTestId("reopen-dialog-owner-autocomplete")
    ).not.toBeInTheDocument();
  });

  it("should call reopen mutation and onComplete after successful confirmation", async () => {
    const onComplete = vi.fn();
    const mutationMatcher = vi
      .fn()
      .mockImplementation(
        (variables: ReopenApprovedSRInput) =>
          variables.id === "app-1" && variables.ownerId === undefined
      );

    const reopenMock: MockedResponse = {
      request: {
        query: REOPEN_APPROVED_SR,
      },
      variableMatcher: mutationMatcher,
      result: {
        data: {
          reopenApprovedSubmissionRequest: {
            _id: "app-1",
          },
        } as ReopenApprovedSRResp,
      },
    };

    const { findByRole, getByTestId } = render(
      <Button application={createApplication()} onComplete={onComplete} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[listUsersMock, reopenMock]}
            user={{ _id: "admin-1", role: "Admin", permissions: ["submission_request:reopen"] }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("reopen-application-button"));

    const dialog = await findByRole("dialog");
    const confirmButton = await within(dialog).findByRole("button", { name: /confirm/i });
    userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mutationMatcher).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Submission Request has been successfully reopened.",
        {
          variant: "success",
        }
      );
    });
  });

  it("should reopen successfully for non-internal users without changing owner", async () => {
    const onComplete = vi.fn();
    const mutationMatcher = vi
      .fn()
      .mockImplementation(
        (variables: ReopenApprovedSRInput) =>
          variables.id === "app-1" && variables.ownerId === undefined
      );

    const reopenMock: MockedResponse = {
      request: {
        query: REOPEN_APPROVED_SR,
      },
      variableMatcher: mutationMatcher,
      result: {
        data: {
          reopenApprovedSubmissionRequest: {
            _id: "app-1",
          },
        } as ReopenApprovedSRResp,
      },
    };

    const { findByRole, getByTestId } = render(
      <Button application={createApplication()} onComplete={onComplete} />,
      {
        wrapper: ({ children }) => (
          <TestParent
            mocks={[reopenMock]}
            user={{
              _id: "submitter-1",
              role: "Submitter",
              permissions: ["submission_request:reopen"],
            }}
          >
            {children}
          </TestParent>
        ),
      }
    );

    userEvent.click(getByTestId("reopen-application-button"));

    const dialog = await findByRole("dialog");
    const confirmButton = await within(dialog).findByRole("button", { name: /confirm/i });
    userEvent.click(confirmButton);

    await waitFor(() => {
      expect(mutationMatcher).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Submission Request has been successfully reopened.",
        {
          variant: "success",
        }
      );
    });
  });
});
