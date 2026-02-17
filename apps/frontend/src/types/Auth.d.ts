type User = {
  /**
   * The UUIDv4 identifier of the user account
   */
  _id: string;
  /**
   * The user's first name
   */
  firstName: string;
  /**
   * The user's last name
   */
  lastName: string | null;
  /**
   * The current user role
   *
   * @see {@link UserRole}
   */
  role: UserRole;
  /**
   * The user's email address
   */
  email: string;
  /**
   * List of data commons that the user has access to
   */
  dataCommons: string[];
  /**
   * List of display names for the data commons that the user has access to
   *
   * @note {@link User.dataCommons}[idx] corresponds to {@link User.dataCommonsDisplayNames}[idx].
   */
  dataCommonsDisplayNames: string[];
  /**
   * List of ApprovedStudies that the user has access to
   *
   * @note Not all APIs populate this field fully, refer to the GraphQL query for available fields
   * @see {@link ApprovedStudy} for available fields
   */
  studies: Partial<ApprovedStudy>[] | null;
  /**
   * The institution the user is associated with.
   * Null if the user is not associated with an institution.
   *
   * @see {@link Institution} for available fields
   */
  institution: Pick<Institution, "_id" | "name"> | null;
  /**
   * The SSO IDP used to login
   */
  IDP: "nih" | "login.gov";
  /**
   * The current account status for the user
   */
  userStatus: "Active" | "Inactive" | "Disabled";
  /**
   * The list of permissions granted to the user
   */
  permissions: AuthPermissions[];
  /**
   * The list of notifications the user will receive
   */
  notifications: AuthNotifications[];
  /**
   * The last update date of the user object
   *
   * @note ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  updateAt: string;
  /**
   * The date of user creation
   *
   * @note ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  createdAt: string;
};

type UserRole = "User" | "Admin" | "Data Commons Personnel" | "Federal Lead" | "Submitter";

type OrgInfo = {
  orgID: string;
  orgName: string;
  status: "Active" | "Inactive";
  createdAt: string;
  updateAt: string;
};

/**
 * Represents an Organization object
 *
 * @note Since 3.2.0, this is now called `Program` visually
 */
type Organization = {
  /**
   * The UUIDv4 identifier of the organization
   */
  _id: string;
  /**
   * The name of the organization
   */
  name: string;
  /**
   * The abbreviation of the organization
   *
   * @since 3.2.0
   */
  abbreviation: string;
  /**
   * The description of the organization
   *
   * @since 3.2.0
   */
  description: string;
  /**
   * The status of the organization
   */
  status: "Active" | "Inactive";
  /**
   * The ID of the concierge assigned to the organization
   */
  conciergeID: string | null;
  /**
   * The formatted name of the concierge assigned to the organization
   */
  conciergeName: string | null;
  /**
   * The email of the concierge assigned to the organization
   */
  conciergeEmail: string | null;
  /**
   * An array of assigned studies to the organization
   */
  studies: ApprovedStudy[];
  /**
   * A flag indicating this organization is system-managed and not editable
   */
  readOnly: boolean;
  /**
   * The date of the object creation
   *
   * @note ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  createdAt: string;
  /**
   * The last update date of the object
   *
   * @note ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  updateAt: string;
};
