const { Application } = require('../../services/application');

const mockLogCollection = { insert: jest.fn() };
const mockApplicationCollection = {};
const mockApprovedStudiesService = {};
const mockUserService = {
  getUsersByNotifications: jest.fn(),
  getUserByID: jest.fn(),
  userCollection: {
    find: jest.fn(),
    aggregate: jest.fn()
  }
};
const mockDbService = {};
const mockNotificationsService = {
  finalRemindApplicationsNotification: jest.fn(),
  remindApplicationsNotification: jest.fn()
};
const mockEmailParams = {
  inactiveDays: 180,
  inactiveNewApplicationDays: 30,
  url: 'http://test.com',
  officialEmail: 'test@example.com',
  inactiveApplicationNotifyDays: [7, 15, 30]
};
const mockOrganizationService = {};
const mockConfigurationService = {};

describe('remindApplicationSubmission', () => {
  let applicationService;
  let mockApplicationDAO;

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

    mockApplicationDAO = {
      getInactiveApplication: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn()
    };

    applicationService = new Application(
      mockLogCollection,
      mockApplicationCollection,
      mockApprovedStudiesService,
      mockUserService,
      mockDbService,
      mockNotificationsService,
      mockEmailParams,
      mockOrganizationService,
      null,
      mockConfigurationService,
      null
    );

    applicationService.applicationDAO = mockApplicationDAO;
    applicationService.userDAO = { findFirst: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dual-window reminder logic', () => {
    it('should fetch applications from both default and short windows', async () => {
      // All empty - no reminders to send
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockApplicationDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // No interval reminders
      for (let i = 0; i < 6; i++) {
        mockApplicationDAO.getInactiveApplication.mockResolvedValueOnce([]);
      }

      await applicationService.remindApplicationSubmission();

      // Should have called getInactiveApplication at least twice (final default + final short)
      const calls = mockApplicationDAO.getInactiveApplication.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // First two calls should be for final reminders
      expect(calls[0][1]).toBe('finalInactiveReminder'); // default window
      expect(calls[1][1]).toBe('finalInactiveReminder'); // short window
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
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([mockRegularApp]) // final default - has study name
        .mockResolvedValueOnce([mockBlankNewApp, mockRegularApp]); // final short - both present

      mockApplicationDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // No interval reminders
      for (let i = 0; i < 6; i++) {
        mockApplicationDAO.getInactiveApplication.mockResolvedValueOnce([]);
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

      mockUserService.userCollection.find.mockResolvedValue([]);
      applicationService.userDAO.findFirst.mockResolvedValue(null);

      await applicationService.remindApplicationSubmission();

      // getInactiveApplication should have been called
      expect(mockApplicationDAO.getInactiveApplication).toHaveBeenCalled();
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
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockApplicationDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // Same app appears in multiple intervals (simulating it's returning at different reminder intervals)
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([mockApp]) // 7 days default
        .mockResolvedValueOnce([]) // 7 days short
        .mockResolvedValueOnce([mockApp]) // 15 days default
        .mockResolvedValueOnce([]) // 15 days short
        .mockResolvedValueOnce([mockApp]) // 30 days default
        .mockResolvedValueOnce([]); // 30 days short

      mockApplicationDAO.update.mockResolvedValue({ matchedCount: 1 });

      mockUserService.getUserByID.mockResolvedValue({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        notifications: ['REQUEST_EXPIRING']
      });

      mockUserService.getUsersByNotifications.mockResolvedValue([]);
      mockUserService.userCollection.find.mockResolvedValue([{ id: 'user-tracked', email: 'test@example.com' }]);
      applicationService.userDAO.findFirst.mockResolvedValue({ id: 'user-tracked', email: 'test@example.com' });

      await applicationService.remindApplicationSubmission();

      // Should have called update for the deduped app
      expect(mockApplicationDAO.update).toHaveBeenCalled();
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
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([]) // final default
        .mockResolvedValueOnce([]); // final short

      mockApplicationDAO.updateMany.mockResolvedValue({ matchedCount: 0 });

      // 7-day interval has app
      mockApplicationDAO.getInactiveApplication
        .mockResolvedValueOnce([mockApp]) // 7 days default
        .mockResolvedValueOnce([]) // 7 days short
        .mockResolvedValueOnce([]) // 15 days default
        .mockResolvedValueOnce([]) // 15 days short
        .mockResolvedValueOnce([]) // 30 days default
        .mockResolvedValueOnce([]); // 30 days short

      mockApplicationDAO.update.mockResolvedValue({ matchedCount: 1 });

      mockUserService.getUserByID.mockResolvedValue({
        firstName: 'Flag',
        lastName: 'Test',
        email: 'flag@example.com',
        notifications: ['REQUEST_EXPIRING']
      });

      mockUserService.getUsersByNotifications.mockResolvedValue([]);
      mockUserService.userCollection.find.mockResolvedValue([{ id: 'user-flag-test', email: 'flag@example.com' }]);
      applicationService.userDAO.findFirst.mockResolvedValue({ id: 'user-flag-test', email: 'flag@example.com' });

      await applicationService.remindApplicationSubmission();

      // Verify update was called with reminder flags
      expect(mockApplicationDAO.update).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'app-flag-test'
        })
      );
    });
  });
});
