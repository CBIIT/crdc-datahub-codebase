import { MockedProvider } from "@apollo/client/testing";
import { FC, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";

import { ContextState, Context, Status } from "../components/Contexts/AuthContext";
import { render } from "../test-utils";

import HomePage from "./index";

const Parent: FC<{ children: React.ReactElement; loggedIn: boolean }> = ({
  children,
  loggedIn,
}) => {
  const value: ContextState = useMemo(
    () =>
      authCtxStateFactory.build({
        isLoggedIn: loggedIn,
        status: Status.LOADED,
        user: null,
      }),
    [loggedIn]
  );

  return (
    <MockedProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Context.Provider value={value}>{children}</Context.Provider>
      </BrowserRouter>
    </MockedProvider>
  );
};

describe("should not have any accessibility violations", () => {
  it("when logged in", async () => {
    const { container } = render(
      <Parent loggedIn>
        <HomePage />
      </Parent>
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("when logged out", async () => {
    const { container } = render(
      <Parent loggedIn={false}>
        <HomePage />
      </Parent>
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
