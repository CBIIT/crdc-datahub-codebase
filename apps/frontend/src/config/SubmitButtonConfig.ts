import { GetSubmissionResp } from "../graphql";

import { TOOLTIP_TEXT } from "./DashboardTooltips";

export type SubmitButtonCondition = {
  /**
   * Internal name used to easily identify condition
   * Ex. console logging failing condition
   */
  _identifier?: string;
  /**
   * Checks the condition to determine whether the submit should be enabled.
   * If false, then submit button remains disabled. Otherwise, the current
   * condition is satisfied
   */
  check: (submission: GetSubmissionResp) => boolean;
  /**
   * Optionally checks the pre-condition to determine whether this condition
   * is applicable in the current submission state
   */
  preConditionCheck?: (submission: GetSubmissionResp) => boolean;
  /**
   * The text that will display on the tooltip for the submit button
   */
  tooltip?: string;
  /**
   * Marks the condition that must always be met regardless of user role
   */
  required?: boolean;
};

export type AdminOverrideCondition = Omit<SubmitButtonCondition, "required">;

/**
 * Configuration of conditions used to determine whether the submit button
 * should be enabled for a submission. Each condition checks a specific state
 * of the submission, and provides an optional tooltip for why the button is disabled.
 */
export const SUBMIT_BUTTON_CONDITIONS: SubmitButtonCondition[] = [
  {
    _identifier: "Submission should not be 'New' status",
    check: ({ getSubmission: s }) => s.status !== "New",
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.EMPTY_SUBMISSION,
    required: true,
  },
  {
    _identifier: "Validation should not currently be running",
    check: ({ getSubmission: s }) =>
      s.metadataValidationStatus !== "Validating" && s.fileValidationStatus !== "Validating",
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.VALIDATION_RUNNING,
    required: true,
  },
  {
    _identifier: "There should not be any batches uploading",
    check: ({ getSubmissionAttributes: attrs }) => !attrs?.submissionAttributes?.isBatchUploading,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.BATCH_IS_UPLOADING,
    required: true,
  },
  {
    // NOTE: Might be redundant, currently only 'Metadata Only' dataType is allowed for 'Delete' intention
    _identifier: "Metadata validation should be initialized for 'Delete' intention",
    preConditionCheck: ({ getSubmission: s }) => s.intention === "Delete",
    check: ({ getSubmission: s }) => !!s.metadataValidationStatus,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: true,
  },
  {
    _identifier: "Metadata validation should be initialized for 'Metadata Only' submissions",
    preConditionCheck: ({ getSubmission: s }) => s.dataType === "Metadata Only",
    check: ({ getSubmission: s }) => !!s.metadataValidationStatus,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: true,
  },
  {
    _identifier:
      "Data file size should be greater than 0 for 'Metadata and Data Files' submissions",
    preConditionCheck: ({ getSubmission: s }) => s.dataType === "Metadata and Data Files",
    check: ({ getSubmission: s }) => s.dataFileSize?.size > 0,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.MISSING_DATA_FILE,
    required: true,
  },
  {
    _identifier:
      "Metadata validation should be initialized for 'Metadata and Data Files' submissions",
    preConditionCheck: ({ getSubmission: s }) => s.dataType === "Metadata and Data Files",
    check: ({ getSubmission: s }) => !!s.metadataValidationStatus,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: true,
  },
  {
    _identifier: "Metadata and Data File should not have 'New' status",
    check: ({ getSubmission: s }) =>
      s.metadataValidationStatus !== "New" && s.fileValidationStatus !== "New",
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: true,
  },
  {
    _identifier: "Submission should not have orphaned files",
    check: ({ getSubmissionAttributes: attrs }) => !attrs?.submissionAttributes.hasOrphanError,
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: true,
  },
  {
    _identifier: "There should be no validation errors for metadata or data files",
    check: ({ getSubmission: s }) =>
      s.metadataValidationStatus !== "Error" && s.fileValidationStatus !== "Error",
    tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.DISABLED.NEW_DATA_OR_VALIDATION_ERRORS,
    required: false,
  },
];

/**
 * Configuration of conditions that determine if the submit button
 * should be enabled due to an admin override. Admin overrides ignore normal conditions
 * and allow submission to proceed under certain conditions, defined here.
 */
export const ADMIN_OVERRIDE_CONDITIONS: AdminOverrideCondition[] = [
  {
    _identifier: "Admin Override - Submission has validation errors",
    check: ({ getSubmission: s }) =>
      s.metadataValidationStatus === "Error" || s.fileValidationStatus === "Error",
    tooltip: undefined,
  },
];
