import { Factory } from "../Factory";

/**
 * Base repository object
 */
export const baseRepository: Repository = {
  name: "",
  studyID: "",
  dataTypesSubmitted: [],
};

/**
 * Repository factory for creating repository instances
 */
export const repositoryFactory = new Factory<Repository>((overrides) => ({
  ...baseRepository,
  ...overrides,
}));
