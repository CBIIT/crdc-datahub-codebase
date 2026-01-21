import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { Route, Routes } from "react-router-dom";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../../components/Contexts/AuthContext";
import { GET_DASHBOARD_URL, GetDashboardURLInput, GetDashboardURLResp } from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";

import Controller from "./Controller";

const mockUsePageTitle = vi.fn();
vi.mock("../../hooks/usePageTitle", () => ({
  ...vi.importActual("../../hooks/usePageTitle"),
  __esModule: true,
  default: (p) => mockUsePageTitle(p),
}));

type ParentProps = {
  role: UserRole;
  permissions?: AuthPermissions[];
  initialEntry?: string;
  mocks?: MockedResponse[];
  ctxStatus?: AuthContextStatus;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  role,
  permissions = ["dashboard:view"],
  initialEntry = "/dashboard",
  mocks = [],
  ctxStatus = AuthContextStatus.LOADED,
  children,
}: ParentProps) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: ctxStatus,
        isLoggedIn: role !== null,
        user: userFactory.build({ role, permissions }),
      }),
    [role, ctxStatus]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <TestRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/dashboard"
            element={<AuthContext.Provider value={baseAuthCtx}>{children}</AuthContext.Provider>}
          />
          <Route path="/" element={<div>Root Page</div>} />
        </Routes>
      </TestRouter>
    </MockedProvider>
  );
};

describe("Basic Functionality", () => {
  it("should set the page title", async () => {
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getDashboardURL: {
            url: "https://example.com",
          },
        },
      },
    };

    render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    await waitFor(() => {
      expect(mockUsePageTitle).toHaveBeenCalledWith("Operation Dashboard");
    });
  });

  it("should render the page without crashing", async () => {
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getDashboardURL: {
            url: "https://example.com",
          },
        },
      },
    };

    const { getByTestId } = render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    await waitFor(() => {
      expect(getByTestId("operation-dashboard-container")).toBeInTheDocument();
    });
  });

  it("should default to the 'Submission' type if none is provided", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          getDashboardURL: {
            url: "https://example.com",
          },
        },
      },
    };

    render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    expect(mockMatcher).toHaveBeenCalledWith({ type: "Submission" });
  });

  it("should use the 'type' query parameter if provided", async () => {
    // NOTE: We're ignoring MUI warnings about out-of-range values.
    // Once we have other options available besides 'Submission', we can remove the out-of-range value.
    vi.spyOn(console, "warn").mockImplementation((e) => {
      if (!e.includes("out-of-range value")) {
        throw new Error(e);
      }
    });

    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          getDashboardURL: {
            url: "https://example.com",
          },
        },
      },
    };

    render(<Controller />, {
      wrapper: (p) => (
        <TestParent
          role="Admin"
          initialEntry="/dashboard?type=Organization"
          mocks={[mock]}
          {...p}
        />
      ),
    });

    expect(mockMatcher).toHaveBeenCalledWith({ type: "Organization" });

    vi.restoreAllMocks();
  });

  it("should show a loading spinner when the AuthCtx is loading", async () => {
    const { getByLabelText } = render(<Controller />, {
      wrapper: (p) => <TestParent role={null} ctxStatus={AuthContextStatus.LOADING} {...p} />,
    });

    await waitFor(() => {
      expect(getByLabelText("Content Loader")).toBeInTheDocument();
    });
  });

  it("should redirect the user with missing permissions to the home page", async () => {
    const { getByText } = render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" {...p} permissions={[]} />,
    });

    expect(getByText("Root Page")).toBeInTheDocument();
  });

  it("should show an error message when the URL cannot be fetched (GraphQL)", async () => {
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };

    render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Simulated GraphQL error", {
        variant: "error",
      });
    });
  });

  it("should show an error message when the URL cannot be fetched (Network)", async () => {
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };

    render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Simulated network error", {
        variant: "error",
      });
    });
  });

  it("should not crash if the URL is not provided", async () => {
    const mock: MockedResponse<GetDashboardURLResp, GetDashboardURLInput> = {
      request: {
        query: GET_DASHBOARD_URL,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getDashboardURL: null,
        },
      },
    };

    const { getByTestId } = render(<Controller />, {
      wrapper: (p) => <TestParent role="Admin" mocks={[mock]} {...p} />,
    });

    await waitFor(() => {
      expect(getByTestId("operation-dashboard-container")).toBeInTheDocument();
    });
  });

  // NOTE: Disabled until we have more than one type available
  it.skip("should refetch the URL when the type changes");
});
