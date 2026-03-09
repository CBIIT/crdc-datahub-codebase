import { Factory } from "../Factory";

/**
 * Base BatchFileInfo object
 */
export const baseBatchFileInfo: BatchFileInfo = {
  filePrefix: "",
  fileName: "",
  nodeType: "",
  status: "Uploaded",
  errors: [],
  createdAt: "",
  updatedAt: "",
};

/**
 * BatchFileInfo factory for creating BatchFileInfo instances
 */
export const batchFileInfoFactory = new Factory<BatchFileInfo>((overrides) => ({
  ...baseBatchFileInfo,
  ...overrides,
}));
