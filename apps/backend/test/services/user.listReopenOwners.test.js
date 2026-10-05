const { UserService } = require('../../services/user');
const {
    USER,
} = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');
const ERROR = require('../../constants/error-constants');
const { verifySession } = require('../../verifier/user-info-verifier');
const {
    REOPEN_ASSIGNABLE_ROLES,
    getSubmissionRequestCreatePermissionVariants,
} = require('../../utility/reopen-owner-utility');

jest.mock('../../verifier/user-info-verifier', () => ({
    verifySession: jest.fn(() => ({
        verifyInitialized: jest.fn(),
    })),
}));

describe('UserService.listReopenOwners', () => {
    let userService;
    let mockUserDAO,
        mockLogCollection,
        mockOrganizationCollection,
        mockNotificationsService,
        mockApplicationCollection,
        mockApprovedStudiesService,
        mockConfigurationService,
        mockInstitutionService,
        mockAuthorizationService;
    let context, params;

    const mockUserInfo = {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.ADMIN,
    };

    const mockUsers = [
        {
            _id: 'regular-user',
            email: 'user@example.com',
            firstName: 'Regular',
            lastName: 'User',
            role: USER.ROLES.USER,
            userStatus: USER.STATUSES.ACTIVE,
            permissions: ['submission_request:create:own'],
            createdAt: '2023-01-01T00:00:00Z',
            updateAt: '2023-01-01T00:00:00Z',
        },
        {
            _id: 'submitter-user',
            email: 'submitter@example.com',
            firstName: 'Submitter',
            lastName: 'User',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            permissions: ['submission_request:create:own'],
            createdAt: '2023-01-01T00:00:00Z',
            updateAt: '2023-01-01T00:00:00Z',
        },
    ];

    beforeEach(() => {
        mockUserDAO = {
            findMany: jest.fn(),
        };

        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockApprovedStudiesService = {
            approvedStudiesCollection: {},
        };
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {
            getPermissionScope: jest.fn(),
        };

        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockApplicationCollection,
            'official@email.com',
            'http://app.url',
            mockApprovedStudiesService,
            30,
            mockConfigurationService,
            mockInstitutionService,
            mockAuthorizationService,
        );
        userService.userDAO = mockUserDAO;

        verifySession.mockImplementation(() => ({
            verifyInitialized: jest.fn(),
        }));

        // Test context and params
        context = {
            userInfo: mockUserInfo,
        };

        params = {};
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Successful scenarios', () => {
        it('should return reopen eligible users in correct format', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findMany.mockResolvedValue([mockUsers[0]]);

            // Execute
            const result = await userService.listReopenOwners(params, context);

            // Verify
            expect(verifySession).toHaveBeenCalledWith(context);
            expect(userService._getUserScope).toHaveBeenCalledWith(
                mockUserInfo,
                USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.REOPEN,
            );
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: REOPEN_ASSIGNABLE_ROLES,
                userStatus: USER.STATUSES.ACTIVE,
                permissions: getSubmissionRequestCreatePermissionVariants(),
            });
            expect(result).toEqual([
                {
                    userID: 'regular-user',
                    firstName: 'Regular',
                    lastName: 'User',
                },
            ]);
        });

        it('should not limit results to the manage user role scope', async () => {
            // Setup
            const roleScopedManage = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: [USER.ROLES.FEDERAL_LEAD],
                }),
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest
                .fn()
                .mockImplementation((userInfo, permission) =>
                    permission === USER_PERMISSION_CONSTANTS.ADMIN.MANAGE_USER
                        ? Promise.resolve(roleScopedManage)
                        : Promise.resolve(allScope),
                );
            mockUserDAO.findMany.mockResolvedValue(mockUsers);

            // Execute
            const result = await userService.listReopenOwners(params, context);

            // Verify
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: REOPEN_ASSIGNABLE_ROLES,
                userStatus: USER.STATUSES.ACTIVE,
                permissions: getSubmissionRequestCreatePermissionVariants(),
            });
            expect(result.map((user) => user.userID)).toEqual([
                'regular-user',
                'submitter-user',
            ]);
        });

        it('should return empty array when no users match', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findMany.mockResolvedValue([]);

            // Execute
            const result = await userService.listReopenOwners(params, context);

            // Verify
            expect(result).toEqual([]);
        });

        it('should return empty array when findMany returns null', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findMany.mockResolvedValue(null);

            // Execute
            const result = await userService.listReopenOwners(params, context);

            // Verify
            expect(result).toEqual([]);
        });
    });

    describe('Permission scenarios', () => {
        it('should throw when reopen scope is not all scope', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);

            // Execute & Verify
            await expect(
                userService.listReopenOwners(params, context),
            ).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);

            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should throw when user has no reopen permission', async () => {
            // Setup
            const noneScope = {
                isNoneScope: () => true,
                isAllScope: () => false,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(noneScope);

            // Execute & Verify
            await expect(
                userService.listReopenOwners(params, context),
            ).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);

            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });
    });

    describe('Error scenarios', () => {
        it('should throw error when _getUserScope fails', async () => {
            // Setup
            const scopeError = new Error('Scope error');
            userService._getUserScope = jest.fn().mockRejectedValue(scopeError);

            // Execute & Verify
            await expect(
                userService.listReopenOwners(params, context),
            ).rejects.toThrow('Scope error');
        });

        it('should throw error when database query fails', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null,
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findMany.mockRejectedValue(new Error('Database error'));

            // Execute & Verify
            await expect(
                userService.listReopenOwners(params, context),
            ).rejects.toThrow('Database error');
        });
    });

    describe('Edge cases', () => {
        it('should reject unauthenticated requests with empty context', async () => {
            verifySession.mockImplementationOnce(() => {
                throw new Error(ERROR.NOT_LOGGED_IN);
            });

            await expect(userService.listReopenOwners(params, {})).rejects.toThrow(
                ERROR.NOT_LOGGED_IN,
            );
        });

        it('should reject unauthenticated requests when userInfo is null', async () => {
            verifySession.mockImplementationOnce(() => {
                throw new Error(ERROR.NOT_LOGGED_IN);
            });

            await expect(
                userService.listReopenOwners(params, { userInfo: null }),
            ).rejects.toThrow(ERROR.NOT_LOGGED_IN);
        });
    });
});

