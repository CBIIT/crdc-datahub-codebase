import { MockedFunction } from "vitest";

import { TOOLTIP_TEXT } from "@/config/DashboardTooltips";
import { userFactory } from "@/factories/auth/UserFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { SUBMIT_BUTTON_CONDITIONS, SubmitButtonCondition } from "../config/SubmitButtonConfig";

import * as utils from "./dataSubmissionUtils";
import { ReleaseInfo } from "./dataSubmissionUtils";

const baseSubmission: Submission = submissionFactory.build({
  _id: "1234",
  name: "test123",
  submitterID: "1",
  submitterName: "User",
  organization: undefined,
  status: "In Progress",
  otherSubmissions: null,
  validationType: ["metadata", "file"],
  dataFileSize: {
    formatted: "",
    size: 1000,
  },
});

const baseUser: User = userFactory.build({
  _id: "current-user",
  role: "Submitter",
  permissions: ["data_submission:create"],
});

describe("General Submit", () => {
  it("should disable submit without isAdminOverride when Submission status is 'New'", () => {
    const submission: Submission = {
      ...baseSubmission,
      status: "New",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );

    expect(result._identifier).toBe("Submission should not be 'New' status");
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit without isAdminOverride when user does not have the admin submit permission but there are validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Error",
      fileValidationStatus: "Error",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when metadata passed but files has validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Error",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when files passed but metadata has validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Error",
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when metadata validation is "Warning" and file validation is "Error"', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Warning",
      fileValidationStatus: "Error",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when metadata validation is "Error" and file validation is "Warning"', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Error",
      fileValidationStatus: "Warning",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should allow submit when metadata validation is "Passed" and is "Metadata Only" dataType', () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not disable submit when user role is not Admin and there are no validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when metadata validation is null", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when data file size is 0", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
      dataFileSize: {
        formatted: "",
        size: 0,
      },
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should enable submit when file validation is null and intention is 'Delete'", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
      intention: "Delete",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when data file size is 0 and intention is 'New/Update'", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
      intention: "New/Update",
      dataFileSize: {
        formatted: "",
        size: 0,
      },
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when metadata validation is null and intention is 'Delete'", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: "Passed",
      intention: "Delete",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when metadata validation is null, file validation has error, and intention is 'Delete'", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: "Error",
      intention: "Delete",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit when both metadata validation and file validation are null", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: null,
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when both validations are in "Validating" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Validating",
      fileValidationStatus: "Validating",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when metadata validation is in "Validating" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Validating",
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when file validation is in "Validating" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Validating",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when both validations are in "New" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "New",
      fileValidationStatus: "New",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when metadata validation is in "New" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "New",
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should disable submit when file validation is in "New" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "New",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should allow submit when there are validation warnings", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Warning",
      fileValidationStatus: "Warning",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should allow submit when both validations are in "Passed" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Passed",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should allow submit when metadata validations is in "Passed" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Warning",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it('should allow submit when both validations are in "Warning" state', () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Warning",
      fileValidationStatus: "Warning",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should supply a tooltip when allowing submit without override", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Warning",
      fileValidationStatus: "Warning",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      baseUser
    );

    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
    expect(result.tooltip).toBe(TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.ENABLED);
  });

  it("should disable submit when submission is null", () => {
    const result = utils.shouldEnableSubmit(null, baseUser);
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });
});

describe("Admin Submit", () => {
  it("should not supply a tooltip with admin override", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Error",
      fileValidationStatus: "Error",
    };
    const user: User = {
      ...baseUser,
      role: "Admin",
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );

    expect(result.isAdminOverride).toBe(true);
    expect(result.tooltip).not.toBeDefined();
  });

  it("should allow admin override with validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Error",
      fileValidationStatus: "Error",
    };
    const user: User = {
      ...baseUser,
      role: "Admin",
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(true);
  });

  it("should enable submit without admin override when there are no validation errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Passed",
    };
    const user: User = {
      ...baseUser,
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not allow admin override when metadata is passed but dataFileSize is null", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
      dataFileSize: null,
    };
    const user: User = {
      ...baseUser,
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not enable submit when both validations are null", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: null,
    };
    const user: User = {
      ...baseUser,
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(false);
  });

  it("should allow admin override when file validation is null and intention is 'Delete'", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Error",
      fileValidationStatus: null,
      intention: "Delete",
    };
    const user: User = {
      ...baseUser,
      role: "Admin",
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(true);
  });

  it("should not allow submit with isAdminOverride when Submission level errors exist", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: null,
      fileValidationStatus: "Error",
      fileErrors: [
        qcResultFactory.build({
          submissionID: "123",
          type: "",
          validationType: "data file",
          uploadedDate: "",
          batchID: "",
          displayID: 1,
          errors: [],
          warnings: [],
          severity: "Error",
          submittedID: "123",
          validatedDate: "",
        }),
      ],
    };
    const user: User = {
      ...baseUser,
      role: "Admin",
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not allow submitter to submit when Submission has orphaned file errors", () => {
    const submission: Submission = {
      ...baseSubmission,
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Passed",
      fileErrors: [
        qcResultFactory.build({
          submissionID: "123",
          type: "",
          validationType: "data file",
          uploadedDate: "",
          batchID: "",
          displayID: 1,
          errors: [],
          warnings: [],
          severity: "Error",
          submittedID: "123",
          validatedDate: "",
        }),
      ],
    };

    const result = utils.shouldEnableSubmit(
      {
        getSubmission: submission,
        getSubmissionAttributes: {
          submissionAttributes: { hasOrphanError: true, isBatchUploading: false },
        },
        submissionStats: null,
      },
      baseUser
    );
    expect(result._identifier).toBe("Submission should not have orphaned files");
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should allow submit with isAdminOverride when metadata validation is 'Error', file validation is null, and intention is 'Delete'", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Error",
      fileValidationStatus: null,
      intention: "Delete",
    };
    const user: User = {
      ...baseUser,
      role: "Admin",
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(true);
  });

  it("should disable submit if user is Admin and required condition fails", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata and Data Files",
      metadataValidationStatus: "Passed",
      fileValidationStatus: "New",
    };
    const user: User = {
      ...baseUser,
      permissions: ["data_submission:view", "data_submission:admin_submit"],
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },
      user
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });
});

describe("Submit > Submission Type/Intention", () => {
  it("should disable submit without isAdminOverride when intention is Delete", () => {
    const submission: Submission = {
      ...baseSubmission,
      intention: "Delete",
      metadataValidationStatus: "Error",
      fileValidationStatus: "Error",
    };
    const result = utils.shouldEnableSubmit(
      { getSubmission: submission, getSubmissionAttributes: null, submissionStats: null },

      baseUser
    );
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });
});

describe("shouldAllowAdminOverride", () => {
  beforeEach(() => {
    const customConditions: SubmitButtonCondition[] = [
      {
        _identifier: "test-identifier-1",
        preConditionCheck: ({ getSubmission: s }) => s._id === "test-id-1",
        check: ({ getSubmission: s }) => s.name === "test-name-1",
        required: true,
      },
      {
        _identifier: "test-identifier-2",
        preConditionCheck: ({ getSubmission: s }) => s._id === "test-id-2",
        check: ({ getSubmission: s }) => s.name === "test-name-2",
        required: true,
      },
    ];

    // Push the custom conditions for the test
    customConditions.forEach((condition) => SUBMIT_BUTTON_CONDITIONS.push(condition));
  });

  afterEach(() => {
    // Restore original ADMIN_OVERRIDE_CONDITIONS
    SUBMIT_BUTTON_CONDITIONS.splice(-2, 2);
  });

  it("should disable submit without isAdminOverride when submission is null", () => {
    const result = utils.shouldAllowAdminOverride(null);
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should disable submit without isAdminOverride when submission is undefined", () => {
    const result = utils.shouldAllowAdminOverride(undefined);
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should check condition if preConditionCheck is met", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Error",
      fileValidationStatus: null,
    };
    const result = utils.shouldAllowAdminOverride({
      getSubmission: submission,
      getSubmissionAttributes: null,
      submissionStats: null,
    });
    expect(result._identifier).toBe("Admin Override - Submission has validation errors");
    expect(result.enabled).toBe(true);
    expect(result.isAdminOverride).toBe(true);
  });

  it("should skip condition if preConditionCheck is not met", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata Only",
      metadataValidationStatus: "Passed",
      fileValidationStatus: null,
    };
    const result = utils.shouldAllowAdminOverride({
      getSubmission: submission,
      getSubmissionAttributes: null,
      submissionStats: null,
    });
    expect(result._identifier).toBe(undefined);
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not allow admin override if a required condition is not met", () => {
    const submission: Submission = {
      ...baseSubmission,
      dataType: "Metadata and Data Files",
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Validating",
    };
    const result = utils.shouldAllowAdminOverride({
      getSubmission: submission,
      getSubmissionAttributes: null,
      submissionStats: null,
    });
    expect(result._identifier).toBe("Validation should not currently be running");
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });

  it("should not allow admin override if preConditionCheck is met but main condition fails", () => {
    const submission: Submission = {
      ...baseSubmission,
      _id: "test-id-1",
      name: "test-name-fail",
      dataType: "Metadata and Data Files",
      metadataValidationStatus: "Passed",
      fileValidationStatus: "Passed",
    };

    const result = utils.shouldAllowAdminOverride({
      getSubmission: submission,
      getSubmissionAttributes: null,
      submissionStats: null,
    });
    expect(result._identifier).toBe("test-identifier-1");
    expect(result.enabled).toBe(false);
    expect(result.isAdminOverride).toBe(false);
  });
});

describe("unpackQCResultSeverities cases", () => {
  const baseResult = qcResultFactory.build({
    validationType: "" as QCResult["validationType"],
    // NOTE: This is intentionally invalid and should break the tests if used
    // by the unpackQCResultSeverities function
    severity: "SHOULD NOT BE USED" as QCResult["severity"],
  });

  it("should unpack errors and warnings into separate results", () => {
    const errors: ErrorMessage[] = errorMessageFactory.build(2, (index) => ({
      title: `error${index + 1}`,
    }));
    const warnings: ErrorMessage[] = errorMessageFactory.build(2, (index) => ({
      title: `warning${index + 1}`,
    }));

    const results: QCResult[] = [{ ...baseResult, errors, warnings }];

    const unpackedResults = utils.unpackValidationSeverities(results);

    expect(unpackedResults.length).toEqual(4);
    expect(unpackedResults).toEqual([
      { ...baseResult, severity: "Error", errors: [errors[0]], warnings: [] },
      { ...baseResult, severity: "Error", errors: [errors[1]], warnings: [] },
      {
        ...baseResult,
        severity: "Warning",
        errors: [],
        warnings: [warnings[0]],
      },
      {
        ...baseResult,
        severity: "Warning",
        errors: [],
        warnings: [warnings[1]],
      },
    ]);
  });

  it("should return an array with the same length as errors.length + warnings.length", () => {
    const errors: ErrorMessage[] = errorMessageFactory.build(999, (index) => ({
      title: `error${index + 1}`,
    }));
    const warnings: ErrorMessage[] = errorMessageFactory.build(999, (index) => ({
      title: `warning${index + 1}`,
    }));
    const results: QCResult[] = [{ ...baseResult, errors, warnings }];

    expect(utils.unpackValidationSeverities(results).length).toEqual(1998);
  });

  it("should unpack an array of only warnings", () => {
    const warnings: ErrorMessage[] = errorMessageFactory.build(2, (index) => ({
      title: `warning${index + 1}`,
    }));
    const results: QCResult[] = [{ ...baseResult, errors: [], warnings }];

    const unpackedResults = utils.unpackValidationSeverities(results);

    expect(unpackedResults.length).toEqual(2);
    expect(unpackedResults).toEqual([
      {
        ...baseResult,
        severity: "Warning",
        errors: [],
        warnings: [warnings[0]],
      },
      {
        ...baseResult,
        severity: "Warning",
        errors: [],
        warnings: [warnings[1]],
      },
    ]);
  });

  it("should unpack an array of only errors", () => {
    const errors: ErrorMessage[] = errorMessageFactory.build(2, (index) => ({
      title: `error${index + 1}`,
    }));
    const results: QCResult[] = [{ ...baseResult, errors, warnings: [] }];

    const unpackedResults = utils.unpackValidationSeverities(results);

    expect(unpackedResults.length).toEqual(2);
    expect(unpackedResults).toEqual([
      { ...baseResult, severity: "Error", errors: [errors[0]], warnings: [] },
      { ...baseResult, severity: "Error", errors: [errors[1]], warnings: [] },
    ]);
  });

  it("should handle a large array of QCResults", () => {
    const errors: ErrorMessage[] = errorMessageFactory.build(10, (index) => ({
      title: `error${index + 1}`,
    }));
    const warnings: ErrorMessage[] = errorMessageFactory.build(5, (index) => ({
      title: `warning${index + 1}`,
    }));
    const results: QCResult[] = new Array(10000).fill({
      ...baseResult,
      errors,
      warnings,
    });

    const unpackedResults = utils.unpackValidationSeverities(results);

    // 10 errors and 5 warnings per result with 10K results, 150K total
    expect(unpackedResults.length).toEqual(150000);
    expect(unpackedResults.filter((result) => result.severity === "Error").length).toEqual(100000);
    expect(unpackedResults.filter((result) => result.severity === "Warning").length).toEqual(50000);
  });

  it("should return an empty array when given an empty array", () => {
    expect(utils.unpackValidationSeverities([])).toEqual([]);
  });

  it("should return an empty array when there are no errors or warnings", () => {
    const results = [{ ...baseResult, errors: [], warnings: [] }];
    expect(utils.unpackValidationSeverities(results)).toEqual([]);
  });
});

describe("downloadBlob cases", () => {
  const mockSetAttribute = vi.fn();
  const mockClick = vi.fn();
  const mockRemove = vi.fn();

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob-url");

    // Spy on document.createElement calls and override the return value
    vi.spyOn(document, "createElement").mockReturnValue({
      ...document.createElement("a"),
      setAttribute: mockSetAttribute,
      click: mockClick,
      remove: mockRemove,
    }) as MockedFunction<typeof document.createElement>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should create a ObjectURL with the file content blob", () => {
    const content = "test,csv,content\n1,2,3";
    const contentType = "text/csv";

    utils.downloadBlob(content, "blob.csv", contentType);

    expect(URL.createObjectURL).toHaveBeenCalledWith(new Blob([content], { type: contentType }));
  });

  it("should create a anchor with the href and download properties", () => {
    const filename = "test.txt";

    utils.downloadBlob("test content", filename, "text/plain");

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockSetAttribute).toHaveBeenCalledWith("href", "blob-url");
    expect(mockSetAttribute).toHaveBeenCalledWith("download", filename);
  });

  it("should open the download link and remove itself from the DOM", () => {
    utils.downloadBlob("test,content,csv", "test-file.csv", "text/csv");

    expect(mockClick).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });
});

describe("shouldDisableRelease", () => {
  it("should allow release without alert when there are no other submissions and cross validation has not run", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: null,
      otherSubmissions: JSON.stringify({
        "In Progress": [],
        Submitted: [],
        Released: [],
        Rejected: [],
        Withdrawn: [],
      }),
    });

    expect(result.disable).toBe(false);
    expect(result.requireAlert).toBe(false);
  });

  it.each<SubmissionStatus>(["In Progress", "Rejected", "Withdrawn"])(
    "should allow release with alert when other submissions are %s and there are no related submissions",
    (status) => {
      const existingSubmissions = ["ABC-123", "XYZ-456"];
      const result: ReleaseInfo = utils.shouldDisableRelease({
        ...baseSubmission,
        crossSubmissionStatus: null,
        otherSubmissions: JSON.stringify({
          "In Progress": status === "In Progress" ? existingSubmissions : [],
          Submitted: [],
          Released: [],
          Rejected: status === "Rejected" ? existingSubmissions : [],
          Withdrawn: status === "Withdrawn" ? existingSubmissions : [],
        }),
      });

      expect(result.disable).toBe(false);
      expect(result.requireAlert).toBe(true);
    }
  );

  it.each<CrossSubmissionStatus>(["Passed"])(
    "should allow release when crossSubmissionStatus is %s even if other submissions exist",
    (status) => {
      const result: ReleaseInfo = utils.shouldDisableRelease({
        ...baseSubmission,
        crossSubmissionStatus: status,
        otherSubmissions: JSON.stringify({
          "In Progress": ["ABC-123", "XYZ-456"],
          Submitted: ["DEF-456", "GHI-789"],
          Released: ["JKL-012", "MNO-345"],
          Rejected: ["PQR-678", "STU-901"],
          Withdrawn: ["VWX-234", "YZA-567"],
        }),
      });

      expect(result.disable).toBe(false);
      expect(result.requireAlert).toBe(false);
    }
  );

  it.each<CrossSubmissionStatus>([
    null,
    "New",
    "Validating",
    "Error",
    "fake status" as CrossSubmissionStatus,
  ])(
    "should not allow release when crossSubmissionStatus is %s and other submissions exist",
    (status) => {
      const result: ReleaseInfo = utils.shouldDisableRelease({
        ...baseSubmission,
        crossSubmissionStatus: status,
        otherSubmissions: JSON.stringify({
          "In Progress": ["ABC-123", "XYZ-456"],
          Submitted: ["DEF-456", "GHI-789"],
          Released: ["JKL-012", "MNO-345"],
          Rejected: ["PQR-678", "STU-901"],
          Withdrawn: ["VWX-234", "YZA-567"],
        }),
      });

      expect(result.disable).toBe(true);
      expect(result.requireAlert).toBe(false);
    }
  );

  it("should not allow release when cross validation has not run and there are Submitted submissions", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: null,
      otherSubmissions: JSON.stringify({
        "In Progress": ["ABC-123", "XYZ-456"],
        Submitted: ["JKL-012", "MNO-345"],
        Released: null,
        Rejected: [],
        Withdrawn: [],
      }),
    });

    expect(result.disable).toBe(true);
    expect(result.requireAlert).toBe(false);
  });

  it("should not allow release when cross validation has not run and there are Released submissions", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: null,
      otherSubmissions: JSON.stringify({
        "In Progress": ["ABC-123", "XYZ-456"],
        Submitted: null,
        Released: ["JKL-012", "MNO-345"],
        Rejected: [],
        Withdrawn: [],
      }),
    });

    expect(result.disable).toBe(true);
    expect(result.requireAlert).toBe(false);
  });

  it("should not throw an exception when Submission is null", () => {
    expect(() => utils.shouldDisableRelease(null as Submission)).not.toThrow();
  });

  it("should not allow release when cross validation status is 'Error' and there are no Submitted/Released submissions", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: "Error",
      otherSubmissions: null,
    });

    expect(result.disable).toBe(true);
    expect(result.requireAlert).toBe(false);
  });

  it("should not allow release without alert when cross validation status is 'Error' and there are In-Progress submissions", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: "Error",
      otherSubmissions: JSON.stringify({
        "In Progress": ["ABC-123", "XYZ-456"],
        Submitted: null,
        Released: [],
        Rejected: [],
        Withdrawn: [],
      }),
    });

    expect(result.disable).toBe(true);
    expect(result.requireAlert).toBe(false);
  });

  it("should allow release without alert when cross validation status is 'Passed' and there are In-Progress submissions", () => {
    const result: ReleaseInfo = utils.shouldDisableRelease({
      ...baseSubmission,
      crossSubmissionStatus: "Passed",
      otherSubmissions: JSON.stringify({
        "In Progress": ["ABC-123", "XYZ-456"],
        Submitted: null,
        Released: [],
        Rejected: [],
        Withdrawn: [],
      }),
    });

    expect(result.disable).toBe(false);
    expect(result.requireAlert).toBe(false);
  });
});
