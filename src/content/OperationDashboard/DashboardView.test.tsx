import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthContextStatus,
} from "../../components/Contexts/AuthContext";
import { TestRouter, render } from "../../test-utils";

import DashboardView from "./DashboardView";

type ParentProps = {
  role?: UserRole;
  permissions?: AuthPermissions[];
  children: React.ReactElement;
};

const MockParent: FC<ParentProps> = ({
  role = "Admin",
  permissions = ["dashboard:view"],
  children,
}) => {
  const baseAuthCtx: AuthContextState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        status: AuthContextStatus.LOADED,
        isLoggedIn: role !== null,
        user: userFactory.build({ role, permissions }),
      }),
    [role]
  );

  return (
    <AuthContext.Provider value={baseAuthCtx}>
      <TestRouter basename="/">{children}</TestRouter>
    </AuthContext.Provider>
  );
};

describe("Accessibility", () => {
  it("should not have any accessibility violations when loading", async () => {
    const { container } = render(<DashboardView url={null} loading currentType="Submission" />, {
      wrapper: MockParent,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any accessibility violations in the default state", async () => {
    const { container } = render(
      <DashboardView url={null} loading={false} currentType="Submission" />,
      {
        wrapper: MockParent,
      }
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
