const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');

describe('UserService.isEligibleReopenOwner', () => {
    let userService;

    beforeEach(() => {
        userService = new UserService({}, {}, {}, {}, {}, {}, 'email@test.com', 'http://test', {}, 180, {}, {}, {});
    });

    const eligibleUser = {
        role: USER.ROLES.USER,
        userStatus: USER.STATUSES.ACTIVE,
        permissions: ['submission_request:create:own'],
    };

    it('returns true for active User/Submitter with submission_request:create permission', () => {
        expect(userService.isEligibleReopenOwner(eligibleUser)).toBe(true);
        expect(userService.isEligibleReopenOwner({
            ...eligibleUser,
            role: USER.ROLES.SUBMITTER,
            permissions: [USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE],
        })).toBe(true);
        expect(userService.isEligibleReopenOwner({
            ...eligibleUser,
            permissions: ['submission_request:create:all'],
        })).toBe(true);
    });

    it('returns false for inactive users', () => {
        expect(userService.isEligibleReopenOwner({
            ...eligibleUser,
            userStatus: USER.STATUSES.INACTIVE,
        })).toBe(false);
    });

    it('returns false for ineligible roles', () => {
        expect(userService.isEligibleReopenOwner({
            ...eligibleUser,
            role: USER.ROLES.ADMIN,
        })).toBe(false);
    });

    it('returns false when create permission is missing', () => {
        expect(userService.isEligibleReopenOwner({
            ...eligibleUser,
            permissions: ['submission_request:view:own'],
        })).toBe(false);
    });

    it('returns false for null or undefined user', () => {
        expect(userService.isEligibleReopenOwner(null)).toBe(false);
        expect(userService.isEligibleReopenOwner(undefined)).toBe(false);
    });
});

describe('UserService._buildReopenListUsersMatch', () => {
    let userService;

    beforeEach(() => {
        userService = new UserService({}, {}, {}, {}, {}, {}, 'email@test.com', 'http://test', {}, 180, {}, {}, {});
    });

    it('filters to active User/Submitter with create permission', () => {
        expect(userService._buildReopenListUsersMatch()).toEqual({
            role: { $in: [USER.ROLES.USER, USER.ROLES.SUBMITTER] },
            userStatus: USER.STATUSES.ACTIVE,
            permissions: {
                $in: [
                    USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE,
                    'submission_request:create:all',
                    'submission_request:create:own',
                ],
            },
        });
    });
});
