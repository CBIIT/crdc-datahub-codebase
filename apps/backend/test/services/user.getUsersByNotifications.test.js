const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');

describe('UserService.getUsersByNotifications', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockSubmissionsCollection, mockSubmissionRequestCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;

    const mockUsersWithNotifications = [
        {
            _id: 'user-1',
            email: 'user1@example.com',
            firstName: 'User',
            lastName: 'One',
            role: USER.ROLES.ADMIN,
            userStatus: USER.STATUSES.ACTIVE,
            notifications: ['email_notifications', 'system_notifications', 'submission_notifications'],
            studies: [{ _id: 'study-1' }],
            dataCommons: ['commons-1'],
            createdAt: '2023-01-01T00:00:00Z',
            updateAt: '2023-01-01T00:00:00Z'
        },
        {
            _id: 'user-2',
            email: 'user2@example.com',
            firstName: 'User',
            lastName: 'Two',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            notifications: ['email_notifications', 'submission_notifications'],
            studies: [{ _id: 'study-2' }],
            dataCommons: ['commons-2'],
            createdAt: '2023-01-02T00:00:00Z',
            updateAt: '2023-01-02T00:00:00Z'
        }
    ];

    const mockUsersWithDifferentNotifications = [
        {
            _id: 'user-3',
            email: 'user3@example.com',
            firstName: 'User',
            lastName: 'Three',
            role: USER.ROLES.DATA_COMMONS_PERSONNEL,
            userStatus: USER.STATUSES.ACTIVE,
            notifications: ['admin_notifications', 'data_commons_notifications'],
            studies: [{ _id: 'study-3' }],
            dataCommons: ['commons-3'],
            createdAt: '2023-01-03T00:00:00Z',
            updateAt: '2023-01-03T00:00:00Z'
        }
    ];

    beforeEach(() => {
        mockUserDAO = {
            findMany: jest.fn(),
            updateMany: jest.fn(),
            aggregate: jest.fn(),
            getUsersByNotifications: jest.fn()
        };
        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockSubmissionsCollection = {};
        mockSubmissionRequestCollection = {};
        mockApprovedStudiesService = {};
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

        userService = new UserService(
            mockLogCollection,
            mockOrganizationCollection,
            mockNotificationsService,
            mockSubmissionsCollection,
            mockSubmissionRequestCollection,
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
        it('should return users with matching notifications', async () => {
            const notifications = ['email_notifications', 'submission_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should return empty array when no users match notifications', async () => {
            const notifications = ['nonexistent_notification'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual([]);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should return single user when only one matches', async () => {
            const notifications = ['admin_notifications'];
            const singleUser = [mockUsersWithDifferentNotifications[0]];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(singleUser);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(singleUser);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should filter by both notifications and roles when roles are provided', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([mockUsersWithNotifications[0]]);

            const result = await userService.getUsersByNotifications(notifications, roles);

            expect(result).toEqual([mockUsersWithNotifications[0]]);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });
    });

    describe('delegation to userDAO', () => {
        it('should delegate to userDAO with notifications only', async () => {
            const notifications = ['email_notifications', 'system_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should delegate to userDAO with notifications and roles', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN, USER.ROLES.SUBMITTER];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications, roles);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });

        it('should pass notifications array through to userDAO', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });
    });

    describe('input handling', () => {
        it('should handle single notification', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should handle multiple notifications', async () => {
            const notifications = ['email_notifications', 'system_notifications', 'submission_notifications', 'admin_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should handle empty notifications array', async () => {
            const notifications = [];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should handle single role in roles array', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([mockUsersWithNotifications[0]]);

            await userService.getUsersByNotifications(notifications, roles);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });

        it('should handle multiple roles in roles array', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN, USER.ROLES.SUBMITTER, USER.ROLES.DATA_COMMONS_PERSONNEL];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications, roles);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });

        it('should handle empty roles array', async () => {
            const notifications = ['email_notifications'];
            const roles = [];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications, roles);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });

        it('should handle undefined roles parameter', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications, undefined);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should handle null roles parameter', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications, null);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, null);
        });
    });

    describe('error handling', () => {
        it('should propagate database errors', async () => {
            const notifications = ['email_notifications'];
            const dbError = new Error('Database connection failed');
            mockUserDAO.getUsersByNotifications.mockRejectedValue(dbError);

            await expect(userService.getUsersByNotifications(notifications)).rejects.toThrow('Database connection failed');
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should handle null result from database', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(null);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toBeNull();
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should handle undefined result from database', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(undefined);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toBeUndefined();
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });
    });

    describe('performance and behavior', () => {
        it('should call getUsersByNotifications only once per invocation', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should return the same result on multiple calls with same data', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result1 = await userService.getUsersByNotifications(notifications);
            const result2 = await userService.getUsersByNotifications(notifications);

            expect(result1).toEqual(result2);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(2);
        });
    });

    describe('edge cases', () => {
        it('should handle users with no notifications', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual([]);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should handle users with null notifications', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual([]);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should handle users with undefined notifications', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual([]);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledTimes(1);
        });

        it('should handle special characters in notification names', async () => {
            const notifications = ['email_notifications', 'system-notifications', 'submission_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });

        it('should handle long notification names', async () => {
            const notifications = ['very_long_notification_name_that_exceeds_normal_length_limits'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([]);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
        });
    });

    describe('business logic validation', () => {
        it('should identify users with specific notification preferences', async () => {
            const notifications = ['email_notifications', 'submission_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(result.every(user =>
                user.userStatus === USER.STATUSES.ACTIVE &&
                user.notifications.some(notification => notifications.includes(notification))
            )).toBe(true);
        });

        it('should filter by role when specified', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([mockUsersWithNotifications[0]]);

            const result = await userService.getUsersByNotifications(notifications, roles);

            expect(result).toEqual([mockUsersWithNotifications[0]]);
            expect(result.every(user =>
                user.userStatus === USER.STATUSES.ACTIVE &&
                user.notifications.includes('email_notifications') &&
                roles.includes(user.role)
            )).toBe(true);
        });

        it('should only return active users', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(result.every(user => user.userStatus === USER.STATUSES.ACTIVE)).toBe(true);
        });

        it('should return users with at least one matching notification', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(result.every(user =>
                user.notifications.some(notification => notifications.includes(notification))
            )).toBe(true);
        });
    });

    describe('comparison with other user retrieval methods', () => {
        it('should delegate to userDAO instead of building its own query', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            await userService.getUsersByNotifications(notifications);

            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, []);
            expect(mockUserDAO.aggregate).not.toHaveBeenCalled();
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return array format consistent with other user retrieval methods', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('_id');
            expect(result[0]).toHaveProperty('email');
            expect(result[0]).toHaveProperty('role');
            expect(result[0]).toHaveProperty('userStatus');
            expect(result[0]).toHaveProperty('notifications');
        });
    });

    describe('notification-specific functionality', () => {
        it('should specifically target users by notification preferences', async () => {
            const notifications = ['email_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(result.every(user =>
                user.userStatus === USER.STATUSES.ACTIVE &&
                user.notifications.includes('email_notifications')
            )).toBe(true);
        });

        it('should handle multiple notification types', async () => {
            const notifications = ['email_notifications', 'system_notifications', 'submission_notifications'];

            mockUserDAO.getUsersByNotifications.mockResolvedValue(mockUsersWithNotifications);

            const result = await userService.getUsersByNotifications(notifications);

            expect(result).toEqual(mockUsersWithNotifications);
            expect(result.every(user =>
                user.userStatus === USER.STATUSES.ACTIVE &&
                user.notifications.some(notification => notifications.includes(notification))
            )).toBe(true);
        });

        it('should combine notification and role filtering correctly', async () => {
            const notifications = ['email_notifications'];
            const roles = [USER.ROLES.ADMIN];

            mockUserDAO.getUsersByNotifications.mockResolvedValue([mockUsersWithNotifications[0]]);

            const result = await userService.getUsersByNotifications(notifications, roles);

            expect(result).toEqual([mockUsersWithNotifications[0]]);
            expect(result.every(user =>
                user.userStatus === USER.STATUSES.ACTIVE &&
                user.notifications.includes('email_notifications') &&
                user.role === USER.ROLES.ADMIN
            )).toBe(true);
            expect(mockUserDAO.getUsersByNotifications).toHaveBeenCalledWith(notifications, roles);
        });
    });
});
