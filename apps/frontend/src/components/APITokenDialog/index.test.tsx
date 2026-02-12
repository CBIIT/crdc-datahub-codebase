import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { GRANT_TOKEN, GrantTokenResp } from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";
import { Context as AuthContext, ContextState as AuthContextState } from "../Contexts/AuthContext";

import ApiTokenDialog from "./index";

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

type ParentProps = {
  children: React.ReactNode;
  mocks?: MockedResponse[];
  role?: UserRole;
  permissions?: AuthPermissions[];
};

const TestParent: FC<ParentProps> = ({
  role = "Submitter",
  permissions = ["data_submission:create"],
  mocks = [],
  children,
}) => {
  const authState = useMemo<AuthContextState>(
    () => authCtxStateFactory.build({ user: userFactory.build({ role, permissions }) }),
    [role]
  );

  return (
    <MockedProvider mocks={mocks}>
      <AuthContext.Provider value={authState}>
        <TestRouter basename="">{children}</TestRouter>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(<ApiTokenDialog open />, { wrapper: TestParent });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    expect(() => render(<ApiTokenDialog open={false} />, { wrapper: TestParent })).not.toThrow();
  });

  it("should call onClose when the 'Close' button is clicked", async () => {
    const onClose = vi.fn();
    const { getByText } = render(<ApiTokenDialog open onClose={onClose} />, {
      wrapper: TestParent,
    });

    userEvent.click(getByText(/Close/, { selector: "button" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when the 'X' icon is clicked", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<ApiTokenDialog open onClose={onClose} />, {
      wrapper: TestParent,
    });

    userEvent.click(getByRole("button", { name: /close/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const { findAllByRole } = render(<ApiTokenDialog open onClose={onClose} />, {
      wrapper: TestParent,
    });

    const backdrop = await findAllByRole("presentation");
    userEvent.click(backdrop[1]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should handle an API result with no tokens", async () => {
    const mock: MockedResponse<GrantTokenResp> = {
      request: {
        query: GRANT_TOKEN,
      },
      result: {
        data: {
          grantToken: {
            tokens: null,
            message: null,
          },
        },
      },
    };

    const { getByText } = render(<ApiTokenDialog open />, {
      wrapper: (p) => <TestParent {...p} mocks={[mock]} role="Submitter" />,
    });

    userEvent.click(getByText(/Create Token/, { selector: "button" }));

    await waitFor(() => {
      expect(getByText(/Token was unable to be created./)).toBeInTheDocument();
    });
  });

  it("should handle an API error without crashing (GraphQL)", async () => {
    const mock: MockedResponse<GrantTokenResp> = {
      request: {
        query: GRANT_TOKEN,
      },
      result: {
        errors: [new GraphQLError("An error occurred.")],
      },
    };

    const { getByText } = render(<ApiTokenDialog open />, {
      wrapper: (p) => <TestParent {...p} mocks={[mock]} role="Submitter" />,
    });

    userEvent.click(getByText(/Create Token/, { selector: "button" }));

    await waitFor(() => {
      expect(getByText(/Token was unable to be created./)).toBeInTheDocument();
    });
  });

  it("should handle an API error without crashing (Network)", async () => {
    const mock: MockedResponse<GrantTokenResp> = {
      request: {
        query: GRANT_TOKEN,
      },
      error: new Error("Network error"),
    };

    const { getByText } = render(<ApiTokenDialog open />, {
      wrapper: (p) => <TestParent {...p} mocks={[mock]} role="Submitter" />,
    });

    userEvent.click(getByText(/Create Token/, { selector: "button" }));

    await waitFor(() => {
      expect(getByText(/Token was unable to be created./)).toBeInTheDocument();
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should generate a token when the 'Create Token' button is clicked", async () => {
    let called = false;
    const mock: MockedResponse<GrantTokenResp> = {
      request: {
        query: GRANT_TOKEN,
      },
      result: () => {
        called = true;

        return {
          data: {
            grantToken: {
              tokens: ["fake-api-token-example"],
              message: null,
            },
          },
        };
      },
    };

    const { getByText, getByLabelText } = render(<ApiTokenDialog open />, {
      wrapper: (p) => <TestParent {...p} mocks={[mock]} role="Submitter" />,
    });

    expect(called).toBe(false);

    userEvent.click(getByText(/Create Token/, { selector: "button" }));

    await waitFor(() => {
      // NOTE: The token is not currently displayed in the dialog
      expect(getByLabelText(/API Token/, { selector: "input" })).toHaveValue(
        "*************************************"
      );
    });

    expect(called).toBe(true);
  });

  it("should copy a token when the 'Copy Token' icon is clicked", async () => {
    const mock: MockedResponse<GrantTokenResp> = {
      request: {
        query: GRANT_TOKEN,
      },
      result: {
        data: {
          grantToken: {
            tokens: ["fake-api-token-example"],
            message: null,
          },
        },
      },
    };

    const { getByText, getByLabelText } = render(<ApiTokenDialog open />, {
      wrapper: (p) => <TestParent {...p} mocks={[mock]} role="Submitter" />,
    });

    userEvent.click(getByText(/Create Token/, { selector: "button" }));

    await waitFor(() => {
      expect(getByLabelText(/API Token/, { selector: "input" })).toHaveValue(
        "*************************************"
      );
    });

    userEvent.click(getByLabelText(/Copy Token/));

    expect(mockWriteText).toHaveBeenCalledWith("fake-api-token-example");
  });

  it("should not copy a token when there are no tokens to copy", async () => {
    const { getByLabelText } = render(<ApiTokenDialog open />, {
      wrapper: TestParent,
    });

    userEvent.click(getByLabelText(/Copy Token/), null, { skipPointerEventsCheck: true });

    expect(mockWriteText).not.toHaveBeenCalled();
  });
});
