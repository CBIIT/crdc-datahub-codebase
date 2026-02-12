import { Factory } from "../Factory";

/**
 * Base submission attributes object
 */
export const baseSubmissionAttributes: SubmissionAttributes = {
  isSubmissionStatusNew: false,
  isValidating: false,
  isBatchUploading: false,
  isValidSubmissionStatus: false,
  isValidDeleteIntention: false,
  isReadyMetadataOnly: false,
  isValidDataFileSize: false,
  isReadyMetadataDataFile: false,
  isValidationNotNew: false,
  hasOrphanError: false,
  isMetadataValidationError: false,
  isDatafileValidationError: false,
  isAdminSubmit: false,
};

/**
 * Submission attributes factory for creating submission attributes instances
 */
export const submissionAttributesFactory = new Factory<SubmissionAttributes>((overrides) => ({
  ...baseSubmissionAttributes,
  ...overrides,
}));
