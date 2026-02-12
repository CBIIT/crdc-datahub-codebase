/**
 * Defines a list of valid user roles that can be assigned to a user.
 *
 * @note This list is rendered in the UI exactly as ordered here, without additional sorting.
 */
export const Roles: UserRole[] = [
  "User",
  "Submitter",
  "Data Commons Personnel",
  "Federal Lead",
  "Admin",
];

/**
 * A set of roles that are constrained to a set of studies.
 */
export const RequiresStudiesAssigned: UserRole[] = ["Submitter", "Federal Lead"];

/**
 * A set of roles that must have an institution assigned.
 */
export const RequiresInstitutionAssigned: UserRole[] = ["Submitter"];

/**
 * A set of roles that are allowed to delete other users' submission requests.
 */
export const CanDeleteOtherSubmissionRequests: UserRole[] = [
  "Admin",
  "Federal Lead",
  "Data Commons Personnel",
];

/**
 * A set of roles that are considered external users
 */
export const ExternalRoles: UserRole[] = ["User", "Submitter"];
