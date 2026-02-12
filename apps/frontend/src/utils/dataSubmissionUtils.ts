import { TOOLTIP_TEXT } from "@/config/DashboardTooltips";

import { hasPermission } from "../config/AuthPermissions";
import { ADMIN_OVERRIDE_CONDITIONS, SUBMIT_BUTTON_CONDITIONS } from "../config/SubmitButtonConfig";
import { GetSubmissionResp } from "../graphql";

import { safeParse } from "./jsonUtils";

/**
 * Determines whether the submit button should be enabled based on the submission's properties and user role.
 * For admins, it first checks if an admin override is allowed. If not an admin, it checks remaining conditions
 * to determine if the submission can be enabled.
 *
 * @param data - The submission object to evaluate.
 * @param user - The current user.
 * @returns Returns an object indicating whether the submit button is enabled,
 * whether the admin override is in effect, and an optional tooltip explaining the button state.
 */
export const shouldEnableSubmit = (data: GetSubmissionResp, user: User): SubmitButtonResult => {
  if (!data?.getSubmission?._id || !user) {
    return { enabled: false, isAdminOverride: false };
  }

  // Check for potential Admin override
  const canAdminOverride = hasPermission(
    user,
    "data_submission",
    "admin_submit",
    data.getSubmission
  );
  if (canAdminOverride) {
    const adminOverrideResult = shouldAllowAdminOverride(data);
    if (adminOverrideResult.enabled) {
      return { ...adminOverrideResult };
    }
  }

  // Skip required conditions already checked if user is Admin role
  const failedCondition = SUBMIT_BUTTON_CONDITIONS.find((condition) => {
    const preConditionMet = condition.preConditionCheck ? condition.preConditionCheck(data) : true;

    // Return true if preCondition is met and main condition fails
    return preConditionMet && !condition.check(data);
  });

  // If no failed conditions, enable submit
  if (!failedCondition) {
    return {
      enabled: true,
      isAdminOverride: false,
      tooltip: TOOLTIP_TEXT.SUBMISSION_ACTIONS.SUBMIT.ENABLED,
    };
  }

  // Otherwise, disable submit and display tooltip if available
  return {
    enabled: false,
    tooltip: failedCondition.tooltip,
    isAdminOverride: false,
    _identifier: failedCondition._identifier,
  };
};

/**
 * Determines whether an admin override is allowed based on the submission's properties.
 * First, it checks if the submission passes all required conditions, which cannot be bypassed.
 * If the required conditions are met, it then checks for admin-specific conditions that
 * allow an override.
 * NOTE: It assumes the user's role is an Admin. It does NOT check this.
 *
 * @param {GetSubmissionResp} data - The submission object to evaluate.
 * @returns {SubmitButtonResult} - Returns an object indicating whether the admin override is allowed,
 * and an optional tooltip explaining why the override is not allowed.
 */
export const shouldAllowAdminOverride = (data: GetSubmissionResp): SubmitButtonResult => {
  if (!data?.getSubmission?._id) {
    return { enabled: false, isAdminOverride: false };
  }

  // Check if can bypass current conditions
  const requiredConditions = SUBMIT_BUTTON_CONDITIONS.filter((condition) => condition.required);
  const failedRequiredCondition = requiredConditions.find((condition) => {
    const preConditionMet = condition.preConditionCheck ? condition.preConditionCheck(data) : true;

    // Return true if preCondition is met and main condition fails
    return preConditionMet && !condition.check(data);
  });

  // If failed required condition, then disable submit buton and show tooltip if available
  if (failedRequiredCondition) {
    return {
      enabled: false,
      tooltip: failedRequiredCondition.tooltip,
      isAdminOverride: false,
      _identifier: failedRequiredCondition._identifier,
    };
  }

  // Check if current conditions allow for an admin override
  const overrideCondition = ADMIN_OVERRIDE_CONDITIONS.find((condition) => {
    const preConditionMet = condition.preConditionCheck ? condition.preConditionCheck(data) : true;

    // Return true if preCondition is met and main condition passes
    return preConditionMet && condition.check(data);
  });

  // If Admin override, then enable submit button with tooltip if available
  if (overrideCondition) {
    return {
      enabled: true,
      tooltip: overrideCondition.tooltip,
      isAdminOverride: true,
      _identifier: overrideCondition._identifier,
    };
  }

  // Otherwise disable submit button
  return { enabled: false, isAdminOverride: false };
};

/**
 * Unpacks the Warning and Error severities from the original normal validation or cross validation
 * result into duplicates of the original array
 *
 * @example
 *  - Original: { severity: "error", errors: [error1, error2], warnings: [warning1, warning2] }
 *  - Unpacked: [{ severity: "error", errors: [error1] }, { severity: "error", errors: [error2] }, ...
 * @param results - The validation results to unpack
 * @returns A new array of validation results
 */
export const unpackValidationSeverities = <T extends QCResult | CrossValidationResult>(
  results: T[]
): T[] => {
  const unpackedResults: T[] = [];

  // Iterate through each result and push the errors and warnings into separate results
  results.forEach(({ errors, warnings, ...result }) => {
    errors.forEach((error) => {
      unpackedResults.push({
        ...result,
        severity: "Error",
        errors: [error],
        warnings: [],
      } as T);
    });
    warnings.forEach((warning) => {
      unpackedResults.push({
        ...result,
        severity: "Warning",
        errors: [],
        warnings: [warning],
      } as T);
    });
  });

  return unpackedResults;
};

/**
 * Build a file with data and download it
 *
 * @param content file content
 * @param filename file name
 * @param contentType the content type
 * @returns void
 */
export const downloadBlob = (
  content: string | Blob | ArrayBuffer,
  filename: string,
  contentType: string
): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("download", filename);
  link.setAttribute("href", url);
  link.click();
  link.remove();
};

export type ReleaseInfo = {
  /**
   * Whether the release button should be disabled entirely
   */
  disable: boolean;
  /**
   * Whether the release button should require a special alert prior to releasing
   */
  requireAlert: boolean;
};

/**
 * Determines if a submission can be Released based on the cross-validation status and the status of
 * other submissions related to the current submission.
 *
 * @note This function DOES NOT factor these attributes into the decision, and should be handled separately:
 *    - The user's role
 *    - The submission status
 * @param submission The submission to check
 * @returns {ReleaseInfo} Whether the submission meets the cross-validation criteria to be released
 */
export const shouldDisableRelease = (submission: Submission): ReleaseInfo => {
  const { crossSubmissionStatus, otherSubmissions } = submission || {};
  const parsedSubmissions = safeParse<OtherSubmissions>(otherSubmissions);

  // Cross-validation has already occurred and passed, nothing else required
  const shortCircuitStatuses: CrossSubmissionStatus[] = ["Passed"];
  if (crossSubmissionStatus && shortCircuitStatuses.includes(crossSubmissionStatus)) {
    return { disable: false, requireAlert: false };
  }

  // Scenario 1: Cross-validation has issues, disable release entirely
  if (crossSubmissionStatus === "Error") {
    return { disable: true, requireAlert: false };
  }

  // Scenario 2: All other submissions are "In Progress", "Rejected", or "Withdrawn", allow release with alert
  const hasRelatedSubmitted = parsedSubmissions?.Submitted?.length > 0;
  const hasRelatedReleased = parsedSubmissions?.Released?.length > 0;

  const hasRelatedInProgress = parsedSubmissions?.["In Progress"]?.length > 0;
  const hasRelatedRejected = parsedSubmissions?.Rejected?.length > 0;
  const hasRelatedWithdrawn = parsedSubmissions?.Withdrawn?.length > 0;
  const allowRelatedWithAlert = hasRelatedInProgress || hasRelatedRejected || hasRelatedWithdrawn;

  if (!hasRelatedSubmitted && !hasRelatedReleased && allowRelatedWithAlert) {
    return { disable: false, requireAlert: true };
  }

  // Scenario 3: More than one other Submitted/Released submission exists, disable release entirely
  if (hasRelatedSubmitted || hasRelatedReleased) {
    return { disable: true, requireAlert: false };
  }

  // Scenario 0: No restrictions, allow release
  return { disable: false, requireAlert: false };
};
