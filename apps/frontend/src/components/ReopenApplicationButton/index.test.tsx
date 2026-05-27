import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { useMemo } from "react";
import { axe } from "vitest-axe";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { LIST_USERS, ListUsersResp } from "../../graphql";
import { render } from "../../test-utils";
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
  it("should render the Reopen button when requirements are met", () => {
    const { getByTestId } = render(
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

    expect(getByTestId("reopen-application-button")).toBeInTheDocument();
    expect(getByTestId("reopen-application-button")).toHaveTextContent("Reopen");
  });
});
