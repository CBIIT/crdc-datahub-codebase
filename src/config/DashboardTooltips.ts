/**
 * Object containing static content that will be used as
 * text within a tooltip. This is for tooltips within the
 * Data Submission Dashboard only.
 */
export const TOOLTIP_TEXT = {
  FILE_UPLOAD: {
    UPLOAD_METADATA:
      "The metadata uploaded will be compared with existing data within the submission. All new data will be added to the submission, including updates to existing information.",
    UPLOAD_CLI_VERSION:
      "Please ensure your Uploader CLI tool is updated to the latest version. Download it again if needed.",
  },
  VALIDATION_CONTROLS: {
    VALIDATION_TYPE: {
      VALIDATE_METADATA:
        "Run validations on any metadata submission templates that have been uploaded.",
      VALIDATE_DATA_FILES: "Run validations on any data files that have been uploaded.",
      VALIDATE_BOTH:
        "Run validations on both data files and metadata submission templates that have been uploaded.",
    },
    VALIDATION_TARGET: {
      NEW_UPLOADED_DATA: "Run validations only on files that have not previously been validated.",
      ALL_UPLOADED_DATA: "Run validations on all files regardless of previous validations.",
    },
  },
  SUBMISSION_ACTIONS: {
    RELEASE: {
      DISABLED: {
        NO_CROSS_VALIDATION:
          "Multiple active data submissions detected for the same study. Please run cross-validation before releasing each submission individually.",
      },
    },
    SUBMIT: {
      DISABLED: {
        EMPTY_SUBMISSION: "Empty submission - no data has been uploaded yet.",
        VALIDATION_RUNNING:
          "Validation is in progress. Please wait until it completes and address any issues before submitting.",
        NEW_DATA_OR_VALIDATION_ERRORS:
          "There are new data entries or validation issues that need to be resolved.",
        MISSING_DATA_FILE:
          "There are no data files for this submission. Please upload the appropriate data files and validate to enable the Submit button.",
        BATCH_IS_UPLOADING:
          "There are ongoing batch uploads. Please wait for the upload to complete.",
      },
      ENABLED: "Submit the data to CRDC for review and inclusion in a data commons.",
    },
    WITHDRAW: {
      ENABLED: "Withdraw will reverse the submission and control will return to the Submitter.",
    },
  },
  COLLABORATORS_DIALOG: {
    PERMISSIONS: {
      CAN_VIEW: "Grant the collaborator view access to this data submission.",
      CAN_EDIT: "Grant the collaborator edit access to this data submission.",
    },
    ACTIONS: {
      ADD_COLLABORATOR_DISABLED:
        "Unable to add a collaborator at this time. No submitters are available to collaborate with.",
    },
  },
  QUALITY_CONTROL: {
    TABLE: {
      CLICK_TO_VIEW_ALL_ISSUES: "Click to view all issues for this record.",
    },
  },
} as const;

export type TooltipText = typeof TOOLTIP_TEXT;
