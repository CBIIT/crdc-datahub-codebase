const USER_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');
const {
    REOPEN_ASSIGNABLE_ROLES,
    getSubmissionRequestCreatePermissionVariants,
    hasSubmissionRequestCreatePermission,
    isEligibleReopenOwner,
} = require('../../utility/reopen-owner-utility');

const CREATE_PERMISSION = USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE;

describe('reopen-owner-utility', () => {
    describe('getSubmissionRequestCreatePermissionVariants', () => {
        it('returns base and scoped create permission variants', () => {
            expect(getSubmissionRequestCreatePermissionVariants()).toEqual([
                CREATE_PERMISSION,
                `${CREATE_PERMISSION}:all`,
                `${CREATE_PERMISSION}:own`,
            ]);
        });

        it('returns a defensive copy that does not affect internal state', () => {
            const variants = getSubmissionRequestCreatePermissionVariants();
            variants.push('mutated');
            expect(getSubmissionRequestCreatePermissionVariants()).toEqual([
                CREATE_PERMISSION,
                `${CREATE_PERMISSION}:all`,
                `${CREATE_PERMISSION}:own`,
            ]);
        });
    });

    describe('REOPEN_ASSIGNABLE_ROLES', () => {
        it('is immutable', () => {
            expect(() => REOPEN_ASSIGNABLE_ROLES.push(USER_CONSTANTS.USER.ROLES.ADMIN)).toThrow();
        });
    });

    describe('hasSubmissionRequestCreatePermission', () => {
        it.each([
            CREATE_PERMISSION,
            `${CREATE_PERMISSION}:all`,
            `${CREATE_PERMISSION}:own`,
        ])('returns true when permissions include %s', (permission) => {
            expect(hasSubmissionRequestCreatePermission({ permissions: [permission] })).toBe(true);
        });

        it('returns true when permissions are ORM objects with _id', () => {
            expect(hasSubmissionRequestCreatePermission({
                permissions: [{ _id: `${CREATE_PERMISSION}:own` }],
            })).toBe(true);
        });

        it('returns false when create permission is missing', () => {
            expect(hasSubmissionRequestCreatePermission({ permissions: ['submission_request:view'] })).toBe(false);
        });
    });

    describe('isEligibleReopenOwner', () => {
        const eligibleUser = {
            role: USER_CONSTANTS.USER.ROLES.USER,
            userStatus: USER_CONSTANTS.USER.STATUSES.ACTIVE,
            permissions: [`${CREATE_PERMISSION}:own`],
        };

        it('returns true for active User/Submitter with create permission', () => {
            expect(isEligibleReopenOwner(eligibleUser)).toBe(true);
            expect(isEligibleReopenOwner({
                ...eligibleUser,
                role: USER_CONSTANTS.USER.ROLES.SUBMITTER,
                permissions: [CREATE_PERMISSION],
            })).toBe(true);
        });

        it('returns false for inactive users, ineligible roles, or missing create permission', () => {
            expect(isEligibleReopenOwner({
                ...eligibleUser,
                userStatus: USER_CONSTANTS.USER.STATUSES.INACTIVE,
            })).toBe(false);
            expect(isEligibleReopenOwner({
                ...eligibleUser,
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
            })).toBe(false);
            expect(isEligibleReopenOwner({
                ...eligibleUser,
                permissions: ['submission_request:view:own'],
            })).toBe(false);
            expect(isEligibleReopenOwner(null)).toBe(false);
        });
    });
});
