import React, { FC, useMemo } from "react";
import { Routes, Route } from "react-router-dom";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../../components/Contexts/AuthContext";
import { TestRouter, render, waitFor } from "../../test-utils";

import DataExplorerController from "./Controller";

vi.mock("./ListView", () => ({
  default: () => <div data-testid="data-explorer-list">MOCK-LIST-PAGE</div>,
}));

vi.mock("./StudyView", () => ({
  default: ({ _id }) => <div data-testid="data-explorer-study-view">MOCK-STUDY-PAGE {_id}</div>,
}));

type ParentProps = {
  initialEntry?: string;
  ctxStatus?: AuthContextStatus;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  initialEntry = "/data-explorer",
  ctxStatus = AuthContextStatus.LOADED,
  children,
}: ParentProps) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: ctxStatus,
        isLoggedIn: ctxStatus === AuthContextStatus.LOADED,
        user: userFactory.build(),
      }),
    [ctxStatus]
  );

  return (
    <AuthContext.Provider value={baseAuthCtx}>
      <TestRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/data-explorer/:studyId?" element={children} />
        </Routes>
      </TestRouter>
    </AuthContext.Provider>
  );
};

describe("Basic Functionality", () => {
  it("should render the controller without crashing", () => {
    expect(() =>
      render(<DataExplorerController />, {
        wrapper: ({ children }) => <TestParent>{children}</TestParent>,
      })
    ).not.toThrow();
  });

  it("should show a loading spinner when the AuthenticationContext is loading", () => {
    const { getByTestId } = render(<DataExplorerController />, {
      wrapper: ({ children }) => (
        <TestParent ctxStatus={AuthContextStatus.LOADING}>{children}</TestParent>
      ),
    });

    expect(getByTestId("data-explorer-suspense-loader")).toBeInTheDocument();
  });

  it("should render the study view page when a studyId argument is provided", async () => {
    const { getByText } = render(<DataExplorerController />, {
      wrapper: ({ children }) => (
        <TestParent initialEntry="/data-explorer/mock-study-uuid">{children}</TestParent>
      ),
    });

    await waitFor(() => {
      expect(getByText("MOCK-STUDY-PAGE mock-study-uuid")).toBeInTheDocument();
    });
  });

  it("should render the ListView when no studyId param is provided", async () => {
    const { getByText } = render(<DataExplorerController />, {
      wrapper: ({ children }) => <TestParent initialEntry="/data-explorer">{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByText("MOCK-LIST-PAGE")).toBeInTheDocument();
    });
  });
});
