const { SubmissionRequest } = require("../../services/submission-request");

// Mock dependencies
const mockLogCollection = { insert: jest.fn() };
const mockSubmissionRequestCollection = { find: jest.fn(), update: jest.fn(), delete: jest.fn() };
const mockApprovedStudiesService = {};
const mockUserService = {
    getUsersByNotifications: jest.fn(),
    findByIDs: jest.fn()
};
const mockDbService = {};
const mockNotificationsService = {
    inactiveSubmissionRequestsNotification: jest.fn()
};
const mockEmailParams = {
    inactiveDays: 180,
    inactiveNewApplicationDays: 30,
    url: 'http://test.com',
    officialEmail: 'test@example.com'
};
const mockProgramService = {};
const mockConfigurationService = {};
const mockAuthorizationService = {};

describe('deleteInactiveSubmissionRequests Error Handling', () => {
    let submissionRequestService;
    let mockSubmissionRequestDAO;
    let originalGlobals;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Store original global values to restore later
        originalGlobals = {
            DELETED: global.DELETED,
            EMAIL_NOTIFICATIONS: global.EMAIL_NOTIFICATIONS,
            ROLES: global.ROLES
        };
        
        // Mock constants
        global.DELETED = 'DELETED';
        global.EMAIL_NOTIFICATIONS = {
            SUBMISSION_REQUEST: {
                REQUEST_DELETE: 'REQUEST_DELETE'
            }
        };
        global.ROLES = {
            FEDERAL_LEAD: 'FEDERAL_LEAD',
            DATA_COMMONS_PERSONNEL: 'DATA_COMMONS_PERSONNEL',
            ADMIN: 'ADMIN'
        };
        
        // Create mock DAO
        mockSubmissionRequestDAO = {
            getInactiveSubmissionRequest: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            clearNextRevisionIdPointingTo: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
        };
        
        submissionRequestService = new SubmissionRequest(
            mockLogCollection,
            mockSubmissionRequestCollection,
            mockApprovedStudiesService,
            mockUserService,
            mockDbService,
            mockNotificationsService,
            mockEmailParams,
            mockProgramService,
            null,
            mockConfigurationService,
            null
        );
        
        // Inject mock DAO
        submissionRequestService.submissionRequestDAO = mockSubmissionRequestDAO;
    });

    afterEach(() => {
        // Restore original global values
        if (originalGlobals) {
            global.DELETED = originalGlobals.DELETED;
            global.EMAIL_NOTIFICATIONS = originalGlobals.EMAIL_NOTIFICATIONS;
            global.ROLES = originalGlobals.ROLES;
        }
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Final cleanup
        jest.restoreAllMocks();
    });

    describe('Error Handling Improvements', () => {
        test('should handle database query failures with try-catch', async () => {
            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockRejectedValueOnce(new Error('Database connection failed'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            try {
                await expect(submissionRequestService.deleteInactiveSubmissionRequests()).rejects.toThrow('Database connection failed');
                expect(consoleSpy).toHaveBeenCalledWith('Error in deleteInactiveSubmissionRequests task:', expect.any(Error));
            } finally {
                consoleSpy.mockRestore();
            }
        });

        test('should handle no inactive submission requests gracefully', async () => {
            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce([]) // default window
                .mockResolvedValueOnce([]); // short window

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                expect(consoleSpy).toHaveBeenCalledWith('No inactive submission requests found to delete');
                expect(mockSubmissionRequestDAO.update).not.toHaveBeenCalled();
            } finally {
                consoleSpy.mockRestore();
            }
        });

        test('should handle undefined submission requests array gracefully', async () => {
            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(undefined) // default window
                .mockResolvedValueOnce(undefined); // short window

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                expect(consoleSpy).toHaveBeenCalledWith('No inactive submission requests found to delete');
                expect(mockSubmissionRequestDAO.update).not.toHaveBeenCalled();
            } finally {
                consoleSpy.mockRestore();
            }
        });

        test('should log when submission requests are found', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'app1',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    studyAbbreviation: 'TEST-STUDY',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests) // default window
                .mockResolvedValueOnce([]); // short window
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            mockSubmissionRequestDAO.update.mockResolvedValue({});

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                expect(consoleSpy).toHaveBeenCalledWith('Found 1 inactive submission requests to process');
            } finally {
                consoleSpy.mockRestore();
            }
        });

        test('does not prune revision chain when submissionRequest is marked Deleted', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'app1',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    studyAbbreviation: 'TEST-STUDY',
                    studyName: 'Test Study',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01'),
                },
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests)
                .mockResolvedValueOnce([]);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            mockSubmissionRequestDAO.update.mockResolvedValue(true);

            await submissionRequestService.deleteInactiveSubmissionRequests();

            expect(mockSubmissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });

        test('does not prune revision chain after hard-deleting empty New submissionRequest', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'empty-app',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    status: 'New',
                    history: [],
                    updatedAt: new Date('2023-01-01'),
                },
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests)
                .mockResolvedValueOnce([]);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            mockSubmissionRequestDAO.delete.mockResolvedValue({ _id: 'empty-app' });

            await submissionRequestService.deleteInactiveSubmissionRequests();

            expect(mockSubmissionRequestDAO.delete).toHaveBeenCalledWith('empty-app');
            expect(mockSubmissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });

        test('does not prune revision chain when empty New submissionRequest delete fails', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'empty-app',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    status: 'New',
                    history: [],
                    updatedAt: new Date('2023-01-01'),
                },
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests)
                .mockResolvedValueOnce([]);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            mockSubmissionRequestDAO.delete.mockResolvedValue(null);

            await submissionRequestService.deleteInactiveSubmissionRequests();

            expect(mockSubmissionRequestDAO.delete).toHaveBeenCalledWith('empty-app');
            expect(mockSubmissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('Promise.allSettled Behavior', () => {
        test('should handle partial failures in batch operations', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'app1',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    studyAbbreviation: 'TEST-STUDY',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                },
                {
                    _id: 'app2',
                    applicantID: 'user2',
                    applicant: { applicantEmail: 'user2@test.com', applicantName: 'User 2' },
                    studyAbbreviation: 'TEST-STUDY-2',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests) // default window
                .mockResolvedValueOnce([]); // short window
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            
            // First update succeeds, second fails
            mockSubmissionRequestDAO.update
                .mockResolvedValueOnce({}) // app1 succeeds
                .mockRejectedValueOnce(new Error('Update failed')); // app2 fails

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                // Should log successful processing
                expect(consoleSpy).toHaveBeenCalledWith('Found 2 inactive submission requests to process');
                expect(consoleSpy).toHaveBeenCalledWith('Successfully processed 1 inactive submission requests');
                
                // Should log the failure
                expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update 1 submission requests:', expect.any(Array));
            } finally {
                consoleSpy.mockRestore();
                consoleErrorSpy.mockRestore();
            }
        });

        test('should only send emails for successfully updated submission requests', async () => {
            const mockSubmissionRequests = [
                {
                    _id: 'app1',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    studyAbbreviation: 'TEST-STUDY',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                },
                {
                    _id: 'app2',
                    applicantID: 'user2',
                    applicant: { applicantEmail: 'user2@test.com', applicantName: 'User 2' },
                    studyAbbreviation: 'TEST-STUDY-2',
                    status: 'In Progress',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockSubmissionRequests) // default window
                .mockResolvedValueOnce([]); // short window
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            
            // First update succeeds, second fails
            mockSubmissionRequestDAO.update
                .mockResolvedValueOnce({}) // app1 succeeds
                .mockRejectedValueOnce(new Error('Update failed')); // app2 fails

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                // Should log successful processing
                expect(consoleSpy).toHaveBeenCalledWith('Found 2 inactive submission requests to process');
                expect(consoleSpy).toHaveBeenCalledWith('Successfully processed 1 inactive submission requests');
                
                // Should log the failure
                expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update 1 submission requests:', expect.any(Array));
                
                // Verify that only 1 email notification was attempted (for the successful update)
                expect(consoleSpy).toHaveBeenCalledWith('Sent 1 email notifications for inactive submission requests');
            } finally {
                consoleSpy.mockRestore();
                consoleErrorSpy.mockRestore();
            }
        });

        test('inactiveSubmissionRequestsNotification receives studyName and study NA for blank New SRF', async () => {
            const mockShortApps = [
                {
                    _id: 'app2',
                    applicantID: 'user2',
                    applicant: { applicantEmail: 'user2@test.com', applicantName: 'User 2' },
                    questionnaireData: '{}',
                    studyAbbreviation: undefined,
                    studyName: undefined,
                    programName: undefined,
                    status: 'New',
                    ORCID: undefined,
                    PI: undefined,
                    programAbbreviation: undefined,
                    programDescription: undefined,
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce([]) // default window
                .mockResolvedValueOnce(mockShortApps); // short window
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([
                { _id: 'user2', notifications: ['submission_request:deleted'] }
            ]);
            mockSubmissionRequestDAO.delete.mockResolvedValue({});

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                expect(mockNotificationsService.inactiveSubmissionRequestsNotification).toHaveBeenCalledWith(
                    'user2@test.com',
                    [],
                    [],
                    expect.objectContaining({
                        firstName: 'User 2',
                        studyName: 'NA'
                    }),
                    expect.objectContaining({
                        study: 'NA',
                        inactiveDays: 30,
                        url: 'http://test.com'
                    })
                );
            } finally {
                consoleSpy.mockRestore();
            }
        });

        test('should detect and permanently delete blank New SRFs', async () => {
            const mockDefaultApps = [
                {
                    _id: 'app1',
                    applicantID: 'user1',
                    applicant: { applicantEmail: 'user1@test.com', applicantName: 'User 1' },
                    studyAbbreviation: 'TEST-STUDY',
                    status: 'In Progress',
                    programName: 'Program1',
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            const mockShortApps = [
                {
                    _id: 'app2',
                    applicantID: 'user2',
                    applicant: { applicantEmail: 'user2@test.com', applicantName: 'User 2' },
                    studyAbbreviation: undefined,
                    studyName: undefined,
                    programName: undefined,
                    status: 'New',
                    ORCID: undefined,
                    PI: undefined,
                    programAbbreviation: undefined,
                    programDescription: undefined,
                    history: [],
                    updatedAt: new Date('2023-01-01')
                }
            ];

            mockSubmissionRequestDAO.getInactiveSubmissionRequest
                .mockResolvedValueOnce(mockDefaultApps) // default window
                .mockResolvedValueOnce(mockShortApps); // short window
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByIDs.mockResolvedValue([]);
            mockSubmissionRequestDAO.update.mockResolvedValue({});
            mockSubmissionRequestDAO.delete.mockResolvedValue({});

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            try {
                await submissionRequestService.deleteInactiveSubmissionRequests();

                // Should have 2 apps total (one from default, one blank from short)
                expect(consoleSpy).toHaveBeenCalledWith('Found 2 inactive submission requests to process');
                // delete should be called for blank New SRF
                expect(mockSubmissionRequestDAO.delete).toHaveBeenCalledWith('app2');
                // update should be called for the default app
                expect(mockSubmissionRequestDAO.update).toHaveBeenCalled();
            } finally {
                consoleSpy.mockRestore();
            }
        });
    });

    describe('Method Structure Validation', () => {
        test('should have try-catch wrapper', () => {
            const methodString = submissionRequestService.deleteInactiveSubmissionRequests.toString();
            expect(methodString).toContain('try {');
            expect(methodString).toContain('} catch (error) {');
        });

        test('should use Promise.allSettled for batch operations', () => {
            const methodString = submissionRequestService.deleteInactiveSubmissionRequests.toString();
            expect(methodString).toContain('Promise.allSettled');
        });

        test('should log error and re-throw', () => {
            const methodString = submissionRequestService.deleteInactiveSubmissionRequests.toString();
            expect(methodString).toContain('console.error');
            expect(methodString).toContain('throw error');
        });
    });
});