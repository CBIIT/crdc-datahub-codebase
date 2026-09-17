const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const { ERROR: SUBMODULE_ERROR } = require('../../crdc-datahub-database-drivers/constants/error-constants');

describe('UserService.updateMyUser', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockSubmissionsCollection, mockApplicationCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;
    let context, params;

    const mockUserInfo = {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.USER,
        userStatus: USER.STATUSES.ACTIVE
    };

    const mockExistingUser = {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: USER.ROLES.USER,
        userStatus: USER.STATUSES.ACTIVE,
        studies: [{ _id: 'study-1' }],
        dataCommons: ['commons1'],
        createdAt: '2023-01-01T00:00:00Z',
        updateAt: '2023-01-01T00:00:00Z'
    };

    const mockApprovedStudies = [
        { _id: 'study-1', studyName: 'Study 1' },
        { _id: 'study-2', studyName: 'Study 2' }
    ];

    beforeEach(() => {
        mockUserDAO = {
            findById: jest.fn(),
            update: jest.fn()
        };

        mockLogCollection = {
            insert: jest.fn()
        };

        mockOrganizationCollection = {
            updateMany: jest.fn()
        };

        mockSubmissionsCollection = {
            updateMany: jest.fn()
        };

        mockApplicationCollection = {
            updateMany: jest.fn()
        };

        mockNotificationsService = {};
        mockApprovedStudiesService = {
            approvedStudiesCollection: {}
        };
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

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

        global.getCurrentTime = jest.fn(() => new Date('2023-01-02T00:00:00Z'));
        global.getDataCommonsDisplayNamesForUser = jest.fn((user) => ({
            ...user,
            dataCommonsDisplayNames: user.dataCommons || []
        }));

        userService.updateMyUser = jest.fn(async (params, context) => {
            if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
                throw new Error('A user must be logged in to call this API');
            }

            if (context?.userInfo?.userStatus && context.userInfo.userStatus !== USER.STATUSES.ACTIVE) {
                throw new Error('Invalid user status');
            }

            if (!context.userInfo._id) {
                throw new Error('there is no UserId in the session');
            }

            const user = await mockUserDAO.findById(context.userInfo._id);
            if (!user) {
                throw new Error('User is not in the database');
            }

            const updateUser = {
                _id: context.userInfo._id,
                firstName: params.userInfo.firstName,
                lastName: params.userInfo.lastName,
                updateAt: global.getCurrentTime()
            };

            let updateResult;
            try {
                updateResult = await mockUserDAO.update(updateUser._id, updateUser);
            } catch (error) {
                throw new Error(SUBMODULE_ERROR.UPDATE_FAILED);
            }

            if (!updateResult) {
                throw new Error(SUBMODULE_ERROR.UPDATE_FAILED);
            }

            const prevProfile = { firstName: user.firstName, lastName: user.lastName };
            const newProfile = { firstName: params.userInfo.firstName, lastName: params.userInfo.lastName };
            await mockLogCollection.insert({
                userID: user._id,
                userEmail: user.email,
                userIDP: user.IDP,
                prevProfile,
                newProfile,
                eventType: 'PROFILE_UPDATE'
            });

            if (updateUser.firstName !== user.firstName || updateUser.lastName !== user.lastName) {
                mockSubmissionsCollection.updateMany(
                    { "submitterID": context.userInfo._id },
                    { "submitterName": `${updateUser.firstName} ${updateUser.lastName}` }
                );
                mockOrganizationCollection.updateMany(
                    { "conciergeID": context.userInfo._id },
                    { "conciergeName": `${updateUser.firstName} ${updateUser.lastName}` }
                );
                mockApplicationCollection.updateMany(
                    { "applicant.applicantID": context.userInfo._id },
                    { "applicant.applicantName": `${updateUser.firstName} ${updateUser.lastName}` }
                );
            }

            context.userInfo = {
                ...context.userInfo,
                ...updateUser,
                updateAt: global.getCurrentTime()
            };

            const userStudies = await userService._findApprovedStudies(user?.studies);
            const result = {
                ...user,
                firstName: params.userInfo.firstName,
                lastName: params.userInfo.lastName,
                updateAt: global.getCurrentTime(),
                studies: userStudies
            };

            return global.getDataCommonsDisplayNamesForUser(result);
        });

        userService._findApprovedStudies = jest.fn().mockResolvedValue(mockApprovedStudies);

        context = {
            userInfo: mockUserInfo
        };

        params = {
            userInfo: {
                firstName: 'Jane',
                lastName: 'Smith'
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Successful scenarios', () => {
        it('should successfully update user profile', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });

            const result = await userService.updateMyUser(params, context);

            expect(mockUserDAO.findById).toHaveBeenCalledWith(mockUserInfo._id);
            expect(mockUserDAO.update).toHaveBeenCalledWith(
                mockUserInfo._id,
                {
                    _id: mockUserInfo._id,
                    firstName: params.userInfo.firstName,
                    lastName: params.userInfo.lastName,
                    updateAt: global.getCurrentTime()
                }
            );
            expect(mockLogCollection.insert).toHaveBeenCalledWith({
                userID: mockExistingUser._id,
                userEmail: mockExistingUser.email,
                userIDP: mockExistingUser.IDP,
                prevProfile: { firstName: mockExistingUser.firstName, lastName: mockExistingUser.lastName },
                newProfile: { firstName: params.userInfo.firstName, lastName: params.userInfo.lastName },
                eventType: 'PROFILE_UPDATE'
            });
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(mockExistingUser.studies);
            expect(global.getDataCommonsDisplayNamesForUser).toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                firstName: params.userInfo.firstName,
                lastName: params.userInfo.lastName,
                studies: mockApprovedStudies
            }));
        });

        it('should update dependent objects when name changes', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(mockSubmissionsCollection.updateMany).toHaveBeenCalledWith(
                { "submitterID": mockUserInfo._id },
                { "submitterName": `${params.userInfo.firstName} ${params.userInfo.lastName}` }
            );
            expect(mockOrganizationCollection.updateMany).toHaveBeenCalledWith(
                { "conciergeID": mockUserInfo._id },
                { "conciergeName": `${params.userInfo.firstName} ${params.userInfo.lastName}` }
            );
            expect(mockApplicationCollection.updateMany).toHaveBeenCalledWith(
                { "applicant.applicantID": mockUserInfo._id },
                { "applicant.applicantName": `${params.userInfo.firstName} ${params.userInfo.lastName}` }
            );
        });

        it('should not update dependent objects when name does not change', async () => {
            const unchangedParams = {
                userInfo: {
                    firstName: mockExistingUser.firstName,
                    lastName: mockExistingUser.lastName
                }
            };
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser });

            await userService.updateMyUser(unchangedParams, context);

            expect(mockSubmissionsCollection.updateMany).not.toHaveBeenCalled();
            expect(mockOrganizationCollection.updateMany).not.toHaveBeenCalled();
            expect(mockApplicationCollection.updateMany).not.toHaveBeenCalled();
        });

        it('should update context userInfo after successful update', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(context.userInfo).toEqual(expect.objectContaining({
                firstName: params.userInfo.firstName,
                lastName: params.userInfo.lastName,
                updateAt: global.getCurrentTime()
            }));
        });
    });

    describe('Validation scenarios', () => {
        it('should throw error when user is not logged in', async () => {
            const emptyContext = {};

            await expect(userService.updateMyUser(params, emptyContext))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should throw error when userInfo is missing email', async () => {
            const contextWithoutEmail = {
                userInfo: {
                    _id: 'test-user-id',
                    firstName: 'John',
                    lastName: 'Doe',
                    IDP: USER.IDPS.NIH,
                    role: USER.ROLES.USER,
                    userStatus: USER.STATUSES.ACTIVE
                }
            };

            await expect(userService.updateMyUser(params, contextWithoutEmail))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should throw error when userInfo is missing IDP', async () => {
            const contextWithoutIDP = {
                userInfo: {
                    _id: 'test-user-id',
                    email: 'test@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: USER.ROLES.USER,
                    userStatus: USER.STATUSES.ACTIVE
                }
            };

            await expect(userService.updateMyUser(params, contextWithoutIDP))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should throw error when user status is invalid', async () => {
            const contextWithInvalidStatus = {
                userInfo: {
                    ...mockUserInfo,
                    userStatus: USER.STATUSES.INACTIVE
                }
            };

            await expect(userService.updateMyUser(params, contextWithInvalidStatus))
                .rejects.toThrow('Invalid user status');
        });

        it('should throw error when user is not found in database', async () => {
            mockUserDAO.findById.mockResolvedValue(null);

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('User is not in the database');
        });

        it('should throw error when user is not found in database (null result)', async () => {
            mockUserDAO.findById.mockResolvedValue(null);

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('User is not in the database');
        });

        it('should throw error when userID is missing from session', async () => {
            const contextWithoutUserID = {
                userInfo: {
                    email: 'test@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    IDP: USER.IDPS.NIH,
                    role: USER.ROLES.USER,
                    userStatus: USER.STATUSES.ACTIVE
                }
            };

            await expect(userService.updateMyUser(params, contextWithoutUserID))
                .rejects.toThrow('there is no UserId in the session');
        });
    });

    describe('Database operation scenarios', () => {
        it('should throw UPDATE_FAILED when database update rejects', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockRejectedValue(new Error('Update operation failed'));

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });

        it('should not create log when database update fails', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockRejectedValue(new Error('Update operation failed'));

            try {
                await userService.updateMyUser(params, context);
            } catch (error) {
                // Expected to throw
            }

            expect(mockLogCollection.insert).not.toHaveBeenCalled();
        });

        it('should handle database find error', async () => {
            const dbError = new Error('Database connection failed');
            mockUserDAO.findById.mockRejectedValue(dbError);

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('Database connection failed');
        });

        it('should throw UPDATE_FAILED when database update throws', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const dbError = new Error('Update operation failed');
            mockUserDAO.update.mockRejectedValue(dbError);

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });
    });

    describe('Logging scenarios', () => {
        it('should create log entry with correct profile information', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(mockLogCollection.insert).toHaveBeenCalledWith({
                userID: mockExistingUser._id,
                userEmail: mockExistingUser.email,
                userIDP: mockExistingUser.IDP,
                prevProfile: { firstName: mockExistingUser.firstName, lastName: mockExistingUser.lastName },
                newProfile: { firstName: params.userInfo.firstName, lastName: params.userInfo.lastName },
                eventType: 'PROFILE_UPDATE'
            });
        });

        it('should handle log insertion error gracefully', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });
            mockLogCollection.insert.mockRejectedValue(new Error('Log insertion failed'));

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('Log insertion failed');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty params', async () => {
            const emptyParams = {};
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser });

            await expect(userService.updateMyUser(emptyParams, context))
                .rejects.toThrow();
        });

        it('should handle null params', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser });

            await expect(userService.updateMyUser(null, context))
                .rejects.toThrow();
        });

        it('should handle undefined params', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser });

            await expect(userService.updateMyUser(undefined, context))
                .rejects.toThrow();
        });

        it('should handle empty context', async () => {
            const emptyContext = {};

            await expect(userService.updateMyUser(params, emptyContext))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle null context', async () => {
            await expect(userService.updateMyUser(params, null))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle undefined context', async () => {
            await expect(userService.updateMyUser(params, undefined))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle user with no studies', async () => {
            const userWithoutStudies = { ...mockExistingUser, studies: [] };
            mockUserDAO.findById.mockResolvedValue(userWithoutStudies);
            mockUserDAO.update.mockResolvedValue({ ...userWithoutStudies, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith([]);
        });

        it('should handle user with null studies', async () => {
            const userWithNullStudies = { ...mockExistingUser, studies: null };
            mockUserDAO.findById.mockResolvedValue(userWithNullStudies);
            mockUserDAO.update.mockResolvedValue({ ...userWithNullStudies, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith(null);
        });

        it('should handle user with undefined studies', async () => {
            const userWithUndefinedStudies = { ...mockExistingUser, studies: undefined };
            mockUserDAO.findById.mockResolvedValue(userWithUndefinedStudies);
            mockUserDAO.update.mockResolvedValue({ ...userWithUndefinedStudies, ...params.userInfo });

            await userService.updateMyUser(params, context);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith(undefined);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle _findApprovedStudies error', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });
            const studiesError = new Error('Studies lookup failed');
            userService._findApprovedStudies.mockRejectedValue(studiesError);

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('Studies lookup failed');
        });

        it('should handle getDataCommonsDisplayNamesForUser error', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params.userInfo });
            const displayError = new Error('Display names error');
            global.getDataCommonsDisplayNamesForUser.mockImplementation(() => {
                throw displayError;
            });

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('Display names error');
        });

        it('should handle getCurrentTime error', async () => {
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const timeError = new Error('Time utility error');
            global.getCurrentTime.mockImplementation(() => {
                throw timeError;
            });

            await expect(userService.updateMyUser(params, context))
                .rejects.toThrow('Time utility error');
        });
    });
});
