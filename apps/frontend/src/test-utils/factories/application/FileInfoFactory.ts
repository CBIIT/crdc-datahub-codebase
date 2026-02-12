import { Factory } from "../Factory";

/**
 * Base file info object
 */
export const baseFileInfo: FileInfo = {
  type: "",
  extension: "",
  count: 0,
  amount: "",
};

/**
 * File info factory for creating file info instances
 */
export const fileInfoFactory = new Factory<FileInfo>((overrides) => ({
  ...baseFileInfo,
  ...overrides,
}));
