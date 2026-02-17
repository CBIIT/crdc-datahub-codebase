import { ContextState as AuthCtxState, Status } from "../../../components/Contexts/AuthContext";
import { Factory } from "../Factory";

import { userFactory } from "./UserFactory";

/**
 * Base AuthCtxState object
 */
export const baseAuthCtxState: AuthCtxState = {
  status: Status.LOADED,
  isLoggedIn: true,
  user: userFactory.build(),
};

/**
 * AuthCtxState factory for creating AuthCtxState instances
 */
export const authCtxStateFactory = new Factory<AuthCtxState>((overrides) => ({
  ...baseAuthCtxState,
  ...overrides,
}));
