import { hasPermission } from "../config/AuthPermissions";

export type FormMode = "Unauthorized" | "Edit" | "View Only" | "Review";

export const ViewOnlyStatuses = ["Submitted", "In Review", "Approved", "Rejected"];
export const EditStatuses = ["New", "In Progress", "Inquired"];
export const ReviewStatuses = ["In Review"];
export const FormModes = {
  UNAUTHORIZED: "Unauthorized",
  EDIT: "Edit",
  VIEW_ONLY: "View Only",
  REVIEW: "Review",
} as const;

/**
 * Get updated form mode based on user permissions and form status
 *
 * @param {User} user - The current user
 * @param {Application} data - The current application/submission
 * @returns {FormMode} - Updated form mode based on role, organization role, and form status
 */
export const getFormMode = (user: User, data: Application): FormMode => {
  if (!data) {
    return FormModes.UNAUTHORIZED;
  }
  const isFormOwner = user?._id === data.applicant?.applicantID;
  if (!hasPermission(user, "submission_request", "view") && !isFormOwner) {
    return FormModes.UNAUTHORIZED;
  }

  if (
    !isFormOwner &&
    !hasPermission(user, "submission_request", "view") &&
    !hasPermission(user, "submission_request", "create") &&
    !hasPermission(user, "submission_request", "review")
  ) {
    return FormModes.UNAUTHORIZED;
  }

  if (
    hasPermission(user, "submission_request", "review") &&
    ReviewStatuses.includes(data?.status)
  ) {
    return FormModes.REVIEW;
  }

  // User is only allowed to edit their own Submission Request
  if (
    isFormOwner &&
    hasPermission(user, "submission_request", "create") &&
    EditStatuses.includes(data?.status)
  ) {
    return FormModes.EDIT;
  }

  return FormModes.VIEW_ONLY;
};
