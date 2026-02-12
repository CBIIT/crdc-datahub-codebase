import { hasPermission } from "../config/AuthPermissions";

/**
 * Translates the Validation Type radio to an array of types to validate.
 *
 * @param validationType The validation type selected.
 * @returns The array of types to validate.
 */
export const getValidationTypes = (validationType: ValidationType | "All"): ValidationType[] => {
  switch (validationType) {
    case "metadata":
      return ["metadata"];
    case "file":
      return ["file"];
    default:
      return ["metadata", "file"];
  }
};

/**
 * Determines the default "Validation Type" for the given data submission.
 *
 * @param dataSubmission The data submission to get the default validation type for.
 * @param user The current user.
 * @param permissionMap The map of permissions for each submission status.
 * @returns The default validation type for the given data submission.
 */
export const getDefaultValidationType = (
  dataSubmission: Submission,
  user: User
): ValidationType | "All" => {
  const { status, metadataValidationStatus, fileValidationStatus } = dataSubmission || {};

  if (
    status === "Submitted" &&
    hasPermission(user, "data_submission", "review", dataSubmission) &&
    metadataValidationStatus &&
    fileValidationStatus
  ) {
    return "All";
  }
  if (metadataValidationStatus !== null) {
    return "metadata";
  }
  if (fileValidationStatus !== null) {
    return "file";
  }

  return "metadata";
};

/**
 * Determines the default Validation Target.
 *
 * @param dataSubmission The data submission to get the default validation type for.
 * @param user The current user.
 * @param permissionMap The map of permissions for each submission status.
 */
export const getDefaultValidationTarget = (
  dataSubmission: Submission,
  user: User
): ValidationTarget => {
  const { status } = dataSubmission || {};

  if (status === "Submitted" && hasPermission(user, "data_submission", "review", dataSubmission)) {
    return "All";
  }

  return "New";
};
