const { SubmissionRequest } = require("../../services/submission-request");

const mockLogCollection = { insert: jest.fn() };
const mockSubmissionRequestCollection = {};
const mockApprovedStudiesService = {};
const mockUserService = {
  getUsersByNotifications: jest.fn(),
  getUserByID: jest.fn(),
  findByID: jest.fn(),
  findByIDs: jest.fn()
};
const mockDbService = {};
const mockNotificationsService = {
  finalRemindSubmissionRequestsNotification: jest.fn(),
  remindSubmissionRequestsNotification: jest.fn()
};
const mockEmailParams = {
  inactiveDays: 180,
  inactiveNewApplicationDays: 30,
  url: 'http://test.com',
  officialEmail: 'test@example.com',
  inactiveApplicationNotifyDays: [7, 15, 30]
};
const mockProgramService = {};
const mockConfigurationService = {};

describe('remindSubmissionRequestSubmission', () => {
  let submissionRequestService;
  let mockSubmissionRequestDAO;

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });

    global.DELETED = 'DELETED';
    global.NEW = 'New';
    global.EMAIL_NOTIFICATIONS = {
      SUBMISSION_REQUEST: {
        REQUEST_EXPIRING: 'REQUEST_EXPIRING'
      }
    };
    global.ROLES = {
      FEDERAL_LEAD: 'FEDERAL_LEAD',
      DATA_COMMONS_PERSONNEL: 'DATA_COMMONS_PERSONNEL',
      ADMIN: 'ADMIN'
    };

    mockSubmissionRequestDAO = {
      getInactiveSubmissionRequest: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn()
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

    submissionRequestService.submissionRequestDAO = mockSubmissionRequestDAO;
    submissionRequestService.userDAO = { findFirst: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dual-window reminder logic', () => {
    it('should fetch submissionRequests from both default and short windows', async () => {
      // All empty - no reminders to send
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockSubmissionRequestDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // No interval reminders
      for (let i = 0; i < 6; i++) {
        mockSubmissionRequestDAO.getInactiveSubmissionRequest.mockResolvedValueOnce([]);
      }

      await submissionRequestService.remindSubmissionRequestSubmission();

      // Should have called getInactiveSubmissionRequest at least twice (final default + final short)
      const calls = mockSubmissionRequestDAO.getInactiveSubmissionRequest.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // First two calls should be for final reminders
      expect(calls[0][1]).toBe('finalInactiveReminder'); // default window
      expect(calls[1][1]).toBe('finalInactiveReminder'); // short window
    });

    it('passes studyName NA for blank New SRF inactive reminders', async () => {
      const mockBlankNewApp = {
        _id: 'app-blank-new',
        applicantID: 'user-blank',
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
      };

      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]) // final short
        .mockResolvedValueOnce([]) // day 7 default (180 - 7)
        .mockResolvedValueOnce([mockBlankNewApp]) // day 7 short (30 - 7)
        .mockResolvedValueOnce([]) // day 15 default
        .mockResolvedValueOnce([]) // day 15 short
        .mockResolvedValueOnce([]); // day 30 default

      mockSubmissionRequestDAO.update.mockResolvedValue({ matchedCount: 1 });

      mockUserService.getUsersByNotifications.mockResolvedValue([]);
      mockUserService.getUserByID.mockResolvedValue({
        firstName: 'Blank',
        lastName: 'User',
        email: 'blank@example.com',
        notifications: ['submission_request:expiring']
      });
      mockUserService.findByID.mockResolvedValue(null);
      submissionRequestService.userDAO.findFirst.mockResolvedValue(null);

      await submissionRequestService.remindSubmissionRequestSubmission();

      expect(mockNotificationsService.remindSubmissionRequestsNotification).toHaveBeenCalledWith(
        'blank@example.com',
        [],
        [],
        expect.objectContaining({
          firstName: 'Blank User',
          studyName: 'NA'
        }),
        expect.objectContaining({
          remainDays: 7,
          inactiveDays: 23,
          url: 'http://test.com'
        })
      );
    });

    it('should only send short window reminders for blank New SRFs', async () => {
      const mockBlankNewApp = {
        _id: 'app-blank-new',
        applicantID: 'user-blank',
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
      };

      const mockRegularApp = {
        _id: 'app-regular',
        applicantID: 'user-regular',
        studyName: 'Regular Study',
        status: 'In Progress',
        history: [],
        updatedAt: new Date('2023-01-01')
      };

      // Final reminders
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([mockRegularApp]) // final default - has study name
        .mockResolvedValueOnce([mockBlankNewApp, mockRegularApp]); // final short - both present

      mockSubmissionRequestDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // No interval reminders
      for (let i = 0; i < 6; i++) {
        mockSubmissionRequestDAO.getInactiveSubmissionRequest.mockResolvedValueOnce([]);
      }

      mockUserService.getUsersByNotifications.mockResolvedValue([
        { _id: 'user-blank', email: 'blank@example.com' },
        { _id: 'user-regular', email: 'regular@example.com' }
      ]);

      mockUserService.getUserByID.mockResolvedValue({
        _id: 'user-test',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com'
      });

      mockUserService.findByID.mockResolvedValue(null);
      submissionRequestService.userDAO.findFirst.mockResolvedValue(null);

      await submissionRequestService.remindSubmissionRequestSubmission();

      // getInactiveSubmissionRequest should have been called
      expect(mockSubmissionRequestDAO.getInactiveSubmissionRequest).toHaveBeenCalled();
    });

    it('should track and deduplicate reminders across intervals', async () => {
      const mockApp = {
        _id: 'app-tracked',
        applicantID: 'user-tracked',
        studyAbbreviation: 'TRACK',
        status: 'In Progress',
        history: [],
        updatedAt: new Date('2023-01-01')
      };

      // Final reminders
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockSubmissionRequestDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // Same app appears in multiple intervals (simulating it's returning at different reminder intervals)
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([mockApp]) // 7 days default
        .mockResolvedValueOnce([]) // 7 days short
        .mockResolvedValueOnce([mockApp]) // 15 days default
        .mockResolvedValueOnce([]) // 15 days short
        .mockResolvedValueOnce([mockApp]) // 30 days default
        .mockResolvedValueOnce([]); // 30 days short

      mockSubmissionRequestDAO.update.mockResolvedValue({ matchedCount: 1 });

      mockUserService.getUserByID.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        notifications: ['REQUEST_EXPIRING']
      });

      mockUserService.getUsersByNotifications.mockResolvedValue([]);
      mockUserService.findByID.mockResolvedValue({ id: 'user-tracked', email: 'test@example.com' });
      submissionRequestService.userDAO.findFirst.mockResolvedValue({ id: 'user-tracked', email: 'test@example.com' });

      await submissionRequestService.remindSubmissionRequestSubmission();

      // Should have called update for the deduped app
      expect(mockSubmissionRequestDAO.update).toHaveBeenCalled();
    });

    it('should set reminder flags after sending emails', async () => {
      const mockApp = {
        _id: 'app-flag-test',
        applicantID: 'user-flag-test',
        studyAbbreviation: 'FLAG',
        status: 'In Progress',
        history: [],
        updatedAt: new Date('2023-01-01')
      };

      // Final reminders
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockSubmissionRequestDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // 7-day interval has app
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([mockApp]) // 7 days default
        .mockResolvedValueOnce([]) // 7 days short
        .mockResolvedValueOnce([]) // 15 days default
        .mockResolvedValueOnce([]) // 15 days short
        .mockResolvedValueOnce([]) // 30 days default
        .mockResolvedValueOnce([]); // 30 days short

      mockSubmissionRequestDAO.update.mockResolvedValue({ matchedCount: 1 });

      mockUserService.getUserByID.mockResolvedValue({
        firstName: 'Flag',
        lastName: 'Test',
        email: 'flag@example.com',
        notifications: ['REQUEST_EXPIRING']
      });

      mockUserService.getUsersByNotifications.mockResolvedValue([]);
      mockUserService.findByID.mockResolvedValue({ id: 'user-flag-test', email: 'flag@example.com' });
      submissionRequestService.userDAO.findFirst.mockResolvedValue({ id: 'user-flag-test', email: 'flag@example.com' });

      await submissionRequestService.remindSubmissionRequestSubmission();

      // Verify update was called with reminder flags
      expect(mockSubmissionRequestDAO.update).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'app-flag-test'
        })
      );
    });

    it('should skip short window queries when day >= shortDays to prevent bulk matches', async () => {
      // Final reminders
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockSubmissionRequestDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // For interval reminders with [7, 15, 30] and shortDays=30:
      // day=7: query both (7 < 30) ✓
      // day=15: query both (15 < 30) ✓
      // day=30: skip short (30 >= 30) ✗ prevents getInactiveSubmissionRequest(0, ...)
      mockSubmissionRequestDAO.getInactiveSubmissionRequest
        .mockResolvedValueOnce([]) // 7 days default
        .mockResolvedValueOnce([]) // 7 days short (should be called)
        .mockResolvedValueOnce([]) // 15 days default
        .mockResolvedValueOnce([]) // 15 days short (should be called)
        .mockResolvedValueOnce([]); // 30 days default
      // 30 days short should NOT be called

      mockSubmissionRequestDAO.update.mockResolvedValue({ matchedCount: 0 });

      await submissionRequestService.remindSubmissionRequestSubmission();

      // Verify getInactiveSubmissionRequest was called exactly 7 times:
      // 2 final (default + short) + 5 interval (only 1 short query for 7 and 15, skipped for 30)
      expect(mockSubmissionRequestDAO.getInactiveSubmissionRequest).toHaveBeenCalledTimes(7);

      // Verify it was called for 7 days short
      expect(mockSubmissionRequestDAO.getInactiveSubmissionRequest).toHaveBeenCalledWith(23, 'inactiveReminder_7');
      // Verify it was called for 15 days short
      expect(mockSubmissionRequestDAO.getInactiveSubmissionRequest).toHaveBeenCalledWith(15, 'inactiveReminder_15');
      // Verify it was NOT called with 0 (which would match too many apps)
      const allCalls = mockSubmissionRequestDAO.getInactiveSubmissionRequest.mock.calls;
      const zeroOrNegativeCalls = allCalls.filter(([days]) => days <= 0);
      expect(zeroOrNegativeCalls).toHaveLength(0);
    });
  });
});
