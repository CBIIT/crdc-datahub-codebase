// Mock the time-utility module before importing UserService
jest.mock('../../crdc-datahub-database-drivers/utility/time-utility', () => ({
    getCurrentTime: jest.fn(() => new Date('2023-12-01T00:00:00Z')),
    subtractDaysFromNowTimestamp: jest.fn()
}));

const { UserService } = require('../../services/user');
const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');

describe('UserService.disableInactiveUsers', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockSubmissionsCollection, mockSubmissionRequestCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;

    const mockInactiveUsers = [
        {
            _id: 'user-1',
            email: 'user1@example.com',
            firstName: 'User',
            lastName: 'One',
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            IDP: 'google',
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
            role: USER.ROLES.DATA_COMMONS_PERSONNEL,
            userStatus: USER.STATUSES.ACTIVE,
            IDP: 'microsoft',
            studies: [{ _id: 'study-2' }],
            dataCommons: ['commons-2'],
            createdAt: '2023-01-02T00:00:00Z',
            updateAt: '2023-01-02T00:00:00Z'
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

        const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
        global.getCurrentTime = getCurrentTime;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('successful scenarios', () => {
        it('should disable inactive users when they exist', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' },
                { email: 'user2@example.com', IDP: 'microsoft' }
            ];
            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };
            const expectedUpdate = {
                userStatus: USER.STATUSES.INACTIVE,
                updateAt: new Date('2023-12-01T00:00:00Z')
            };

            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });
            mockUserDAO.findMany.mockResolvedValue(mockInactiveUsers);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual(mockInactiveUsers);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expectedUpdate);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledWith(expectedQuery);
        });

        it('should return empty array when no users are modified', async () => {
            const inactiveUserConditions = [
                { email: 'nonexistent@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return empty array when count is null', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: null });

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return empty array when count is undefined', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({});

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });
    });

    describe('input validation', () => {
        it('should return empty array when inactiveUsers is null', async () => {
            const result = await userService.disableInactiveUsers(null);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).not.toHaveBeenCalled();
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return empty array when inactiveUsers is undefined', async () => {
            const result = await userService.disableInactiveUsers(undefined);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).not.toHaveBeenCalled();
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return empty array when inactiveUsers is empty array', async () => {
            const result = await userService.disableInactiveUsers([]);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).not.toHaveBeenCalled();
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should return empty array when inactiveUsers has length 0', async () => {
            const result = await userService.disableInactiveUsers([]);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).not.toHaveBeenCalled();
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });
    });

    describe('query structure validation', () => {
        it('should build correct query with $or and IDP exclusion', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' },
                { email: 'user2@example.com', IDP: 'microsoft' }
            ];
            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };

            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });
            mockUserDAO.findMany.mockResolvedValue(mockInactiveUsers);

            await userService.disableInactiveUsers(inactiveUserConditions);

            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
            expect(mockUserDAO.findMany).toHaveBeenCalledWith(expectedQuery);
        });

        it('should exclude NIH users from the query', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' },
                { email: 'nih.user@nih.gov', IDP: 'nih' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            await userService.disableInactiveUsers(inactiveUserConditions);

            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
            expect(mockUserDAO.findMany).toHaveBeenCalledWith(expectedQuery);
        });

        it('should use correct update object with INACTIVE status and timestamp', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];
            const expectedUpdate = {
                userStatus: USER.STATUSES.INACTIVE,
                updateAt: new Date('2023-12-01T00:00:00Z')
            };

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            await userService.disableInactiveUsers(inactiveUserConditions);

            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expect.any(Object), expectedUpdate);
        });
    });

    describe('error handling', () => {
        it('should propagate database update errors', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];
            const dbError = new Error('Database connection failed');
            mockUserDAO.updateMany.mockRejectedValue(dbError);

            await expect(userService.disableInactiveUsers(inactiveUserConditions)).rejects.toThrow('Database connection failed');
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });

        it('should propagate database findMany errors', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];
            const dbError = new Error('Find query failed');

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockRejectedValue(dbError);

            await expect(userService.disableInactiveUsers(inactiveUserConditions)).rejects.toThrow('Find query failed');
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle null result from findMany', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue(null);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle undefined result from findMany', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue(undefined);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe('performance and behavior', () => {
        it('should call updateMany only once per invocation', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            await userService.disableInactiveUsers(inactiveUserConditions);

            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
        });

        it('should call findMany only when users are updated', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            await userService.disableInactiveUsers(inactiveUserConditions);

            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should not call findMany when no users are updated', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            await userService.disableInactiveUsers(inactiveUserConditions);

            expect(mockUserDAO.findMany).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle single user condition', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([mockInactiveUsers[0]]);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple user conditions', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' },
                { email: 'user2@example.com', IDP: 'microsoft' },
                { email: 'user3@example.com', IDP: 'github' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 3 });
            mockUserDAO.findMany.mockResolvedValue(mockInactiveUsers);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual(mockInactiveUsers);
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.findMany).toHaveBeenCalledTimes(1);
        });

        it('should handle complex user conditions', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google', role: USER.ROLES.SUBMITTER },
                { email: 'user2@example.com', IDP: 'microsoft', userStatus: USER.STATUSES.ACTIVE },
                {
                    email: 'user3@example.com',
                    IDP: 'github',
                    studies: [{ _id: 'study-1' }],
                    dataCommons: ['commons-1']
                }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 3 });
            mockUserDAO.findMany.mockResolvedValue(mockInactiveUsers);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual(mockInactiveUsers);
            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
        });
    });

    describe('NIH user exclusion', () => {
        it('should exclude NIH users from being disabled', async () => {
            const inactiveUserConditions = [
                { email: 'nih.user@nih.gov', IDP: 'nih' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([]);
            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
        });

        it('should handle mixed NIH and non-NIH users', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' },
                { email: 'nih.user@nih.gov', IDP: 'nih' },
                { email: 'user2@example.com', IDP: 'microsoft' }
            ];

            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0], mockInactiveUsers[1]]);

            const result = await userService.disableInactiveUsers(inactiveUserConditions);

            expect(result).toEqual([mockInactiveUsers[0], mockInactiveUsers[1]]);
            const expectedQuery = {
                "$or": inactiveUserConditions,
                IDP: { $ne: 'nih' }
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
        });
    });

    describe('integration scenarios', () => {
        it('should work with getCurrentTime function', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];
            const mockTime = new Date('2023-12-01T12:00:00Z');
            const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
            getCurrentTime.mockReturnValue(mockTime);

            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });
            mockUserDAO.findMany.mockResolvedValue([mockInactiveUsers[0]]);

            await userService.disableInactiveUsers(inactiveUserConditions);

            const expectedUpdate = {
                userStatus: USER.STATUSES.INACTIVE,
                updateAt: mockTime
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expect.any(Object), expectedUpdate);
            expect(getCurrentTime).toHaveBeenCalled();
        });

        it('should handle getCurrentTime errors gracefully', async () => {
            const inactiveUserConditions = [
                { email: 'user1@example.com', IDP: 'google' }
            ];
            const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
            getCurrentTime.mockImplementation(() => {
                throw new Error('Time service unavailable');
            });

            await expect(userService.disableInactiveUsers(inactiveUserConditions)).rejects.toThrow('Time service unavailable');
            expect(mockUserDAO.updateMany).not.toHaveBeenCalled();
        });
    });
});
