import { FC, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { render, waitFor } from "../../test-utils";
import { ContextState, Context as AuthCtx, Status as AuthStatus } from "../Contexts/AuthContext";

import InactivityDialog from "./InactivityDialog";

const logoutMock = vi.fn();

type TestParentProps = {
  /**
   * The user to use for the test parent.
   */
  isLoggedIn: boolean;
  /**
   * The children to render within the test parent.
   */
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({ isLoggedIn, children }: TestParentProps) => {
  const authValue = useMemo<ContextState>(
    () =>
      authCtxStateFactory.build({
        status: AuthStatus.LOADED,
        user: isLoggedIn ? userFactory.build() : null, // NOTE: This component is not concerned with the user object
        isLoggedIn,
        logout: logoutMock,
      }),
    [isLoggedIn]
  );

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthCtx.Provider value={authValue}>{children}</AuthCtx.Provider>
    </BrowserRouter>
  );
};

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    const { container } = render(<InactivityDialog />, {
      wrapper: ({ children }) => <TestParent isLoggedIn>{children}</TestParent>,
    });

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should call the session-ttl endpoint every 10 seconds", async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({ ttl: 10000000 }),
    } as unknown as Response); // Component only uses the `json` method

    render(<InactivityDialog />, {
      wrapper: ({ children }) => <TestParent isLoggedIn>{children}</TestParent>,
    });

    vi.advanceTimersByTime(10001);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining(`/api/authn/session-ttl`));

    vi.advanceTimersByTime(10001);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("should call the logout function when the session has timed out without user interaction", async () => {
    vi.useFakeTimers();

    logoutMock.mockResolvedValueOnce(true);

    vi.spyOn(window, "fetch").mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({ ttl: 0 }),
    } as unknown as Response); // Component only uses the `json` method

    render(<InactivityDialog />, {
      wrapper: ({ children }) => <TestParent isLoggedIn>{children}</TestParent>,
    });

    vi.advanceTimersByTime(10001);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
  });
});
