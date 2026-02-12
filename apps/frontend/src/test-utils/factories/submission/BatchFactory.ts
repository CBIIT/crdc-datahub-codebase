import { Factory } from "../Factory";

/**
 * Base batch object
 */
export const baseBatch: Batch = {
  _id: "",
  displayID: 0,
  submissionID: "",
  type: "metadata",
  fileCount: 0,
  files: [],
  status: "Uploaded",
  errors: [],
  createdAt: "",
  updatedAt: "",
};

/**
 * Batch factory for creating batch instances
 */
export const batchFactory = new Factory<Batch>((overrides) => ({
  ...baseBatch,
  ...overrides,
}));
