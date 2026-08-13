const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');

describe('UserService.getAdmin', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockApplicationCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;

    const mockAdminUsers = [
        {
            _id: 'admin-1',
            email: 'admin1@example.com',
            firstName: 'Admin',
            lastName: 'One',
            role: USER.ROLES.ADMIN,
            userStatus: USER.STATUSES.ACTIVE,
            studies: [{ _id: 'study-1' }],
            dataCommons: ['commons-1'],
            createdAt: '2023-01-01T00:00:00Z',
            updateAt: '2023-01-01T00:00:00Z'
        },
        {
            _id: 'admin-2',
            email: 'admin2@example.com',
            firstName: 'Admin',
            lastName: 'Two',
            role: USER.ROLES.ADMIN,
            userStatus: USER.STATUSES.ACTIVE,
            studies: [{ _id: 'study-2' }],
            dataCommons: ['commons-2'],
            createdAt: '2023-01-02T00:00:00Z',
            updateAt: '2023-01-02T00:00:00Z'
        }
    ];

    const mockInactiveAdmin = {
        _id: 'admin-inactive',
        email: 'admin.inactive@example.com',
        firstName: 'Admin',
        lastName: 'Inactive',
        role: USER.ROLES.ADMIN,
        userStatus: USER.STATUSES.INACTIVE,
        studies: [{ _id: 'study-inactive' }],
        dataCommons: ['commons-inactive'],
        createdAt: '2023-01-03T00:00:00Z',
        updateAt: '2023-01-03T00:00:00Z'
    };

    const mockNonAdminUser = {
        _id: 'non-admin',
        email: 'non.admin@example.com',
        firstName: 'Non',
        lastName: 'Admin',
        role: USER.ROLES.SUBMITTER,
        userStatus: USER.STATUSES.ACTIVE,
        studies: [{ _id: 'study-submitter' }],
        dataCommons: ['commons-submitter'],
        createdAt: '2023-01-04T00:00:00Z',
        updateAt: '2023-01-04T00:00:00Z'
    };

    beforeEach(() => {
        // Mock all dependencies
        mockUserDAO = {
            findMany: jest.fn()
        };
        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockApprovedStudiesService = {};
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

        // Initialize UserService with mocked dependencies
        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockApplicationCollection,
            'test@example.com',
            'http://test.com',
            mockApprovedStudiesService,
            30,
            mockConfigurationService,
            mockInstitutionService,
            mockAuthorizationService
        );
        userService.userDAO = mockUserDAO;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('successful scenarios', () => {
        it('should return admin users when they exist', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(mockAdminUsers);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });

        it('should return empty array when no admin users exist', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue([]);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual([]);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });

        it('should return single admin user when only one exists', async () => {
            // Arrange
            const singleAdmin = [mockAdminUsers[0]];
            mockUserDAO.findMany.mockResolvedValue(singleAdmin);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(singleAdmin);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });
    });

    describe('filtering behavior', () => {
        it('should only return users with ADMIN role', async () => {
            // Arrange
            const mixedUsers = [...mockAdminUsers, mockNonAdminUser];
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(mockAdminUsers);
            expect(result.every(user => user.role === USER.ROLES.ADMIN)).toBe(true);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });

        it('should only return users with ACTIVE status', async () => {
            // Arrange
            const mixedStatusUsers = [...mockAdminUsers, mockInactiveAdmin];
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(mockAdminUsers);
            expect(result.every(user => user.userStatus === USER.STATUSES.ACTIVE)).toBe(true);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });

        it('should filter by both role and status correctly', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(mockAdminUsers);
            expect(result.every(user => 
                user.role === USER.ROLES.ADMIN && 
                user.userStatus === USER.STATUSES.ACTIVE
            )).toBe(true);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });
    });

    describe('error handling', () => {
        it('should propagate database errors', async () => {
            // Arrange
            const dbError = new Error('Database connection failed');
            mockUserDAO.findMany.mockRejectedValue(dbError);

            // Act & Assert
            await expect(userService.getAdmin()).rejects.toThrow('Database connection failed');
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle null result from database', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(null);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual([]);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle undefined result from database', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(undefined);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual([]);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe('query structure validation', () => {
        it('should use correct findMany query', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            await userService.getAdmin();

            // Assert
            expect(mockUserDAO.findMany).toHaveBeenCalledWith({
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            });
        });

        it('should use correct USER constants', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            await userService.getAdmin();

            // Assert
            const expectedQuery = {
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            };
            expect(mockUserDAO.findMany).toHaveBeenCalledWith(expectedQuery);
        });
    });

    describe('performance and behavior', () => {
        it('should call findMany only once per invocation', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            await userService.getAdmin();

            // Assert
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should return the same result on multiple calls with same data', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result1 = await userService.getAdmin();
            const result2 = await userService.getAdmin();

            // Assert
            expect(result1).toEqual(result2);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(2);
        });
    });

    describe('edge cases', () => {
        it('should handle admin users with minimal data', async () => {
            // Arrange
            const minimalAdmin = [{
                _id: 'minimal-admin',
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            }];
            mockUserDAO.findMany.mockResolvedValue(minimalAdmin);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(minimalAdmin);
            expect(result[0].role).toBe(USER.ROLES.ADMIN);
            expect(result[0].userStatus).toBe(USER.STATUSES.ACTIVE);
        });

        it('should handle admin users with extensive data', async () => {
            // Arrange
            const extensiveAdmin = [{
                _id: 'extensive-admin',
                email: 'extensive@example.com',
                firstName: 'Extensive',
                lastName: 'Admin',
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE,
                studies: [{ _id: 'study-1' }, { _id: 'study-2' }],
                dataCommons: ['commons-1', 'commons-2', 'commons-3'],
                institution: { _id: 'inst-1', name: 'Test Institution' },
                permissions: ['admin:manage_users', 'admin:manage_submissions'],
                notifications: ['email_notifications', 'system_notifications'],
                createdAt: '2023-01-01T00:00:00Z',
                updateAt: '2023-01-01T00:00:00Z',
                lastLoginAt: '2023-12-01T00:00:00Z',
                loginCount: 150,
                isVerified: true,
                preferences: {
                    theme: 'dark',
                    language: 'en',
                    timezone: 'UTC'
                }
            }];
            mockUserDAO.findMany.mockResolvedValue(extensiveAdmin);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(result).toEqual(extensiveAdmin);
            expect(result[0].role).toBe(USER.ROLES.ADMIN);
            expect(result[0].userStatus).toBe(USER.STATUSES.ACTIVE);
            expect(result[0].studies).toHaveLength(2);
            expect(result[0].dataCommons).toHaveLength(3);
        });
    });

    describe('comparison with other user retrieval methods', () => {
        it('should use same query structure as getFedLeads but with different role', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            await userService.getAdmin();

            // Assert
            const expectedQuery = {
                role: USER.ROLES.ADMIN,
                userStatus: USER.STATUSES.ACTIVE
            };
            expect(mockUserDAO.findMany).toHaveBeenCalledWith(expectedQuery);
            
            // Verify it's different from getFedLeads query
            expect(expectedQuery.role).toBe(USER.ROLES.ADMIN);
            expect(expectedQuery.role).not.toBe(USER.ROLES.FEDERAL_LEAD);
        });

        it('should return array format consistent with other user retrieval methods', async () => {
            // Arrange
            mockUserDAO.findMany.mockResolvedValue(mockAdminUsers);

            // Act
            const result = await userService.getAdmin();

            // Assert
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('_id');
            expect(result[0]).toHaveProperty('role');
            expect(result[0]).toHaveProperty('userStatus');
        });
    });
}); 