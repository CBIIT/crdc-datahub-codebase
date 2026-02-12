import { Factory } from "../Factory";

/**
 * Base Organization object
 */
export const baseOrganization: Organization = {
  _id: "",
  name: "",
  abbreviation: "",
  description: "",
  status: "Active",
  conciergeID: "",
  conciergeName: "",
  conciergeEmail: "",
  studies: [],
  readOnly: false,
  createdAt: "",
  updateAt: "",
};

/**
 * Organization factory for creating Organization instances
 */
export const organizationFactory = new Factory<Organization>((overrides) => ({
  ...baseOrganization,
  ...overrides,
}));
