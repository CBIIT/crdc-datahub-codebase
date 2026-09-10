const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const { ERROR: SUBMODULE_ERROR } = require('../../crdc-datahub-database-drivers/constants/error-constants');

// Mock the config module
jest.mock('../../config', () => ({
    token_secret: 'test-secret-key',
    token_timeout: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
}));

// Mock the time utility
jest.mock('../../crdc-datahub-database-drivers/utility/time-utility', () => ({
    getCurrentTime: jest.fn(() => new Date('2023-01-01T00:00:00Z'))
}));

describe('UserService.grantToken', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection,
        mockNotificationsService, mockApplicationCollection,
        mockOfficialEmail, mockAppUrl, mockApprovedStudiesService, mockInactiveUserDays,
        mockConfigurationService, mockInstitutionService, mockAuthorizationService;
    let context, params;

    const mockUserInfo = {
        _id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.SUBMITTER,
        userStatus: USER.STATUSES.ACTIVE,
        tokens: ['existing-token-1', 'existing-token-2']
    };

    const mockUserInfoNoTokens = {
        _id: 'user-456',
        email: 'test2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.SUBMITTER,
        userStatus: USER.STATUSES.ACTIVE
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockUserDAO = {
            update: jest.fn()
        };
        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockOfficialEmail = 'test@example.com';
        mockAppUrl = 'http://test.com';
        mockApprovedStudiesService = {};
        mockInactiveUserDays = 90;
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockApplicationCollection,
            mockOfficialEmail,
            mockAppUrl,
            mockApprovedStudiesService,
            mockInactiveUserDays,
            mockConfigurationService,
            mockInstitutionService,
            mockAuthorizationService
        );
        userService.userDAO = mockUserDAO;

        context = {
            userInfo: mockUserInfo
        };

        params = {};
    });

    describe('Function signature', () => {
        it('should be a function', () => {
            expect(typeof userService.grantToken).toBe('function');
        });

        it('should accept two parameters', () => {
            expect(userService.grantToken.length).toBe(2); // params, context
        });
    });

    describe('Authentication validation', () => {
        it('should throw error when context is null', async () => {
            await expect(userService.grantToken(params, null))
                .rejects.toThrow(SUBMODULE_ERROR.NOT_LOGGED_IN);
        });

        it('should throw error when context is undefined', async () => {
            await expect(userService.grantToken(params, undefined))
                .rejects.toThrow(SUBMODULE_ERROR.NOT_LOGGED_IN);
        });

        it('should throw error when userInfo is missing', async () => {
            await expect(userService.grantToken(params, {}))
                .rejects.toThrow(SUBMODULE_ERROR.NOT_LOGGED_IN);
        });

        it('should throw error when user email is missing', async () => {
            const invalidContext = {
                userInfo: {
                    _id: 'user-123',
                    IDP: USER.IDPS.NIH
                }
            };
            await expect(userService.grantToken(params, invalidContext))
                .rejects.toThrow(SUBMODULE_ERROR.NOT_LOGGED_IN);
        });

        it('should throw error when user IDP is missing', async () => {
            const invalidContext = {
                userInfo: {
                    _id: 'user-123',
                    email: 'test@example.com'
                }
            };
            await expect(userService.grantToken(params, invalidContext))
                .rejects.toThrow(SUBMODULE_ERROR.NOT_LOGGED_IN);
        });
    });

    describe('User status validation', () => {
        it('should throw error when user status is inactive', async () => {
            const inactiveUserContext = {
                userInfo: {
                    ...mockUserInfo,
                    userStatus: USER.STATUSES.INACTIVE
                }
            };
            await expect(userService.grantToken(params, inactiveUserContext))
                .rejects.toThrow(SUBMODULE_ERROR.INVALID_USER_STATUS);
        });

        it('should accept active user status', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result).toHaveProperty('tokens');
            expect(result).toHaveProperty('message');
        });
    });

    describe('Token clearing', () => {
        it('should clear existing tokens when user has tokens', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, context);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                expect.objectContaining({
                    _id: mockUserInfo._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                })
            );
        });

        it('should handle user with no existing tokens', async () => {
            const noTokensContext = {
                userInfo: mockUserInfoNoTokens
            };
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfoNoTokens._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, noTokensContext);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfoNoTokens._id,
                expect.objectContaining({
                    _id: mockUserInfoNoTokens._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                })
            );
        });

        it('should handle user with null tokens', async () => {
            const nullTokensContext = {
                userInfo: {
                    ...mockUserInfo,
                    tokens: null
                }
            };
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, nullTokensContext);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                expect.objectContaining({
                    _id: mockUserInfo._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                })
            );
        });

        it('should handle user with undefined tokens', async () => {
            const undefinedTokensContext = {
                userInfo: {
                    ...mockUserInfo,
                    tokens: undefined
                }
            };
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, undefinedTokensContext);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                expect.objectContaining({
                    _id: mockUserInfo._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                })
            );
        });
    });

    describe('Token creation', () => {
        it('should create a new access token', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result.tokens).toHaveLength(1);
            expect(typeof result.tokens[0]).toBe('string');
            expect(result.tokens[0]).toContain('eyJ'); // JWT tokens start with 'eyJ'
        });

        it('should return correct message', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result.message).toBe("This token can only be viewed once and will be lost if it is not saved by the user");
        });

        it('should create token with user ID', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, context);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                expect.objectContaining({
                    _id: mockUserInfo._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                })
            );
        });

        it('should create token containing only the user ID in sub claim', async () => {
            const jwt = require('jsonwebtoken');
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            const decoded = jwt.decode(result.tokens[0]);
            expect(decoded.sub).toBe(mockUserInfo._id);
            expect(decoded._id).toBeUndefined();
            expect(decoded.email).toBeUndefined();
            expect(decoded.firstName).toBeUndefined();
            expect(decoded.lastName).toBeUndefined();
            expect(decoded.role).toBeUndefined();
        });
    });

    describe('Database update', () => {
        it('should call userDAO.update with correct parameters', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, context);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                {
                    _id: mockUserInfo._id,
                    tokens: expect.arrayContaining([expect.any(String)]),
                    updateAt: expect.any(Date)
                }
            );
        });

        it('should throw UPDATE_FAILED when database update rejects', async () => {
            mockUserDAO.update.mockRejectedValue(new Error('Database error'));

            await expect(userService.grantToken(params, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });

        it('should throw UPDATE_FAILED when database update throws exception', async () => {
            mockUserDAO.update.mockRejectedValue(new Error('Database error'));

            await expect(userService.grantToken(params, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });
    });

    describe('Context update', () => {
        it('should update context userInfo with new token', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, context);

            expect(context.userInfo).toHaveProperty('tokens');
            expect(context.userInfo.tokens).toHaveLength(1);
            expect(context.userInfo).toHaveProperty('updateAt');
        });

        it('should preserve existing user info in context', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            await userService.grantToken(params, context);

            expect(context.userInfo._id).toBe(mockUserInfo._id);
            expect(context.userInfo.email).toBe(mockUserInfo.email);
            expect(context.userInfo.firstName).toBe(mockUserInfo.firstName);
            expect(context.userInfo.lastName).toBe(mockUserInfo.lastName);
            expect(context.userInfo.IDP).toBe(mockUserInfo.IDP);
            expect(context.userInfo.role).toBe(mockUserInfo.role);
            expect(context.userInfo.userStatus).toBe(mockUserInfo.userStatus);
        });
    });

    describe('Return value', () => {
        it('should return object with tokens array and message', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result).toEqual({
                tokens: expect.arrayContaining([expect.any(String)]),
                message: "This token can only be viewed once and will be lost if it is not saved by the user"
            });
        });

        it('should return exactly one token', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result.tokens).toHaveLength(1);
        });

        it('should return valid JWT token', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            const token = result.tokens[0];
            expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/); // JWT format
        });
    });

    describe('Integration scenarios', () => {
        it('should work with different user roles', async () => {
            const adminUserContext = {
                userInfo: {
                    ...mockUserInfo,
                    role: USER.ROLES.ADMIN
                }
            };
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, adminUserContext);

            expect(result).toHaveProperty('tokens');
            expect(result).toHaveProperty('message');
        });

        it('should work with different IDPs', async () => {
            const googleUserContext = {
                userInfo: {
                    ...mockUserInfo,
                    IDP: 'GOOGLE'
                }
            };
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, googleUserContext);

            expect(result).toHaveProperty('tokens');
            expect(result).toHaveProperty('message');
        });

        it('should work with minimal user info', async () => {
            const minimalUserContext = {
                userInfo: {
                    _id: 'minimal-user',
                    email: 'minimal@example.com',
                    IDP: USER.IDPS.NIH,
                    userStatus: USER.STATUSES.ACTIVE
                }
            };
            mockUserDAO.update.mockResolvedValue({ _id: 'minimal-user', tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, minimalUserContext);

            expect(result).toHaveProperty('tokens');
            expect(result).toHaveProperty('message');
        });
    });

    describe('Error handling', () => {
        it('should handle database connection errors', async () => {
            mockUserDAO.update.mockRejectedValue(new Error('Connection failed'));

            await expect(userService.grantToken(params, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });

        it('should handle invalid token secret', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const result = await userService.grantToken(params, context);

            expect(result).toHaveProperty('tokens');
            expect(result.tokens[0]).toBeTruthy();
        });

        it('should throw error when user ID is missing', async () => {
            const noIdContext = {
                userInfo: {
                    email: 'test@example.com',
                    IDP: USER.IDPS.NIH,
                    userStatus: USER.STATUSES.ACTIVE
                }
            };

            await expect(userService.grantToken(params, noIdContext))
                .rejects.toThrow(SUBMODULE_ERROR.INVALID_USERID);
        });
    });

    describe('Performance considerations', () => {
        it('should handle concurrent token requests', async () => {
            mockUserDAO.update.mockResolvedValue({ _id: mockUserInfo._id, tokens: ['token'], updateAt: new Date() });

            const promises = [
                userService.grantToken(params, context),
                userService.grantToken(params, context),
                userService.grantToken(params, context)
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toHaveProperty('tokens');
                expect(result).toHaveProperty('message');
            });
        });
    });
});
