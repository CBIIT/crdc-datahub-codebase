const USER_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-constants");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const SCOPES = require("../constants/permission-scope-constants");

const ROLES = USER_CONSTANTS.USER.ROLES;
const REOPEN_ASSIGNABLE_ROLES = Object.freeze([ROLES.USER, ROLES.SUBMITTER]);

const SUBMISSION_REQUEST_CREATE_PERMISSION_VARIANTS = Object.freeze((() => {
    const createPermission = USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE;
    return [
        createPermission,
        `${createPermission}:${SCOPES.ALL}`,
        `${createPermission}:${SCOPES.OWN}`,
    ];
})());

function getSubmissionRequestCreatePermissionVariants() {
    return [...SUBMISSION_REQUEST_CREATE_PERMISSION_VARIANTS];
}

function normalizePermissionId(permission) {
    return permission?._id ?? permission;
}

function hasSubmissionRequestCreatePermission(user) {
    const userPermissions = user?.permissions ?? [];
    return userPermissions.some((permission) =>
        SUBMISSION_REQUEST_CREATE_PERMISSION_VARIANTS.includes(normalizePermissionId(permission))
    );
}

function isEligibleReopenOwner(user) {
    if (!user || user.userStatus !== USER_CONSTANTS.USER.STATUSES.ACTIVE) {
        return false;
    }
    if (!REOPEN_ASSIGNABLE_ROLES.includes(user.role)) {
        return false;
    }
    return hasSubmissionRequestCreatePermission(user);
}

module.exports = {
    REOPEN_ASSIGNABLE_ROLES,
    getSubmissionRequestCreatePermissionVariants,
    hasSubmissionRequestCreatePermission,
    isEligibleReopenOwner,
};
