import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { render, waitFor } from "../../test-utils";
import { Context as AuthContext, Status as AuthStatus } from "../Contexts/AuthContext";

import CreateApplicationButton from "./index";

type MockParentProps = {
  mocks?: MockedResponse[];
  user?: Partial<User>;
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks = [], user = {}, children }) => {
  const authValue = useMemo(
    () =>
      authCtxStateFactory.build({
        status: AuthStatus.LOADED,
        isLoggedIn: true,
        user: userFactory.build({
          _id: "user-1",
          permissions: ["submission_request:create"],
          ...user,
        }),
      }),
    [user]
  );
  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no accessibility violations (button)", async () => {
    const { container, findByTestId } = render(<CreateApplicationButton onCreate={vi.fn()} />, {
      wrapper: MockParent,
    });

    await findByTestId("create-application-button"); // Sanity check to ensure the button is rendered

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations (disabled button)", async () => {
    const { container, findByTestId } = render(
      <CreateApplicationButton onCreate={vi.fn()} disabled />,
      {
        wrapper: MockParent,
      }
    );

    const button = await findByTestId("create-application-button");

    expect(button).toBeDisabled(); // Sanity check to ensure the button is disabled
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations (dialog)", async () => {
    const { container, findByTestId, findByRole } = render(
      <CreateApplicationButton onCreate={vi.fn()} />,
      {
        wrapper: MockParent,
      }
    );

    const button = await findByTestId("create-application-button");
    userEvent.click(button);

    await findByRole("dialog"); // Sanity check to ensure the dialog is open

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should call onCreate with 'new' on confirm", async () => {
    const mockOnCreate = vi.fn();

    const { findByTestId, findByText } = render(
      <CreateApplicationButton onCreate={mockOnCreate} />,
      {
        wrapper: MockParent,
      }
    );

    const button = await findByTestId("create-application-button");
    userEvent.click(button);

    const confirmButton = await findByText("I Read and Accept");
    userEvent.click(confirmButton);

    await waitFor(() => expect(mockOnCreate).toHaveBeenCalledWith("new"));
  });

  it("should close the dialog when confirmed", async () => {
    const { findByTestId, findByText, queryByRole } = render(
      <CreateApplicationButton onCreate={vi.fn()} />,
      {
        wrapper: MockParent,
      }
    );

    const button = await findByTestId("create-application-button");
    userEvent.click(button);

    const confirmButton = await findByText("I Read and Accept");
    userEvent.click(confirmButton);

    await waitFor(() => expect(queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Implementation Requirements", () => {
  it("should render with the correct button text", async () => {
    const { findByText } = render(<CreateApplicationButton onCreate={vi.fn()} />, {
      wrapper: MockParent,
    });

    expect(await findByText("Start a Submission Request")).toBeVisible();
  });

  it("should be hidden if the user does not have permission", async () => {
    const { queryByTestId } = render(<CreateApplicationButton onCreate={vi.fn()} />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[]} user={{ permissions: [] }}>
          {children}
        </MockParent>
      ),
    });

    expect(queryByTestId("create-application-button")).not.toBeInTheDocument();
  });

  it("should require confirmation before creating a new application", async () => {
    const { findByTestId, findByText } = render(<CreateApplicationButton onCreate={vi.fn()} />, {
      wrapper: MockParent,
    });

    const button = await findByTestId("create-application-button");
    userEvent.click(button);

    expect(await findByText("I Read and Accept")).toBeVisible();
  });

  it("should not do anything if the user cancels the confirmation", async () => {
    const mockOnCreate = vi.fn();

    const { findByTestId, findByText } = render(
      <CreateApplicationButton onCreate={mockOnCreate} />,
      {
        wrapper: MockParent,
      }
    );

    const button = await findByTestId("create-application-button");
    userEvent.click(button);

    const cancelButton = await findByText("Cancel");
    userEvent.click(cancelButton);

    expect(mockOnCreate).not.toHaveBeenCalled();
  });
});
