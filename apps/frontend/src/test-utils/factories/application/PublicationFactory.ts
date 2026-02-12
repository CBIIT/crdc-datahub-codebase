import { Factory } from "../Factory";

/**
 * Base publication object
 */
export const basePublication: Publication = {
  title: "",
  DOI: "",
  pubmedID: "",
};

/**
 * Publication factory for creating publication instances
 */
export const publicationFactory = new Factory<Publication>((overrides) => ({
  ...basePublication,
  ...overrides,
}));
