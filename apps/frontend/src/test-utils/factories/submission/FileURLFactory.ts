import { Factory } from "../Factory";

/**
 * Base file URL object
 */
export const baseFileURL: FileURL = {
  fileName: "",
  signedURL: "",
};

/**
 * File URL factory for creating file URL instances
 */
export const fileURLFactory = new Factory<FileURL>((overrides) => ({
  ...baseFileURL,
  ...overrides,
}));
