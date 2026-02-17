import { Factory } from "../Factory";

/**
 * Base collaborator object
 */
export const baseCollaborator: Collaborator = {
  collaboratorID: "",
  collaboratorName: "",
  permission: "Can Edit",
};

/**
 * Collaborator factory for creating collaborator instances
 */
export const collaboratorFactory = new Factory<Collaborator>((overrides) => ({
  ...baseCollaborator,
  ...overrides,
}));
