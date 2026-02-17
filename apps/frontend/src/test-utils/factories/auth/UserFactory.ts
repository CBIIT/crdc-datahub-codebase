import { Factory } from "../Factory";

/**
 * Base user object
 */
export const baseUser: User = {
  _id: "",
  firstName: "",
  lastName: "",
  role: "User",
  email: "",
  dataCommons: [],
  dataCommonsDisplayNames: [],
  studies: [],
  institution: undefined,
  IDP: "nih",
  userStatus: "Active",
  permissions: [],
  notifications: [],
  updateAt: "",
  createdAt: "",
};

/**
 * User factory for creating user instances
 */
export const userFactory = new Factory<User>((overrides) => ({
  ...baseUser,
  ...overrides,
}));
