import { hasPermission } from "../config/AuthPermissions";

/**
 * Submission request statuses where the review is finished.
 */
const SRFTerminalStatuses: ApplicationStatus[] = ["Approved", "Rejected"];

/**
 * Checks if the user is the applicant who owns the submission request.
 *
 * @param {User} user The current user.
 * @param {Application} application The submission request.
 * @returns {boolean} `true` if the user owns the submission request, otherwise `false`.
 */
const isSRFOwner = (user: User, application: Application): boolean =>
  Boolean(user?._id) && user._id === application.applicant?.applicantID;

/**
 * Checks if the user can view the messages on a submission request.
 *
 * @param {User} user The current user.
 * @param {Application} application The submission request.
 * @returns {boolean} `true` if the user can view the messages, otherwise `false`.
 */
export const canViewSRFMessages = (user: User, application: Application): boolean => {
  if (!user?._id || !application) {
    return false;
  }

  if (isSRFOwner(user, application)) {
    return true;
  }

  return (
    hasPermission(user, "submission_request", "view", application) ||
    hasPermission(user, "submission_request", "review", application)
  );
};

/**
 * Checks if the user can send messages on a submission request.
 *
 * @param {User} user The current user.
 * @param {Application} application The submission request.
 * @returns {boolean} `true` if the user can send messages, otherwise `false`.
 */
export const canSendSRFMessages = (user: User, application: Application): boolean => {
  if (!user || !application) {
    return false;
  }

  if (isSRFOwner(user, application)) {
    return true;
  }

  return hasPermission(user, "submission_request", "review", application);
};

/**
 * Checks if a submission request's conversation is closed to new messages.
 *
 * @param {Application} application The submission request.
 * @returns {boolean} `true` if the conversation is read-only, otherwise `false`.
 */
export const isSRFConversationClosed = (application: Application): boolean => {
  if (!SRFTerminalStatuses.includes(application?.status)) {
    return false;
  }

  return !application?.pendingConditions?.length;
};
