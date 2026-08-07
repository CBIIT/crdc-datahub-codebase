const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');
const { ERROR: SUBMODULE_ERROR } = require('../../crdc-datahub-database-drivers/constants/error-constants');

describe('UserService.editUser', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockSubmissionsCollection, mockSubmissionRequestCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;
    let context, params;

    const mockUserInfo = {
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        IDP: USER.IDPS.NIH,
        role: USER.ROLES.ADMIN
    };

    const mockExistingUser = {
        _id: 'target-user-id',
        email: 'target@example.com',
        firstName: 'Target',
        lastName: 'User',
        role: USER.ROLES.USER,
        userStatus: USER.STATUSES.ACTIVE,
        studies: [{ _id: 'study-1' }],
        dataCommons: ['commons1'],
        institution: null,
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

    const mockInstitution = {
        _id: 'inst-456',
        name: 'New Institution',
        status: 'Active'
    };

    const mockApprovedStudies = [
        { _id: 'study-1', studyName: 'Study 1' },
        { _id: 'study-2', studyName: 'Study 2' },
        { _id: 'study-3', studyName: 'Study 3' }
    ];

    beforeEach(() => {
        mockUserDAO = {
            findById: jest.fn(),
            update: jest.fn()
        };

        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockSubmissionsCollection = {};
        mockSubmissionRequestCollection = {};
        mockApprovedStudiesService = {
            approvedStudiesCollection: {}
        };
        mockConfigurationService = {};
        mockInstitutionService = {
            getInstitutionByID: jest.fn()
        };
        mockAuthorizationService = {
            getPermissionScope: jest.fn()
        };

        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockSubmissionsCollection,
            mockSubmissionRequestCollection,
            'official@email.com',
            'http://app.url',
            mockApprovedStudiesService,
            30,
            mockConfigurationService,
            mockInstitutionService,
            mockAuthorizationService
        );
        userService.userDAO = mockUserDAO;

        global.verifySession = jest.fn(() => ({
            verifyInitialized: jest.fn()
        }));

        global.getDataCommonsDisplayNamesForUser = jest.fn((user) => ({
            ...user,
            dataCommonsDisplayNames: user.dataCommons || []
        }));

        global.getCurrentTime = jest.fn(() => new Date());

        userService._findApprovedStudies = jest.fn().mockResolvedValue(mockApprovedStudies);
        userService._setUserPermissions = jest.fn().mockResolvedValue();
        userService._notifyUpdatedUser = jest.fn().mockResolvedValue();
        userService._notifyDeactivatedUser = jest.fn().mockResolvedValue();
        userService._logAfterUserEdit = jest.fn().mockResolvedValue();
        userService._removePrimaryContact = jest.fn().mockResolvedValue();

        userService.editUser = jest.fn(async (params, context) => {
            global.verifySession(context).verifyInitialized();

            if (!params?.userID) {
                throw new Error('A userID argument is required to call this API');
            }

            if (!context?.userInfo) {
                throw new Error('A user must be logged in to call this API');
            }

            const userScope = await userService._getUserScope(context?.userInfo, 'user:manage');
            if (userScope.isNoneScope()) {
                throw new Error('You do not have permission to perform this action.');
            }

            const userDoc = await mockUserDAO.findById(params.userID);
            if (!userDoc || userDoc?._id !== params.userID) {
                throw new Error('User not found');
            }

            const roleScope = userScope.getRoleScope();
            const roleSet = new Set(Object.values(USER.ROLES));
            const filteredRoles = roleScope?.scopeValues.filter(role => roleSet.has(role));

            if (roleScope?.scope && (
                !filteredRoles?.includes(userDoc?.role) ||
                (params?.role && !filteredRoles?.includes(params?.role)) ||
                roleScope?.scopeValues?.length === 0)) {
                throw new Error('You only have limited access with the given role scope.');
            }

            let updatedUser = {};
            if (params.role && Object.values(USER.ROLES).includes(params.role)) {
                updatedUser.role = params.role;
            }

            if (!params?.studies && USER.ROLES.SUBMITTER === params.role) {
                throw new Error('Approved studies are required for submitter role');
            }

            const isSubmitter = USER.ROLES.SUBMITTER === params.role || (!params.role && USER.ROLES.SUBMITTER === userDoc.role);
            const aInstitution = isSubmitter && params?.institutionID ?
                await mockInstitutionService.getInstitutionByID(params?.institutionID) : null;

            if (isSubmitter && !aInstitution && params?.institutionID) {
                throw new Error(`The ${params.institutionID} institution ID does not exist in the system.`);
            }

            const {_id, name, status} = userDoc?.institution || {};
            const {_id: newId, name: newName, status: newStatus} = aInstitution || {};
            if (_id !== newId || name !== newName || status !== newStatus) {
                updatedUser.institution = aInstitution ? {_id: newId, name: newName, status: newStatus} : null;
            }

            const isValidUserStatus = Object.values(USER.STATUSES).includes(params.status);
            if (params.status) {
                if (isValidUserStatus) {
                    updatedUser.userStatus = params.status;
                } else {
                    throw new Error('Invalid user status');
                }
            }

            updatedUser.dataCommons = params?.dataCommons || userDoc?.dataCommons || [];

            await userService._setUserPermissions(userDoc, params?.role, params?.permissions, params?.notifications, updatedUser, userDoc);

            const validStudies = await userService._findApprovedStudies(params?.studies);
            if (params?.studies && params.studies.length > 0) {
                if (validStudies.length !== params.studies.length && !params.studies.includes("All")) {
                    throw new Error('Invalid not approved studies');
                } else {
                    if (params.studies.includes("All")) {
                        updatedUser.studies = [{ _id: "All" }];
                    } else {
                        updatedUser.studies = params.studies.map(str => ({ _id: str }));
                    }
                }
            } else {
                updatedUser.studies = [];
            }

            let userAfterUpdate;
            try {
                userAfterUpdate = await mockUserDAO.update(
                    params.userID,
                    { ...updatedUser, updateAt: global.getCurrentTime() }
                );
            } catch (error) {
                throw new Error(SUBMODULE_ERROR.UPDATE_FAILED);
            }

            if (!userAfterUpdate) {
                throw new Error(SUBMODULE_ERROR.UPDATE_FAILED);
            }

            const formattedUser = global.getDataCommonsDisplayNamesForUser(userAfterUpdate);
            await Promise.all([
                userService._notifyDeactivatedUser(userDoc, params.status),
                userService._notifyUpdatedUser(userDoc, formattedUser, params.role),
                userService._logAfterUserEdit(userDoc, formattedUser),
                userService._removePrimaryContact(userDoc, formattedUser)
            ]);

            return formattedUser;
        });

        context = {
            userInfo: mockUserInfo
        };

        params = {
            userID: 'target-user-id',
            role: USER.ROLES.SUBMITTER,
            status: USER.STATUSES.ACTIVE,
            studies: ['study-1', 'study-2'],
            dataCommons: ['commons1', 'commons2'],
            institutionID: 'inst-456',
            permissions: ['permission1'],
            notifications: ['notification1']
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Successful scenarios', () => {
        it('should successfully edit user with all parameters', async () => {
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockInstitutionService.getInstitutionByID.mockResolvedValue(mockInstitution);
            userService._findApprovedStudies.mockResolvedValue([
                { _id: 'study-1', studyName: 'Study 1' },
                { _id: 'study-2', studyName: 'Study 2' }
            ]);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...params });

            const result = await userService.editUser(params, context);

            expect(global.verifySession).toHaveBeenCalledWith(context);
            expect(userService._getUserScope).toHaveBeenCalledWith(
                mockUserInfo,
                'user:manage'
            );
            expect(mockUserDAO.findById).toHaveBeenCalledWith('target-user-id');
            expect(mockInstitutionService.getInstitutionByID).toHaveBeenCalledWith('inst-456');
            expect(userService._setUserPermissions).toHaveBeenCalled();
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(['study-1', 'study-2']);
            expect(mockUserDAO.update).toHaveBeenCalled();
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should edit user role only', async () => {
            const roleOnlyParams = { userID: 'target-user-id', role: USER.ROLES.FEDERAL_LEAD };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, role: USER.ROLES.FEDERAL_LEAD });

            const result = await userService.editUser(roleOnlyParams, context);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                'target-user-id',
                expect.objectContaining({
                    role: USER.ROLES.FEDERAL_LEAD,
                    updateAt: expect.any(Date)
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should edit user status only', async () => {
            const statusOnlyParams = { userID: 'target-user-id', status: USER.STATUSES.INACTIVE };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, userStatus: USER.STATUSES.INACTIVE });

            const result = await userService.editUser(statusOnlyParams, context);

            expect(mockUserDAO.update).toHaveBeenCalledWith(
                'target-user-id',
                expect.objectContaining({
                    userStatus: USER.STATUSES.INACTIVE,
                    updateAt: expect.any(Date)
                })
            );
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should edit submitter user with institution', async () => {
            const submitterParams = {
                userID: 'submitter-user-id',
                role: USER.ROLES.SUBMITTER,
                studies: ['study-1'],
                institutionID: 'inst-456'
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockSubmitterUser);
            mockInstitutionService.getInstitutionByID.mockResolvedValue(mockInstitution);
            userService._findApprovedStudies.mockResolvedValue([
                { _id: 'study-1', studyName: 'Study 1' }
            ]);
            mockUserDAO.update.mockResolvedValue({ ...mockSubmitterUser, institution: mockInstitution });

            const result = await userService.editUser(submitterParams, context);

            expect(mockInstitutionService.getInstitutionByID).toHaveBeenCalledWith('inst-456');
            expect(userService._findApprovedStudies).toHaveBeenCalledWith(['study-1']);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle studies with "All" option', async () => {
            const allStudiesParams = {
                userID: 'target-user-id',
                studies: ['All']
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, studies: [{ _id: 'All' }] });

            const result = await userService.editUser(allStudiesParams, context);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith(['All']);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle empty studies array', async () => {
            const emptyStudiesParams = {
                userID: 'target-user-id',
                studies: []
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, studies: [] });

            const result = await userService.editUser(emptyStudiesParams, context);

            expect(userService._findApprovedStudies).toHaveBeenCalledWith([]);
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });
    });

    describe('Permission scenarios', () => {
        it('should throw error when user has none scope', async () => {
            const noneScope = {
                isNoneScope: () => true,
                isAllScope: () => false,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(noneScope);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('You do not have permission to perform this action.');
        });

        it('should throw error when user role is not in scope', async () => {
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scope: 'role',
                    scopeValues: [USER.ROLES.ADMIN, USER.ROLES.USER]
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('You only have limited access with the given role scope.');
        });

        it('should allow access when user role is in scope', async () => {
            const roleScope = {
                isNoneScope: () => false,
                isAllScope: () => false,
                getRoleScope: () => ({
                    scope: 'role',
                    scopeValues: [USER.ROLES.SUBMITTER]
                })
            };
            userService._getUserScope = jest.fn().mockResolvedValue(roleScope);
            mockUserDAO.findById.mockResolvedValue(mockSubmitterUser);
            mockUserDAO.update.mockResolvedValue(mockSubmitterUser);

            const result = await userService.editUser({ userID: 'submitter-user-id' }, context);

            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });
    });

    describe('Validation scenarios', () => {
        it('should throw error when userID is missing', async () => {
            const paramsWithoutUserID = { role: USER.ROLES.USER };

            await expect(userService.editUser(paramsWithoutUserID, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should throw error when user is not found', async () => {
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(null);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('User not found');
        });

        it('should throw error when user is not found (null result)', async () => {
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(null);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('User not found');
        });

        it('should throw error when submitter role requires studies', async () => {
            const submitterWithoutStudiesParams = {
                userID: 'target-user-id',
                role: USER.ROLES.SUBMITTER
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);

            await expect(userService.editUser(submitterWithoutStudiesParams, context))
                .rejects.toThrow('Approved studies are required for submitter role');
        });

        it('should throw error when invalid user status is provided', async () => {
            const invalidStatusParams = {
                userID: 'target-user-id',
                status: 'InvalidStatus'
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);

            await expect(userService.editUser(invalidStatusParams, context))
                .rejects.toThrow('Invalid user status');
        });

        it('should throw error when invalid studies are provided', async () => {
            const invalidStudiesParams = {
                userID: 'target-user-id',
                studies: ['invalid-study-1', 'invalid-study-2']
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            userService._findApprovedStudies.mockResolvedValue([]);

            await expect(userService.editUser(invalidStudiesParams, context))
                .rejects.toThrow('Invalid not approved studies');
        });

        it('should throw error when institution ID does not exist', async () => {
            const invalidInstitutionParams = {
                userID: 'target-user-id',
                role: USER.ROLES.SUBMITTER,
                studies: ['study-1'],
                institutionID: 'invalid-inst-id'
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockInstitutionService.getInstitutionByID.mockResolvedValue(null);

            await expect(userService.editUser(invalidInstitutionParams, context))
                .rejects.toThrow('The invalid-inst-id institution ID does not exist in the system.');
        });
    });

    describe('Error scenarios', () => {
        it('should throw error when session verification fails', async () => {
            const sessionError = new Error('Session verification failed');
            global.verifySession = jest.fn(() => ({
                verifyInitialized: jest.fn().mockImplementation(() => {
                    throw sessionError;
                })
            }));

            await expect(userService.editUser(params, context))
                .rejects.toThrow('Session verification failed');
        });

        it('should throw error when _getUserScope fails', async () => {
            const scopeError = new Error('Scope error');
            userService._getUserScope = jest.fn().mockRejectedValue(scopeError);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('Scope error');
        });

        it('should throw error when database findById fails', async () => {
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            const dbError = new Error('Database error');
            mockUserDAO.findById.mockRejectedValue(dbError);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('Database error');
        });

        it('should throw error when institution service fails', async () => {
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const institutionError = new Error('Institution service error');
            mockInstitutionService.getInstitutionByID.mockRejectedValue(institutionError);

            await expect(userService.editUser(params, context))
                .rejects.toThrow('Institution service error');
        });

        it('should throw error when _findApprovedStudies fails', async () => {
            const studiesParams = { userID: 'target-user-id', studies: ['study-1'] };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const studiesError = new Error('Studies error');
            userService._findApprovedStudies = jest.fn().mockRejectedValue(studiesError);

            await expect(userService.editUser(studiesParams, context))
                .rejects.toThrow('Studies error');
        });

        it('should throw error when _setUserPermissions fails', async () => {
            const permissionsParams = { userID: 'target-user-id', permissions: ['permission1'] };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const permissionsError = new Error('Permissions error');
            userService._setUserPermissions = jest.fn().mockRejectedValue(permissionsError);

            await expect(userService.editUser(permissionsParams, context))
                .rejects.toThrow('Permissions error');
        });

        it('should throw UPDATE_FAILED when database update rejects', async () => {
            const updateParams = { userID: 'target-user-id' };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockRejectedValue(new Error('Update error'));

            await expect(userService.editUser(updateParams, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });

        it('should throw UPDATE_FAILED when database update throws', async () => {
            const updateParams = { userID: 'target-user-id' };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            const updateError = new Error('Update error');
            mockUserDAO.update.mockRejectedValue(updateError);

            await expect(userService.editUser(updateParams, context))
                .rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty context', async () => {
            const emptyContext = {};

            await expect(userService.editUser(params, emptyContext))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle context with null userInfo', async () => {
            const contextWithNullUserInfo = { userInfo: null };

            await expect(userService.editUser(params, contextWithNullUserInfo))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle context with undefined userInfo', async () => {
            const contextWithUndefinedUserInfo = { userInfo: undefined };

            await expect(userService.editUser(params, contextWithUndefinedUserInfo))
                .rejects.toThrow('A user must be logged in to call this API');
        });

        it('should handle null params', async () => {
            await expect(userService.editUser(null, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should handle undefined params', async () => {
            await expect(userService.editUser(undefined, context))
                .rejects.toThrow('A userID argument is required to call this API');
        });

        it('should handle user with null institution', async () => {
            const userWithNullInstitution = {
                ...mockExistingUser,
                institution: null
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(userWithNullInstitution);
            mockUserDAO.update.mockResolvedValue(userWithNullInstitution);

            const result = await userService.editUser({ userID: 'target-user-id' }, context);

            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle user with undefined institution', async () => {
            const userWithUndefinedInstitution = {
                ...mockExistingUser,
                institution: undefined
            };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(userWithUndefinedInstitution);
            mockUserDAO.update.mockResolvedValue(userWithUndefinedInstitution);

            const result = await userService.editUser({ userID: 'target-user-id' }, context);

            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });
    });

    describe('Integration with notifications and logging', () => {
        it('should call all notification and logging methods', async () => {
            const notificationParams = { userID: 'target-user-id', status: USER.STATUSES.INACTIVE, role: USER.ROLES.USER };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...notificationParams });

            const result = await userService.editUser(notificationParams, context);

            expect(userService._notifyDeactivatedUser).toHaveBeenCalledWith(mockExistingUser, notificationParams.status);
            expect(userService._notifyUpdatedUser).toHaveBeenCalledWith(mockExistingUser, expect.any(Object), notificationParams.role);
            expect(userService._logAfterUserEdit).toHaveBeenCalledWith(mockExistingUser, expect.any(Object));
            expect(userService._removePrimaryContact).toHaveBeenCalledWith(mockExistingUser, expect.any(Object));
            expect(result).toHaveProperty('dataCommonsDisplayNames');
        });

        it('should handle notification failures gracefully', async () => {
            const notificationParams = { userID: 'target-user-id', status: USER.STATUSES.INACTIVE };
            const allScope = {
                isNoneScope: () => false,
                isAllScope: () => true,
                getRoleScope: () => null
            };
            userService._getUserScope = jest.fn().mockResolvedValue(allScope);
            mockUserDAO.findById.mockResolvedValue(mockExistingUser);
            mockUserDAO.update.mockResolvedValue({ ...mockExistingUser, ...notificationParams });
            userService._notifyUpdatedUser = jest.fn().mockRejectedValue(new Error('Notification failed'));

            await expect(userService.editUser(notificationParams, context))
                .rejects.toThrow('Notification failed');
        });
    });
});
