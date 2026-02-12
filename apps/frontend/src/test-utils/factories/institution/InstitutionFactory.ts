import { Factory } from "../Factory";

/**
 * Base Institution object
 */
export const baseInstitution: Institution = {
  _id: "",
  name: "",
  status: "Active",
  submitterCount: 0,
};

/**
 * Institution factory for creating Institution instances
 */
export const institutionFactory = new Factory<Institution>((overrides) => ({
  ...baseInstitution,
  ...overrides,
}));
