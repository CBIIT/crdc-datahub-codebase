const { UserService } = require('../../services/user');
const ERROR = require('../../constants/error-constants');

// Mock the time-utility module before importing UserService
jest.mock('../../crdc-datahub-database-drivers/utility/time-utility', () => ({
    getCurrentTime: jest.fn(() => new Date('2023-12-01T00:00:00Z')),
    subtractDaysFromNowTimestamp: jest.fn()
}));

describe('UserService.updateUserInstitution', () => {
    let userService;
    let mockUserDAO, mockLogCollection, mockOrganizationCollection, mockNotificationsService, mockApplicationCollection, mockApprovedStudiesService, mockConfigurationService, mockInstitutionService, mockAuthorizationService;

    const mockUsersWithInstitution = [
        {
            _id: 'user-1',
            email: 'user1@example.com',
            firstName: 'User',
            lastName: 'One',
            institution: {
                _id: 'inst-1',
                name: 'Old Institution Name',
                status: 'active'
            }
        },
        {
            _id: 'user-2',
            email: 'user2@example.com',
            firstName: 'User',
            lastName: 'Two',
            institution: {
                _id: 'inst-1',
                name: 'Old Institution Name',
                status: 'inactive'
            }
        }
    ];

    const mockUsersWithDifferentInstitution = [
        {
            _id: 'user-3',
            email: 'user3@example.com',
            firstName: 'User',
            lastName: 'Three',
            institution: {
                _id: 'inst-2',
                name: 'Different Institution',
                status: 'active'
            }
        }
    ];

    const mockUsersWithoutInstitution = [
        {
            _id: 'user-4',
            email: 'user4@example.com',
            firstName: 'User',
            lastName: 'Four'
        }
    ];

    beforeEach(() => {
        mockUserDAO = {
            updateMany: jest.fn()
        };
        mockLogCollection = {};
        mockOrganizationCollection = {};
        mockNotificationsService = {};
        mockApplicationCollection = {};
        mockApprovedStudiesService = {};
        mockConfigurationService = {};
        mockInstitutionService = {};
        mockAuthorizationService = {};

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

        // Mock console.error
        console.error = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('successful scenarios', () => {
        it('should update users with matching institution ID and different name', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution Name';
            const institutionStatus = 'active';
            
            const expectedQuery = {
                "institution._id": institutionID,
                OR: [
                    { "institution.name": { not: institutionName } },
                    { "institution.status": { not: institutionStatus } }
                ]
            };
            
            const expectedUpdate = {
                "institution.name": institutionName,
                "institution.status": institutionStatus,
                updateAt: new Date('2023-12-01T00:00:00Z')
            };
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expectedUpdate);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should update users with matching institution ID and different status', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Old Institution Name';
            const institutionStatus = 'suspended';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should update users with matching institution ID and both different name and status', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Completely New Institution';
            const institutionStatus = 'pending';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should not update users when no changes are needed', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Old Institution Name';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('query structure validation', () => {
        it('should build correct query with institution ID and OR conditions', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Name';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            const expectedQuery = {
                "institution._id": institutionID,
                OR: [
                    { "institution.name": { not: institutionName } },
                    { "institution.status": { not: institutionStatus } }
                ]
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
        });

        it('should use correct update object with institution fields and timestamp', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            const expectedUpdate = {
                "institution.name": institutionName,
                "institution.status": institutionStatus,
                updateAt: new Date('2023-12-01T00:00:00Z')
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expect.any(Object), expectedUpdate);
        });
    });

    describe('input handling', () => {
        it('should handle string institution ID', async () => {
            // Arrange
            const institutionID = 'inst-123';
            const institutionName = 'Test Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    "institution._id": institutionID
                }),
                expect.any(Object)
            );
        });

        it('should handle string institution name', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Test Institution Name';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    "institution.name": institutionName
                })
            );
        });

        it('should handle string institution status', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Test Institution';
            const institutionStatus = 'suspended';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    "institution.status": institutionStatus
                })
            );
        });

        it('should handle empty string values', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = '';
            const institutionStatus = '';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    "institution.name": institutionName,
                    "institution.status": institutionStatus
                })
            );
        });
    });

    describe('error handling', () => {
        it('should complete without error when update returns zero count', async () => {
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';

            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should complete without error when update result is null', async () => {
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';

            mockUserDAO.updateMany.mockResolvedValue(null);

            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should complete without error when update result is undefined', async () => {
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';

            mockUserDAO.updateMany.mockResolvedValue(undefined);

            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should log error when updateMany throws', async () => {
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';

            const dbError = new Error('Database connection failed');
            mockUserDAO.updateMany.mockRejectedValue(dbError);

            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(ERROR.FAILED_UPDATE_USER_INSTITUTION, dbError);
        });
    });

    describe('performance and behavior', () => {
        it('should call updateMany only once per invocation', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple users with same institution ID', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 5 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle institution ID that does not exist', async () => {
            // Arrange
            const institutionID = 'nonexistent-inst';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should handle users with no institution data', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should handle special characters in institution name', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Institution & Co. (LLC) - Branch #1';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    "institution.name": institutionName
                })
            );
        });

        it('should handle long institution names', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Very Long Institution Name That Exceeds Normal Length Limits And Should Still Work Correctly In The System';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    "institution.name": institutionName
                })
            );
        });
    });

    describe('integration scenarios', () => {
        it('should work with getCurrentTime function', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    updateAt: getCurrentTime()
                })
            );
        });

        it('should handle different institution statuses', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Test Institution';
            const statuses = ['active', 'inactive', 'suspended', 'pending', 'approved', 'rejected'];
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act & Assert
            for (const status of statuses) {
                await userService.updateUserInstitution(institutionID, institutionName, status);
                expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                    expect.any(Object),
                    expect.objectContaining({
                        "institution.status": status
                    })
                );
            }
        });
    });

    describe('business logic validation', () => {
        it('should only update users with matching institution ID', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 2 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    "institution._id": institutionID
                }),
                expect.any(Object)
            );
        });

        it('should update users with different name or status', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 1 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            const expectedQuery = {
                "institution._id": institutionID,
                OR: [
                    { "institution.name": { not: institutionName } },
                    { "institution.status": { not: institutionStatus } }
                ]
            };
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(expectedQuery, expect.any(Object));
        });

        it('should not update users with matching name and status', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'Old Institution Name';
            const institutionStatus = 'active';
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 0 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledTimes(1);
            // The query should still be executed but no users should match
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should update timestamp for all modified users', async () => {
            // Arrange
            const institutionID = 'inst-1';
            const institutionName = 'New Institution';
            const institutionStatus = 'active';
            const { getCurrentTime } = require('../../crdc-datahub-database-drivers/utility/time-utility');
            
            mockUserDAO.updateMany.mockResolvedValue({ count: 3 });

            // Act
            await userService.updateUserInstitution(institutionID, institutionName, institutionStatus);

            // Assert
            expect(mockUserDAO.updateMany).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    updateAt: getCurrentTime()
                })
            );
        });
    });
}); 