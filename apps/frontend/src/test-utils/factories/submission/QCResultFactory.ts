import { Factory } from "../Factory";

/**
 * Base QC result object
 */
export const baseQCResult: QCResult = {
  submissionID: "",
  type: "",
  validationType: "metadata",
  batchID: "",
  displayID: 0,
  submittedID: "",
  severity: "Error",
  uploadedDate: "",
  validatedDate: "",
  errors: [],
  warnings: [],
  issueCount: 0,
};

/**
 * QC result factory for creating QC result instances
 */
export const qcResultFactory = new Factory<QCResult>((overrides) => ({
  ...baseQCResult,
  ...overrides,
}));
