import { Factory } from "../Factory";

import { batchFactory } from "./BatchFactory";

/**
 * Base new batch object
 */
export const baseNewBatch: NewBatch = {
  ...batchFactory
    .pick([
      "_id",
      "submissionID",
      "type",
      "fileCount",
      "status",
      "errors",
      "createdAt",
      "updatedAt",
    ])
    .build(),
  bucketName: null,
  filePrefix: null,
  files: [],
};

/**
 * New Batch factory for creating new batch instances
 */
export const newBatchFactory = new Factory<NewBatch>((overrides) => ({
  ...baseNewBatch,
  ...overrides,
}));
