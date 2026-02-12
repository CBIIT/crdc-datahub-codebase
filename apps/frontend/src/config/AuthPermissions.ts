import { getUserPermissionExtensions, getUserPermissionKey } from "../utils/profileUtils";

import { Roles as ALL_ROLES, CanDeleteOtherSubmissionRequests, ExternalRoles } from "./AuthRoles";

/**
 * A flag indicating that no conditions, other than the user having the permission key, need to be met.
 */
const NO_CONDITIONS = "NO CONDITIONS";

type PermissionCheck<Key extends keyof Permissions> =
  | typeof NO_CONDITIONS
  | ((user: User, data: Permissions[Key]["dataType"], extensions: string[][]) => boolean);

type PermissionMap = {
  [Key in keyof Permissions]: Partial<{
    [Action in Permissions[Key]["action"]]: PermissionCheck<Key>;
  }>;
};

export type Permissions = {
  access: {
    dataType: null;
    action: "request";
  };
  dashboard: {
    dataType: null;
    action: "view";
  };
  submission_request: {
    dataType: Application | Omit<Application, "questionnaireData">;
    action: "view" | "create" | "submit" | "review" | "cancel";
  };
  data_submission: {
    dataType: Submission;
    action: "view" | "create" | "review" | "admin_submit" | "confirm" | "cancel";
  };
  user: {
    dataType: null;
    action: "manage";
  };
  program: {
    dataType: null;
    action: "manage";
  };
  study: {
    dataType: null;
    action: "manage";
  };
  institution: {
    dataType: null;
    action: "manage";
  };
};

export const PERMISSION_MAP = {
  submission_request: {
    view: NO_CONDITIONS,
    create: NO_CONDITIONS,
    submit: (user, application) => {
      const { role } = user;
      const isFormOwner = application?.applicant?.applicantID === user?._id;
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "submission_request:submit"));
      const submitStatuses: ApplicationStatus[] = ["In Progress", "Inquired"];

      if (!submitStatuses?.includes(application?.status)) {
        return false;
      }

      if (ExternalRoles.includes(role)) {
        return isFormOwner && hasPermissionKey;
      }

      return hasPermissionKey;
    },
    review: NO_CONDITIONS,
    cancel: (user, application) => {
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "submission_request:cancel"));
      if (!hasPermissionKey) {
        return false;
      }

      const isFormOwner = application?.applicant?.applicantID === user?._id;
      if (!isFormOwner && !CanDeleteOtherSubmissionRequests.includes(user?.role)) {
        return false;
      }

      const statusActionMap: Record<ApplicationStatus, UserRole[]> = {
        New: ALL_ROLES,
        "In Progress": ALL_ROLES,
        Inquired: ALL_ROLES,
        Submitted: ["Admin", "Federal Lead", "Data Commons Personnel"],
        "In Review": ["Admin", "Federal Lead", "Data Commons Personnel"],
        Canceled: ALL_ROLES,
        Deleted: ALL_ROLES,
        Approved: [],
        Rejected: [],
      };

      return statusActionMap[application?.status]?.includes(user?.role) ?? false;
    },
  },
  dashboard: {
    view: NO_CONDITIONS,
  },
  data_submission: {
    view: NO_CONDITIONS,
    create: (user, submission) => {
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "data_submission:create"));
      const isSubmissionOwner = submission?.submitterID === user?._id;
      const isCollaborator = submission?.collaborators?.some((c) => c.collaboratorID === user?._id);

      if (isCollaborator) {
        return true;
      }
      if (isSubmissionOwner && hasPermissionKey) {
        return true;
      }

      return false;
    },
    review: (user, submission) => {
      const { role, dataCommons, studies } = user;
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "data_submission:review"));

      if (role === "Federal Lead" && hasPermissionKey) {
        return studies?.some((s) => s._id === submission.studyID || s._id === "All");
      }
      if (role === "Data Commons Personnel" && hasPermissionKey) {
        return dataCommons?.some((dc) => dc === submission?.dataCommons);
      }
      if (role === "Admin" && hasPermissionKey) {
        return true;
      }

      return false;
    },
    admin_submit: (user, submission) => {
      const { role, dataCommons, studies } = user;
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "data_submission:admin_submit"));

      if (role === "Federal Lead" && hasPermissionKey) {
        return studies?.some((s) => s._id === submission.studyID || s._id === "All");
      }
      if (role === "Data Commons Personnel" && hasPermissionKey) {
        return dataCommons?.some((dc) => dc === submission?.dataCommons);
      }
      if (role === "Admin" && hasPermissionKey) {
        return true;
      }

      return false;
    },
    confirm: (user, submission) => {
      const { role, dataCommons, studies } = user;
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "data_submission:confirm"));

      if (role === "Federal Lead" && hasPermissionKey) {
        return studies?.some((s) => s._id === submission.studyID || s._id === "All");
      }
      if (role === "Data Commons Personnel" && hasPermissionKey) {
        return dataCommons?.some((dc) => dc === submission?.dataCommons);
      }
      if (role === "Admin" && hasPermissionKey) {
        return true;
      }

      return false;
    },
    cancel: (user, submission) => {
      const { role, dataCommons, studies } = user;
      const hasPermissionKey = Boolean(getUserPermissionKey(user, "data_submission:cancel"));
      const isSubmissionOwner = submission?.submitterID === user?._id;
      const isCollaborator = submission?.collaborators?.some((c) => c.collaboratorID === user?._id);

      if (isCollaborator) {
        return true;
      }
      if (role === "Submitter" && isSubmissionOwner && hasPermissionKey) {
        return true;
      }
      if (role === "Federal Lead" && hasPermissionKey) {
        return studies?.some((s) => s._id === submission.studyID || s._id === "All");
      }
      if (role === "Data Commons Personnel" && hasPermissionKey) {
        return dataCommons?.some((dc) => dc === submission?.dataCommons);
      }
      if (role === "Admin" && hasPermissionKey) {
        return true;
      }

      return false;
    },
  },
  access: {
    request: NO_CONDITIONS,
  },
  user: {
    manage: NO_CONDITIONS,
  },
  program: {
    manage: NO_CONDITIONS,
  },
  study: {
    manage: NO_CONDITIONS,
  },
  institution: {
    manage: NO_CONDITIONS,
  },
} as const satisfies PermissionMap;

/**
 * Determines if a user has the necessary permission to perform a specific action on a resource.
 *
 * @template Resource - A key of the `Permissions` type representing the resource to check.
 * @param {User} user - The user object, which contains the user's role and permissions.
 * @param {Resource} resource - The resource on which the action is being performed.
 * @param {Permissions[Resource]["action"]} action - The action to check permission for.
 * @param {Permissions[Resource]["dataType"]} [data] - Optional additional data needed for dynamic permission checks.
 * @param {boolean} onlyKey - Optional flag for checking ONLY if the user has the permission key.
 * @returns {boolean} - `true` if the user has permission, otherwise `false`.
 *
 * @example
 * // Basic permission check without additional data
 * const canCreate = hasPermission(user, "submission_request", "create");
 *
 * @example
 * // Permission check with additional data
 * const canSubmit = hasPermission(user, "submission_request", "submit", applicationData);
 */
export const hasPermission = <Resource extends keyof Permissions>(
  user: User,
  resource: Resource,
  action: Permissions[Resource]["action"],
  data?: Permissions[Resource]["dataType"],
  onlyKey?: boolean
): boolean => {
  if (!user?.role) {
    return false;
  }

  const permission = (PERMISSION_MAP as PermissionMap)?.[resource]?.[action];
  const rawPermissionKey = `${resource}:${action}`;
  const userPermissionKey = getUserPermissionKey(user, rawPermissionKey);

  // If no conditions need to be checked, just check if user has permission key
  if (onlyKey || permission === NO_CONDITIONS) {
    return Boolean(userPermissionKey);
  }

  // If permission not defined, then deny permission
  if (permission == null) {
    return false;
  }

  // Parse all additional permission extensions and group them together
  const extensions = getUserPermissionExtensions(userPermissionKey);

  // Check conditions
  return !!data && permission(user, data, extensions);
};
