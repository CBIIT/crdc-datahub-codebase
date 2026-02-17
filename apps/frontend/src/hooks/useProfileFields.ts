import { useAuthContext } from "../components/Contexts/AuthContext";
import { hasPermission } from "../config/AuthPermissions";
import {
  ExternalRoles,
  RequiresInstitutionAssigned,
  RequiresStudiesAssigned,
} from "../config/AuthRoles";

/**
 * Constrains the fields that this hook supports generating states for
 */
type EditableFields = Extends<
  keyof User,
  | "firstName"
  | "lastName"
  | "role"
  | "userStatus"
  | "studies"
  | "institution"
  | "dataCommons"
  | "permissions"
  | "notifications"
>;

/**
 * Represents a set of fields on the "User Profile" or "Edit User" page
 */
export type ProfileFields = Record<EditableFields, FieldState>;

/**
 * Represents the state of a field on the "User Profile" or "Edit User" page
 *
 * - `HIDDEN` – Not visible to the user at all
 * - `DISABLED` – Visible but not editable (locked)
 * - `UNLOCKED` – Visible and editable
 * - `READ_ONLY` – Rendered as text only
 */
export type FieldState = "HIDDEN" | "DISABLED" | "UNLOCKED" | "READ_ONLY";

/**
 * An array of fields that are visible to the viewer, regardless of their state
 */
export const VisibleFieldState: FieldState[] = ["UNLOCKED", "DISABLED"];

/**
 * Determines which profile fields are visible, editable, and disabled for the current user
 *
 * @param profileOf the user whose profile is being viewed
 * @param viewType the page where the user originated from
 * @returns a collection of profile fields
 */
const useProfileFields = (
  profileOf: Pick<User, "_id" | "role">,
  viewType: "users" | "profile"
): Readonly<Partial<ProfileFields>> => {
  const { user } = useAuthContext();
  const canManage = hasPermission(user, "user", "manage");

  const isSelf: boolean = user?._id === profileOf?._id;
  const fields: ProfileFields = {
    firstName: "READ_ONLY",
    lastName: "READ_ONLY",
    role: "READ_ONLY",
    userStatus: "READ_ONLY",
    dataCommons: "HIDDEN",
    studies: "HIDDEN",
    institution: "HIDDEN",
    permissions: "HIDDEN",
    notifications: "HIDDEN",
  };

  // Editable for the current user viewing their own profile
  if (isSelf && viewType === "profile") {
    fields.firstName = "UNLOCKED";
    fields.lastName = "UNLOCKED";

    // If the profile is external, hide the permissions and notifications fields
    fields.permissions = ExternalRoles.includes(profileOf?.role) ? "HIDDEN" : "DISABLED";
    fields.notifications = ExternalRoles.includes(profileOf?.role) ? "HIDDEN" : "DISABLED";

    // If the profile requires studies, show a textual representation of the studies field
    fields.studies = RequiresStudiesAssigned.includes(profileOf?.role) ? "READ_ONLY" : "HIDDEN";

    // If the profile requires institution, show a textual representation of the institution field
    fields.institution = RequiresInstitutionAssigned.includes(profileOf?.role)
      ? "READ_ONLY"
      : "HIDDEN";
  }

  // Editable for user with permission to Manage Users
  if (canManage && viewType === "users") {
    fields.role = user?.role === "Federal Lead" ? "DISABLED" : "UNLOCKED";
    fields.userStatus = "UNLOCKED";
    fields.permissions = "UNLOCKED";
    fields.notifications = "UNLOCKED";

    // Editable for users with manage permission
    fields.studies = RequiresStudiesAssigned.includes(profileOf?.role) ? "UNLOCKED" : "HIDDEN";
    fields.institution = RequiresInstitutionAssigned.includes(profileOf?.role)
      ? "UNLOCKED"
      : "HIDDEN";
  }

  // Only applies to Data Commons Personnel
  if (profileOf?.role === "Data Commons Personnel") {
    fields.dataCommons = canManage && viewType === "users" ? "UNLOCKED" : "READ_ONLY";
  } else {
    fields.dataCommons = "HIDDEN";
  }

  return fields;
};

export default useProfileFields;
