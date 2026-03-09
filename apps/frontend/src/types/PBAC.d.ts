type SubmissionRequestPermissions =
  | "submission_request:view"
  | "submission_request:create"
  | "submission_request:review"
  | "submission_request:submit"
  | "submission_request:cancel";

type DataSubmissionPermissions =
  | "data_submission:view"
  | "data_submission:create"
  | "data_submission:review"
  | "data_submission:admin_submit"
  | "data_submission:confirm"
  | "data_submission:cancel";

type DashboardPermissions = "dashboard:view";
type AccessPermissions = "access:request";
type UserPermissions = "user:manage";
type ProgramPermissions = "program:manage";
type StudyPermissions = "study:manage";
type InstitutionPermissions = "institution:manage";

type AuthPermissions =
  | SubmissionRequestPermissions
  | DataSubmissionPermissions
  | DashboardPermissions
  | AccessPermissions
  | UserPermissions
  | ProgramPermissions
  | StudyPermissions
  | InstitutionPermissions;

type SubmissionRequestNotifications =
  | "submission_request:submitted"
  | "submission_request:to_be_reviewed"
  | "submission_request:reviewed"
  | "submission_request:canceled"
  | "submission_request:expiring"
  | "submission_request:deleted"
  | "submission_request:pending_cleared"
  | "submission_request:to_be_reviewed";

type DataSubmissionNotifications =
  | "data_submission:created"
  | "data_submission:submitted"
  | "data_submission:cancelled"
  | "data_submission:withdrawn"
  | "data_submission:released"
  | "data_submission:rejected"
  | "data_submission:completed"
  | "data_submission:expiring"
  | "data_submission:deleted"
  | "data_submission:cfg_changed"
  | "data_submission:pv_requested";

type MiscNotifications =
  | "access:requested"
  | "account:inactivated"
  | "account:users_inactivated"
  | "account:disabled";

type AuthNotifications =
  | SubmissionRequestNotifications
  | DataSubmissionNotifications
  | MiscNotifications;

/**
 * Defines the default structure of a PBAC object.
 *
 * e.g. Permission or Notification
 */
type PBACDefault<T = AuthNotifications | AuthPermissions> = {
  /**
   * The unique identifier of the PBAC object.
   *
   * @example "manage:users"
   */
  _id: T;
  /**
   * The group the PBAC object belongs to.
   *
   * @example "User Management"
   */
  group: string;
  /**
   * The name of the individual PBAC setting.
   *
   * @example "Manage Users"
   */
  name: string;
  /**
   * List of permissions the current PBAC object inherits.
   *
   * @example ["submission_request:view"]
   */
  inherited: T[];
  /**
   * The sort order of the PBAC object within its group.
   */
  order: number;
  /**
   * Whether the PBAC object is checked for the role.
   */
  checked: boolean;
  /**
   * Whether the PBAC object is disabled for the role.
   */
  disabled: boolean;
};
