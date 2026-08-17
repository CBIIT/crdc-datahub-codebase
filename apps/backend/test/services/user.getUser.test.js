const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');
const ERROR = require('../../constants/error-constants');
const { verifySession } = require('../../verifier/user-info-verifier');
const { getDataCommonsDisplayNamesForUser } = require('../../utility/data-commons-remapper');

jest.mock('../../verifier/user-info-verifier', () => ({
    verifySession: jest.fn(() => ({
        verifyInitialized: jest.fn(),
    })),
}));

jest.mock('../../utility/data-commons-remapper', () => ({
    getDataCommonsDisplayNamesForUser: jest.fn((user) => ({
        ...user,
        dataCommonsDisplayNames: user.dataCommons || [],
    })),
}));

describe('UserService.getUser', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockApplicationCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;
    let context, params;

    const mockUserInfo = {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.ADMIN
    };

    const mockTargetUser = {
        _id: 'target-user-id',
        email: 'target@example.com',
        firstName: 'Target',
        lastName: 'User',
        role: USER.ROLES.USER,
        userStatus: USER.STATUSES.ACTIVE,
        studies: [{ _id: 'study-1' }],
        dataCommons: ['commons1'],
        createdAt: '2023-01-01T00:00:00Z',
        updateAt: '2023-01-01T00:00:00Z'
    };

    const mockSubmitterUser = {
        _id: 'submitter-user-id',
        email: 'submitter@example.com',
        firstName: 'Submitter',
        lastName: 'User',
        role: USER.ROLES.SUBMITTER,
        userStatus: USER.STATUSES.ACTIVE,
        studies: [{ _id: 'study-2' }],
        dataCommons: ['commons2'],
        institution: {
            _id: 'inst-123',
            name: 'Test Institution',
            status: 'Active'
        },
        createdAt: '2023-01-01T00:00:00Z',
        updateAt: '2023-01-01T00:00:00Z'
    };

    const mockApprovedStudies = [
        { _id: 'study-1', studyName: 'Study 1' },
        { _id: 'study-2', studyName: 'Study 2' }
    ];

    beforeEach(() => {
        mockUserDAO = {
            findFirst: jest.fn(),
        };

        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockApprovedStudiesService = {
            approvedStudiesCollection: {}
        };
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {
            getPermissionScope: jest.fn()
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
            mockAuthorizationService
        );
        userService.userDAO = mockUserDAO;

        verifySession.mockImplementation(() => ({
            verifyInitialized: jest.fn(),
        }));

        userService._findApprovedStudies = jest.fn().mockResolvedValue(mockApprovedStudies);
        userService.getUser = UserService.prototype.getUser.bind(userService);

        // Test context and params
        context = {
            userInfo: mockUserInfo
        };

        params = {
            userID: 'target-user-id'
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Successful scenarios', () => {
        it('should return user when user has all scope', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(verifySession).toHaveBeenCalledWith(context);
            expect(userService._getUserScope).toHaveBeenCalledWith(
                mockUserInfo,
                USER_PERMISSION_CONSTANTS.ADMIN.MANAGE_USER
            );
            expect(mockUserDAO.findFirst).toHaveBeenCalledWith({ _id: 'target-user-id' });
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(mockTargetUser.studies);
            expect(getDataCommonsDisplayNamesForUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockTargetUser,
                    studies: mockApprovedStudies,
                    institution: null
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should return submitter user with institution when user has all scope', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(mockSubmitterUser);

            // Execute
            const result = await userService.getUser({ userID: 'submitter-user-id' }, context);

            // Verify
            expect(mockUserDAO.findFirst).toHaveBeenCalledWith({ _id: 'submitter-user-id' });
            expect(getDataCommonsDisplayNamesForUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockSubmitterUser,
                    studies: mockApprovedStudies,
                    institution: mockSubmitterUser.institution
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should return user when user has role scope and user role is allowed', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: [USER.ROLES.USER, USER.ROLES.SUBMITTER]
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(mockUserDAO.findFirst).toHaveBeenCalledWith({ _id: 'target-user-id' });
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should return user when user has role scope with empty scope values', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: []
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(mockUserDAO.findFirst).toHaveBeenCalledWith({ _id: 'target-user-id' });
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should return user when user has role scope with null scope values', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(mockUserDAO.findFirst).toHaveBeenCalledWith({ _id: 'target-user-id' });
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle user with empty studies array', async () => {
            // Setup
            const userWithEmptyStudies = {
                ...mockTargetUser,
                studies: []
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(userWithEmptyStudies);
            userService._findApprovedStudies.mockResolvedValue([]);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(userService._findApprovedStudies).toHaveBeenCalledWith([]);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle user with null studies', async () => {
            // Setup
            const userWithNullStudies = {
                ...mockTargetUser,
                studies: null
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(userWithNullStudies);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(null);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle user with undefined studies', async () => {
            // Setup
            const userWithUndefinedStudies = {
                ...mockTargetUser,
                studies: undefined
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(userWithUndefinedStudies);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(undefined);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle non-submitter user with null institution', async () => {
            // Setup
            const userWithNullInstitution = {
                ...mockTargetUser,
                institution: null
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(userWithNullInstitution);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(getDataCommonsDisplayNamesForUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...userWithNullInstitution,
                    studies: mockApprovedStudies,
                    institution: null
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle submitter user with undefined institution', async () => {
            // Setup
            const submitterWithUndefinedInstitution = {
                ...mockSubmitterUser,
                institution: undefined
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(submitterWithUndefinedInstitution);

            // Execute
            const result = await userService.getUser({ userID: 'submitter-user-id' }, context);

            // Verify
            expect(getDataCommonsDisplayNamesForUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...submitterWithUndefinedInstitution,
                    studies: mockApprovedStudies,
                    institution: null
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });
    });

    describe('Permission scenarios', () => {
        it('should throw error when user has none scope', async () => {
            // Setup
            const noneScope = {
                isNoneScope: () => true,
                isAllScope: () => false,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(noneScope);

            // Execute & Verify
            await expect(userService.getUser(params, context))
                .rejects.toThrow('You do not have permission to perform this action.');
        });

        it('should throw error when user role is not in scope', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: [USER.ROLES.ADMIN, USER.ROLES.SUBMITTER]
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute & Verify
            await expect(userService.getUser(params, context))
                .rejects.toThrow('You only have limited access with the given role scope.');
        });

        it('should allow access when user role is in scope', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: [USER.ROLES.USER]
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should filter out invalid roles from scope values', async () => {
            // Setup
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scopeValues: [USER.ROLES.USER, 'INVALID_ROLE']
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });
    });

    describe('Error scenarios', () => {
        it('should throw error when session verification fails', async () => {
            const sessionError = new Error('Session verification failed');
            verifySession.mockImplementationOnce(() => ({
                verifyInitialized: jest.fn().mockImplementation(() => {
                    throw sessionError;
                }),
            }));

            await expect(userService.getUser(params, context))
                .rejects.toThrow('Session verification failed');
        });

        it('should throw error when userID is missing', async () => {
            // Setup
            const paramsWithoutUserID = {};

            // Execute & Verify
            await expect(userService.getUser(paramsWithoutUserID, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should throw error when userID is null', async () => {
            // Setup
            const paramsWithNullUserID = { userID: null };

            // Execute & Verify
            await expect(userService.getUser(paramsWithNullUserID, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should throw error when userID is undefined', async () => {
            // Setup
            const paramsWithUndefinedUserID = { userID: undefined };

            // Execute & Verify
            await expect(userService.getUser(paramsWithUndefinedUserID, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should throw error when _getUserScope fails', async () => {
            // Setup
            const scopeError = new Error('Scope error');
            userService._getUserScope = jest.fn().mockRejectedValue(scopeError);

            // Execute & Verify
            await expect(userService.getUser(params, context))
                .rejects.toThrow('Scope error');
        });

        it('should throw error when database query fails', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            const dbError = new Error('Database error');
            mockUserDAO.findFirst.mockRejectedValue(dbError);

            // Execute & Verify
            await expect(userService.getUser(params, context))
                .rejects.toThrow('Database error');
        });

        it('should throw error when _findApprovedStudies fails', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);
            const studiesError = new Error('Studies error');
            userService._findApprovedStudies = jest.fn().mockRejectedValue(studiesError);

            // Execute & Verify
            await expect(userService.getUser(params, context))
                .rejects.toThrow('Studies error');
        });
    });

    describe('User not found scenarios', () => {
        it('should return null when user is not found', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(null);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toBeNull();
        });

        it('should return null when database returns null', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(null);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toBeNull();
        });

        it('should return null when findFirst returns undefined', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(undefined);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toBeNull();
        });

    });

    describe('Edge cases', () => {
        it('should handle empty context', async () => {
            verifySession.mockImplementationOnce(() => {
                throw new Error(ERROR.NOT_LOGGED_IN);
            });

            await expect(userService.getUser(params, {}))
                .rejects.toThrow(ERROR.NOT_LOGGED_IN);
        });

        it('should handle context with null userInfo', async () => {
            verifySession.mockImplementationOnce(() => {
                throw new Error(ERROR.NOT_LOGGED_IN);
            });

            await expect(userService.getUser(params, { userInfo: null }))
                .rejects.toThrow(ERROR.NOT_LOGGED_IN);
        });

        it('should handle context with undefined userInfo', async () => {
            verifySession.mockImplementationOnce(() => {
                throw new Error(ERROR.NOT_LOGGED_IN);
            });

            await expect(userService.getUser(params, { userInfo: undefined }))
                .rejects.toThrow(ERROR.NOT_LOGGED_IN);
        });

        it('should handle empty params object', async () => {
            // Setup
            const emptyParams = {};

            // Execute & Verify
            await expect(userService.getUser(emptyParams, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should handle null params', async () => {
            // Setup
            const nullParams = null;

            // Execute & Verify
            await expect(userService.getUser(nullParams, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should handle undefined params', async () => {
            // Setup
            const undefinedParams = undefined;

            // Execute & Verify
            await expect(userService.getUser(undefinedParams, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });
    });

    describe('Integration with data commons display names', () => {
        it('should call getDataCommonsDisplayNamesForUser with correct user data', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(getDataCommonsDisplayNamesForUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockTargetUser,
                    studies: mockApprovedStudies,
                    institution: null
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should return user with dataCommonsDisplayNames', async () => {
            // Setup
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findFirst.mockResolvedValue(mockTargetUser);

            // Execute
            const result = await userService.getUser(params, context);

            // Verify
            expect(result).toHaveProperty('dataCommonsDisplayNames');
            expect(result.dataCommonsDisplayNames).toEqual(['commons1']);
        });
    });
}); 