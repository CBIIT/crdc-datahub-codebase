const { Application, VALID_ORDER_BY_LIST_APPLICATIONS } = require('../../services/application');
const ApplicationDAO = require('../../dao/application');
const USER_PERMISSION_CONSTANTS = require("../../crdc-datahub-database-drivers/constants/user-permission-constants");
const ERROR = require('../../constants/error-constants');
const { NEW, APPROVED, IN_PROGRESS, INQUIRED, REOPENED, CANCELED, REJECTED, DELETED, SUBMITTED, IN_REVIEW } = require('../../constants/application-constants');
const USER_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-constants');

// Mock ApplicationDAO
jest.mock('../../dao/application');

// Mocks for dependencies
const mockLogCollection = { insert: jest.fn() };
const mockApplicationCollection = {
    find: jest.fn(),
    insert: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    distinct: jest.fn()
};
const mockApprovedStudiesService = {
    findByStudyName: jest.fn(),
    findByStudyNames: jest.fn(),
    findByApplicationID: jest.fn(),
    storeApprovedStudies: jest.fn(),
    saveApprovedStudyFromApplication: jest.fn(),
};
const mockUserService = {
    userCollection: { find: jest.fn(), aggregate: jest.fn() },
    getUsersByNotifications: jest.fn(),
    getUserByID: jest.fn(),
    updateUserInfo: jest.fn(),
};
const mockDbService = { updateOne: jest.fn(), updateMany: jest.fn() };
const mockNotificationsService = {
    approveQuestionNotification: jest.fn(),
    cancelApplicationNotification: jest.fn(),
    restoreApplicationNotification: jest.fn(),
    finalRemindApplicationsNotification: jest.fn(),
    remindApplicationsNotification: jest.fn(),
    multipleChangesApproveQuestionNotification: jest.fn(),
    dbGapMissingApproveQuestionNotification: jest.fn(),
    dataModelChangeApproveQuestionNotification: jest.fn(),
    pendingGPANotification: jest.fn(),
    pendingImageDeIdentificationApproveQuestionNotification: jest.fn(),
    inquireQuestionNotification: jest.fn()
};
const mockEmailParams = { inactiveDays: 180, inactiveApplicationNotifyDays: [7, 30, 60], conditionalSubmissionContact: 'contact@email', url: 'http://test', submissionGuideURL: 'http://guide' };
const mockOrganizationService = {
    findOneByProgramName: jest.fn().mockResolvedValue(null),
    upsertByProgramName: jest.fn(),
    getOrganizationByID: jest.fn(),
    organizationCollection: { update: jest.fn() }
};
const mockInstitutionService = { addNewInstitutions: jest.fn() };
const mockConfigurationService = { findByType: jest.fn() };
const mockAuthorizationService = { getPermissionScope: jest.fn() };

// Mocked constants and helpers
global.APPLICATION = 'Application';
global.USER_PERMISSION_CONSTANTS = {
    SUBMISSION_REQUEST: {
        VIEW: 'VIEW',
        CREATE: 'CREATE',
        SUBMIT: 'SUBMIT',
        CANCEL: 'CANCEL',
        REVIEW: 'REVIEW'
    }
};
global.HistoryEventBuilder = { createEvent: jest.fn(() => ({ dateTime: Date.now() })) };
jest.mock('../../crdc-datahub-database-drivers/domain/log-events', () => ({
    CreateApplicationEvent: { create: jest.fn(() => ({ eventType: 'CREATE_APPLICATION' })) },
    UpdateApplicationStateEvent: {
        create: jest.fn(() => ({ eventType: 'UPDATE_APPLICATION_STATE' })),
        createByApp: jest.fn(() => ({ eventType: 'UPDATE_APPLICATION_STATE' })),
    },
}));
const {
    CreateApplicationEvent,
    UpdateApplicationStateEvent,
} = require('../../crdc-datahub-database-drivers/domain/log-events');
global.verifySession = jest.fn(() => ({ verifyInitialized: jest.fn() }));
global.verifyApplication = jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    state: jest.fn().mockReturnThis(),
    isUndefined: jest.fn().mockReturnThis()
}));
global.replaceErrorString = (err, val) => err + val;
global.UserScope = { create: jest.fn() };
global.isTrue = v => !!v;
global.isUndefined = v => v === undefined;
global.getCurrentTime = () => 1234567890;
global.v4 = jest.fn(() => 'uuid');
global.formatName = user => `${user.firstName} ${user.lastName}`;
global.updateApplication = jest.fn((col, app) => app);
global.logStateChange = jest.fn();
global.getApplicationQuestionnaire = jest.fn(() => ({ accessTypes: [], study: {} }));
global.sendEmails = {
    submitApplication: jest.fn(),
    rejectApplication: jest.fn(),
    inquireApplication: jest.fn(),
    inactiveApplications: jest.fn()
};
global.getCCEmails = jest.fn(() => []);
global.getUserEmails = jest.fn(() => []);
global.setDefaultIfNoName = jest.fn(name => name || 'NA');
global.EMAIL_NOTIFICATIONS = {
    SUBMISSION_REQUEST: {
        REQUEST_DELETE: 'REQUEST_DELETE',
        REQUEST_REVIEW: 'REQUEST_REVIEW',
        REQUEST_CANCEL: 'REQUEST_CANCEL',
        REQUEST_EXPIRING: 'REQUEST_EXPIRING'
    }
};
global.ROLES = {
    FEDERAL_LEAD: 'Federal Lead',
    DATA_COMMONS_PERSONNEL: 'Data Commons Personnel',
    ADMIN: 'Admin'
};
global.MongoPagination = jest.fn().mockImplementation(() => ({
    getPaginationPipeline: () => [],
    getNoLimitPipeline: () => []
}));
global.subtractDaysFromNow = jest.fn(() => new Date(Date.now() - 1000 * 60 * 60 * 24 * 181));
global.logDaysDifference = jest.fn();

describe('Application', () => {
    let app;
    let context;
    let userScopeMock;

    beforeEach(() => {
        jest.clearAllMocks();
        userScopeMock = {
            isNoneScope: jest.fn(() => false),
            isAllScope: jest.fn(() => true),
            isOwnScope: jest.fn(() => false)
        };
        UserScope.create.mockReturnValue(userScopeMock);
        mockAuthorizationService.getPermissionScope.mockResolvedValue(['all']);
        app = new Application(
            mockLogCollection,
            mockApplicationCollection,
            mockApprovedStudiesService,
            mockUserService,
            mockDbService,
            mockNotificationsService,
            mockEmailParams,
            mockOrganizationService,
            mockInstitutionService,
            mockConfigurationService,
            mockAuthorizationService
        );

        appService = new Application(
            mockLogCollection,
            {}, // applicationCollection (unused)
            mockApprovedStudiesService,
            mockUserService,
            mockDbService,
            mockNotificationsService,
            { inactiveDays: 180, inactiveApplicationNotifyDays: [7, 30], url: 'http://test', conditionalSubmissionContact: 'help@test.com' },
            mockOrganizationService,
            mockInstitutionService,
            mockConfigurationService,
            mockAuthorizationService
        );

        context = {
            userInfo: {
                _id: 'user1', firstName: 'John', lastName: 'Doe', email: 'john@doe.com', organization: { orgID: 'org1', orgName: 'Org' },
                role: ROLES.ADMIN, notifications: [USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW], permissions: ["dashboard:view",
                    "user:manage:all",
                    "submission_request:view",
                    "submission_request:review",
                    "submission_request:create",
                    "submission_request:submit",
                    "program:manage:all",
                    "study:manage:all",
                    "data_submission:view",
                    "data_submission:create",
                    "data_submission:confirm",
                    "access:request"]
            }
        };
    });

    describe('getApplication', () => {
        it('should return application with upgraded version', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            userScopeMock.isOwnScope.mockReturnValue(false);
            UserScope.create.mockReturnValue(userScopeMock);

            // Mock getApplicationById to return an application with APPROVED status and version '2.0'
            app.getApplicationById = jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED, version: '2.0' });
            // Mock _checkConditionalApproval to do nothing
            app._checkConditionalApproval = jest.fn().mockResolvedValue(undefined);
            // Mock _getApplicationVersionByStatus to return '2.0'
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('2.0');

            await expect(app.getApplication({ _id: 'app1' }, context)).resolves.toMatchObject({ _id: 'app1', version: '2.0' });

            expect(app.getApplicationById).toHaveBeenCalledWith('app1');
            expect(app._checkConditionalApproval).toHaveBeenCalledWith(expect.objectContaining({ _id: 'app1', status: APPROVED, version: '2.0' }));
            expect(app._getApplicationVersionByStatus).toHaveBeenCalledWith(APPROVED, '2.0');
        });

        it('calls _checkConditionalApproval when status matches Approved case-insensitively', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            UserScope.create.mockReturnValue(userScopeMock);

            app.getApplicationById = jest.fn().mockResolvedValue({ _id: 'app1', status: 'approved', version: '2.0' });
            app._checkConditionalApproval = jest.fn().mockResolvedValue(undefined);
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('2.0');

            await app.getApplication({ _id: 'app1' }, context);

            expect(app._checkConditionalApproval).toHaveBeenCalledWith(expect.objectContaining({ _id: 'app1', status: 'approved' }));
        });

        it('does not replace missing or whitespace-only studyAbbreviation with study name', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            UserScope.create.mockReturnValue(userScopeMock);

            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('3.0');

            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                studyName: 'Full Study',
                studyAbbreviation: null,
                applicant: { applicantID: 'u1', applicantName: 'Submitter', applicantEmail: 's@test.com' }
            });
            await expect(app.getApplication({ _id: 'app1' }, context)).resolves.toMatchObject({
                studyAbbreviation: null,
                studyName: 'Full Study'
            });

            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                studyName: 'Full Study',
                studyAbbreviation: '   ',
                applicant: { applicantID: 'u1', applicantName: 'Submitter', applicantEmail: 's@test.com' }
            });
            await expect(app.getApplication({ _id: 'app1' }, context)).resolves.toMatchObject({
                studyAbbreviation: '   ',
                studyName: 'Full Study'
            });
        });
    });

    describe('_getApplicationVersionByStatus', () => {
        it('returns new version for NEW/IN_PROGRESS/INQUIRED/REOPENED', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            // Patch: simulate status logic for new version
            await expect(app._getApplicationVersionByStatus(NEW)).resolves.toBe('3.0');
            await expect(app._getApplicationVersionByStatus(IN_PROGRESS)).resolves.toBe('3.0');
            await expect(app._getApplicationVersionByStatus(INQUIRED)).resolves.toBe('3.0');
            await expect(app._getApplicationVersionByStatus(REOPENED)).resolves.toBe('3.0');
        });

        it('returns current version for other status if version is null', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            await expect(app._getApplicationVersionByStatus(APPROVED)).resolves.toBe('2.0');
        });

        it('returns passed version if present', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            await expect(app._getApplicationVersionByStatus(APPROVED, '1.5')).resolves.toBe('1.5');
        });
    });

    describe('_checkConditionalApproval', () => {
        it('sets conditional and pendingConditions if needed', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ controlledAccess: true, dbGaPID: null, pendingModelChange: true }]);
            const application = { studyName: 'study1' };
            await app._checkConditionalApproval(application);
            expect(application.conditional).toBe(true);
            expect(application.pendingConditions).toContain(ERROR.CONTROLLED_STUDY_NO_DBGAPID);
            expect(application.pendingConditions).toContain(ERROR.PENDING_APPROVED_STUDY);
        });

        it('includes pending image de-identification in pendingConditions when applicable', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{
                controlledAccess: false,
                pendingModelChange: false,
                pendingImageDeIdentification: true
            }]);
            const application = { studyName: 'study1' };
            await app._checkConditionalApproval(application);
            expect(application.conditional).toBe(true);
            expect(application.pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
        });

        it('sets conditional false and empty pendingConditions when no studies found', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            const application = { studyName: 'study1' };
            await app._checkConditionalApproval(application);
            expect(application.conditional).toBe(false);
            expect(application.pendingConditions).toEqual([]);
        });
    });

    describe('_isTerminalRevisionStatus', () => {
        it('returns true for Rejected, Canceled, and Deleted', () => {
            expect(app._isTerminalRevisionStatus(REJECTED)).toBe(true);
            expect(app._isTerminalRevisionStatus(CANCELED)).toBe(true);
            expect(app._isTerminalRevisionStatus(DELETED)).toBe(true);
        });

        it('returns false for non-terminal statuses', () => {
            expect(app._isTerminalRevisionStatus(APPROVED)).toBe(false);
            expect(app._isTerminalRevisionStatus(REOPENED)).toBe(false);
            expect(app._isTerminalRevisionStatus(IN_PROGRESS)).toBe(false);
            expect(app._isTerminalRevisionStatus(null)).toBe(false);
            expect(app._isTerminalRevisionStatus("")).toBe(false);
        });

        it('treats status case-insensitively', () => {
            expect(app._isTerminalRevisionStatus('canceled')).toBe(true);
            expect(app._isTerminalRevisionStatus('Rejected')).toBe(true);
            expect(app._isTerminalRevisionStatus('Approved')).toBe(false);
        });
    });

    describe('_hasActiveLaterRevisions', () => {
        beforeEach(() => {
            app.applicationDAO.findApplicationStatusById = jest.fn();
        });

        it('returns false when there is no nextRevisionId', async () => {
            await expect(app._hasActiveLaterRevisions({ _id: 'seq1', status: APPROVED }))
                .resolves.toBe(false);
            expect(app.applicationDAO.findApplicationStatusById).not.toHaveBeenCalled();
        });

        it('returns true when the immediate successor is non-terminal', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: REOPENED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(true);

            expect(app.applicationDAO.findApplicationStatusById).toHaveBeenCalledWith('seq2');
        });

        it('returns true when the immediate successor is Approved', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: APPROVED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(true);

            expect(app.applicationDAO.findApplicationStatusById).toHaveBeenCalledTimes(1);
        });

        it('returns false when the immediate successor is terminal', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: CANCELED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(false);
        });

        it('returns false when the immediate successor is terminal even if nextRevisionId is set', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: CANCELED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(false);

            expect(app.applicationDAO.findApplicationStatusById).toHaveBeenCalledTimes(1);
        });

        it('throws when findApplicationStatusById fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            app.applicationDAO.findApplicationStatusById.mockRejectedValueOnce(new Error('not found'));

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'missing',
            })).rejects.toThrow(ERROR.INTERNAL_ERROR);

            expect(console.error).toHaveBeenCalled();
            console.error.mockRestore();
        });

        it('returns false when findApplicationStatusById resolves null', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce(null);

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'missing',
            })).resolves.toBe(false);
        });
    });

    describe('_hasApprovedParentSRF', () => {
        beforeEach(() => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('returns true when an Approved parent links to this application', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            });

            await expect(app._hasApprovedParentSRF({ _id: 'seq2', status: CANCELED }))
                .resolves.toBe(true);
            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).toHaveBeenCalledWith('seq2');
        });

        it('returns false when no Approved parent links to this application', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue(null);

            await expect(app._hasApprovedParentSRF({ _id: 'seq2', status: CANCELED }))
                .resolves.toBe(false);
        });

        it('returns false when application id is missing', async () => {
            await expect(app._hasApprovedParentSRF({ status: CANCELED }))
                .resolves.toBe(false);
            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });
    });

    describe('_computeCanBeReopened', () => {
        beforeEach(() => {
            app.applicationDAO.findApplicationStatusById = jest.fn();
        });

        it('returns true for Approved with no nextRevisionId', async () => {
            await expect(app._computeCanBeReopened({ status: APPROVED, nextRevisionId: null }))
                .resolves.toBe(true);
            await expect(app._computeCanBeReopened({ status: APPROVED }))
                .resolves.toBe(true);
            expect(app.applicationDAO.findApplicationStatusById).not.toHaveBeenCalled();
        });

        it('returns false when an active successor exists', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: REOPENED });

            await expect(app._computeCanBeReopened({
                status: APPROVED,
                nextRevisionId: 'successor-id',
            })).resolves.toBe(false);
        });

        it('returns true when all successors are terminal', async () => {
            app.applicationDAO.findApplicationStatusById.mockResolvedValueOnce({ status: CANCELED });

            await expect(app._computeCanBeReopened({
                status: APPROVED,
                nextRevisionId: 'successor-id',
            })).resolves.toBe(true);
        });

        it('returns false for non-approved statuses', async () => {
            await expect(app._computeCanBeReopened({ status: IN_PROGRESS })).resolves.toBe(false);
            await expect(app._computeCanBeReopened({ status: REOPENED })).resolves.toBe(false);
            await expect(app._computeCanBeReopened({ status: SUBMITTED })).resolves.toBe(false);
        });

        it('treats approved status case-insensitively', async () => {
            await expect(app._computeCanBeReopened({ status: 'approved', nextRevisionId: null }))
                .resolves.toBe(true);
        });

        it('returns the existing boolean without querying when canBeReopened is already set', async () => {
            await expect(app._computeCanBeReopened({
                status: IN_PROGRESS,
                canBeReopened: true,
            })).resolves.toBe(true);
            expect(app.applicationDAO.findApplicationStatusById).not.toHaveBeenCalled();
        });
    });

    describe('_computeCanBeRestored', () => {
        const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
        const validDeletedHistory = [{ status: IN_PROGRESS }, { status: DELETED }];

        beforeEach(() => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('returns true for Canceled sequence 1 with valid history', async () => {
            await expect(app._computeCanBeRestored({
                status: CANCELED,
                sequenceNumber: 1,
                history: validCanceledHistory,
            })).resolves.toBe(true);
            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });

        it('returns true for Deleted sequence 1 with valid history', async () => {
            await expect(app._computeCanBeRestored({
                status: DELETED,
                sequenceNumber: 1,
                history: validDeletedHistory,
            })).resolves.toBe(true);
        });

        it('returns false for Canceled sequence 1 when history is too short', async () => {
            await expect(app._computeCanBeRestored({
                status: CANCELED,
                sequenceNumber: 1,
                history: [{ status: CANCELED }],
            })).resolves.toBe(false);
        });

        it('returns true for linked Canceled revision when parent is Approved', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            });

            await expect(app._computeCanBeRestored({
                _id: 'seq2',
                status: CANCELED,
                sequenceNumber: 2,
                history: validCanceledHistory,
            })).resolves.toBe(true);
        });

        it('returns false for orphaned Canceled revision with valid history', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue(null);

            await expect(app._computeCanBeRestored({
                _id: 'seq2',
                status: CANCELED,
                sequenceNumber: 2,
                history: validCanceledHistory,
            })).resolves.toBe(false);
        });

        it('returns false for non-terminal statuses', async () => {
            await expect(app._computeCanBeRestored({ status: IN_PROGRESS, sequenceNumber: 1 }))
                .resolves.toBe(false);
            await expect(app._computeCanBeRestored({ status: APPROVED, sequenceNumber: 1 }))
                .resolves.toBe(false);
            await expect(app._computeCanBeRestored({ status: REOPENED, sequenceNumber: 2 }))
                .resolves.toBe(false);
        });

        it('defaults missing sequenceNumber to 1 when history is valid', async () => {
            await expect(app._computeCanBeRestored({
                status: DELETED,
                history: validDeletedHistory,
            })).resolves.toBe(true);
        });

        it('returns the existing boolean without querying when canBeRestored is already set', async () => {
            await expect(app._computeCanBeRestored({
                status: IN_PROGRESS,
                sequenceNumber: 2,
                canBeRestored: true,
            })).resolves.toBe(true);
            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });
    });

    describe('_computeSRFStateFields', () => {
        beforeEach(() => {
            app.applicationDAO.findApplicationStatusById = jest.fn();
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('sets canBeReopened and canBeRestored on the application object', async () => {
            const application = { status: APPROVED, nextRevisionId: null };
            await app._computeSRFStateFields(application);
            expect(application.canBeReopened).toBe(true);
            expect(application.canBeRestored).toBe(false);
        });

        it('sets canBeRestored true for linked canceled revisions', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            });
            const application = {
                _id: 'seq2',
                status: CANCELED,
                sequenceNumber: 2,
                history: [{ status: REOPENED }, { status: CANCELED }],
            };
            await app._computeSRFStateFields(application);
            expect(application.canBeReopened).toBe(false);
            expect(application.canBeRestored).toBe(true);
        });

        it('returns null when application is null', async () => {
            await expect(app._computeSRFStateFields(null)).resolves.toBeNull();
        });
    });

    describe('_batchComputeListApplicationFields', () => {
        beforeEach(() => {
            app.applicationDAO.findApplicationStatusesByIds = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);
        });

        it('returns an empty study map for an empty page', async () => {
            const result = await app._batchComputeListApplicationFields([]);

            expect(result.studyByLowerName).toEqual(new Map());
            expect(app.applicationDAO.findApplicationStatusesByIds).not.toHaveBeenCalled();
            expect(app.applicationDAO.findApprovedApplicationsByNextRevisionIds).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyNames).not.toHaveBeenCalled();
        });

        it('sets canBeReopened and canBeRestored from batch prefetched data', async () => {
            const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
            const rows = [
                { id: 'a1', status: APPROVED, nextRevisionId: 'successor-active', studyName: 'S1' },
                { id: 'c2', status: CANCELED, sequenceNumber: 2, history: validCanceledHistory, studyName: 'S2' },
            ];
            app.applicationDAO.findApplicationStatusesByIds.mockResolvedValue([
                { id: 'successor-active', status: REOPENED },
            ]);
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds.mockResolvedValue([
                { nextRevisionId: 'c2' },
            ]);

            await app._batchComputeListApplicationFields(rows);

            expect(app.applicationDAO.findApplicationStatusesByIds).toHaveBeenCalledWith(['successor-active']);
            expect(app.applicationDAO.findApprovedApplicationsByNextRevisionIds).toHaveBeenCalledWith(['c2']);
            expect(rows[0].canBeReopened).toBe(false);
            expect(rows[1].canBeRestored).toBe(true);
        });

        it('dedupes study names case-insensitively for findByStudyNames', async () => {
            const rows = [
                { id: 'a1', status: APPROVED, studyName: 'MyStudy' },
                { id: 'a2', status: APPROVED, studyName: 'mystudy' },
            ];

            await app._batchComputeListApplicationFields(rows);

            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledWith(['MyStudy']);
        });
    });

    describe('_pruneRevisionChainOnTerminal', () => {
        it('clears inbound nextRevisionId links via the DAO', async () => {
            app.applicationDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });

            await app._pruneRevisionChainOnTerminal('terminal-app-id');

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).toHaveBeenCalledWith('terminal-app-id');
        });

        it('does not call DAO when applicationId is falsy', async () => {
            app.applicationDAO.clearNextRevisionIdPointingTo = jest.fn();

            await app._pruneRevisionChainOnTerminal(null);

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('getApplicationById', () => {
        it('returns result from applicationDAO', async () => {
            app.applicationDAO = {
                findApplicationWithApplicantById: jest.fn().mockResolvedValue({
                    id: 'app1',
                    applicant: {
                        id: '',
                        firstName: '',
                        lastName: '',
                        email: ''
                    }
                })
            };
            await expect(app.getApplicationById('app1')).resolves.toEqual({
                _id: 'app1',
                id: 'app1',
                applicant: {
                    applicantEmail: '',
                    applicantID: '',
                    applicantName: '',
                },
                canBeReopened: false,
                canBeRestored: false,
            });
            expect(app.applicationDAO.findApplicationWithApplicantById).toHaveBeenCalledWith('app1');
        });

        it('throws if not found', async () => {
            app.applicationDAO = {
                findApplicationWithApplicantById: jest.fn().mockResolvedValue(null)
            };
            await expect(app.getApplicationById('app1')).rejects.toThrow(ERROR.APPLICATION_NOT_FOUND + 'app1');
        });
    });

    describe('createApplication', () => {
        it('creates and returns application', async () => {
            // Patch: use applicationDAO mock to avoid Prisma call
            app.applicationDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            const application = { controlledAccess: true };
            const userInfo = context.userInfo;
            await expect(app.createApplication(application, userInfo)).resolves.toMatchObject({ controlledAccess: true });
            expect(app.applicationDAO.insert).toHaveBeenCalled();
            expect(mockLogCollection.insert).toHaveBeenCalled();
        });

        it('defaults to New when no status is requested for new applications', async () => {
            app.applicationDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const application = { controlledAccess: true };
            const userInfo = context.userInfo;

            const result = await app.createApplication(application, userInfo);

            expect(result.status).toBe(NEW);
            expect(result.history).toHaveLength(1);
            expect(result.history[0]).toMatchObject({ userID: userInfo._id, status: NEW });
            expect(app.applicationDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ status: NEW }));
        });

        it('adds a New event before In Progress when requested', async () => {
            app.applicationDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const application = { controlledAccess: true };
            const userInfo = context.userInfo;

            const result = await app.createApplication(application, userInfo, IN_PROGRESS);

            expect(result.status).toBe(IN_PROGRESS);
            expect(result.history).toHaveLength(2);
            expect(result.history[0]).toMatchObject({ userID: userInfo._id, status: NEW });
            expect(result.history[1]).toMatchObject({ userID: userInfo._id, status: IN_PROGRESS });
            expect(new Date(result.history[0].dateTime).getTime()).toBeLessThan(new Date(result.history[1].dateTime).getTime());
            expect(app.applicationDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ status: IN_PROGRESS }));
        });

        it('initializes sequenceNumber to 1', async () => {
            app.applicationDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            await app.createApplication({}, context.userInfo);

            expect(app.applicationDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ sequenceNumber: 1 }));
        });
    });

    describe('saveApplication', () => {
        it('creates new application with New status if no status is provided', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            const params = { application: {} };
            jest.spyOn(app, 'createApplication').mockResolvedValue({ _id: 'app2' });
            await expect(app.saveApplication(params, context)).resolves.toEqual({ _id: 'app2' });
            expect(app.createApplication).toHaveBeenCalledWith({}, context.userInfo, NEW);
        });

        it('creates new application with In Progress status when requested', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            const params = { application: {}, status: IN_PROGRESS };
            jest.spyOn(app, 'createApplication').mockResolvedValue({ _id: 'app2' });
            await expect(app.saveApplication(params, context)).resolves.toEqual({ _id: 'app2' });
            expect(app.createApplication).toHaveBeenCalledWith({}, context.userInfo, IN_PROGRESS);
        });

        it("should throw an error when the application does not exist", async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            const params = { application: { _id: 'a-app-that-does-not-exist' } };

            await expect(app.saveApplication(params, context)).rejects.toThrow(ERROR.APPLICATION_NOT_FOUND);
        });

        it.each([CANCELED, REJECTED, DELETED, SUBMITTED, IN_REVIEW, APPROVED])('should throw error when trying to set the status to %s', async (status) => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            jest.spyOn(app, 'getApplicationById').mockResolvedValue({ _id: 'invalid-status-provided', applicant: { applicantID: 'user1' }, status: NEW });

            const params = { application: { _id: 'invalid-status-provided' }, status };
            await expect(app.saveApplication(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        });

        it("should throw an error if no status is provided", async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            jest.spyOn(app, 'getApplicationById').mockResolvedValue({ _id: 'no-status-provided', applicant: { applicantID: 'user1' }, status: NEW });

            const params = { application: { _id: 'no-status-provided' } }; // NOTE: We're omitting status param
            await expect(app.saveApplication(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        });

        it('throws if not owner', async () => {
            // Setup: the stored application has a different applicantID than the current user
            const params = { application: { _id: 'app1' } };
            // Mock getApplicationById to return an application with applicantID 'other'
            jest.spyOn(app, 'getApplicationById').mockResolvedValue({ _id: 'app1', applicant: { applicantID: 'other' }, status: NEW });
            await expect(app.saveApplication(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });
    });

    describe('getMyLastApplication', () => {
        it('returns last approved application', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false); // Ensure user has scope
            userScopeMock.isAllScope.mockReturnValue(true);   // Ensure user has all scope
            app.applicationDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED }),
            };
            jest.spyOn(app, 'getApplicationById').mockResolvedValue({
                _id: 'app1',
                status: APPROVED,
                institution: { id: 'inst1', _id: 'inst1' },
            });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const result = await app.getMyLastApplication({}, context);
            expect(app.applicationDAO.findLatestApprovedByApplicantID).toHaveBeenCalledWith('user1');
            expect(app.getApplicationById).toHaveBeenCalledWith('app1');
            expect(result).toMatchObject({ _id: 'app1', version: '3.0', institution: { id: 'inst1', _id: 'inst1' } });
        });

        it('hydrates conditional and pendingConditions when approved study has pending image de-identification', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            UserScope.create.mockReturnValue(userScopeMock);
            app.applicationDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED }),
            };
            jest.spyOn(app, 'getApplicationById').mockResolvedValue({
                _id: 'app1',
                status: APPROVED,
                studyName: 'study1',
                institution: { id: 'inst1', _id: 'inst1' },
            });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{
                controlledAccess: false,
                pendingModelChange: false,
                pendingImageDeIdentification: true
            }]);

            const result = await app.getMyLastApplication({}, context);

            expect(result).toMatchObject({
                _id: 'app1',
                version: '3.0',
                conditional: true,
                institution: { id: 'inst1', _id: 'inst1' }
            });
            expect(result.pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
        });

        it('returns null when no previous approved application exists', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            
            app.applicationDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue(null),
            };

            const result = await app.getMyLastApplication({}, context);
            expect(result).toBeNull();
        });

        it('returns the most recent approved application even when it has a successor revision', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            app.applicationDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({
                    _id: 'seq1',
                    status: APPROVED,
                    nextRevisionId: 'seq2',
                    createdAt: new Date('2024-02-01'),
                }),
            };
            jest.spyOn(app, 'getApplicationById').mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                studyName: 'Study',
                nextRevisionId: 'seq2',
            });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const result = await app.getMyLastApplication({}, context);

            expect(result).toMatchObject({ _id: 'seq1', version: '3.0' });
        });
    });

    describe('listApplications', () => {
        beforeEach(() => {
            userScopeMock.isAllScope = jest.fn(() => true);
            userScopeMock.isOwnScope = jest.fn(() => false);
            userScopeMock.isStudyScope = jest.fn(() => false);
            userScopeMock.isDCScope = jest.fn(() => false);
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['all']);
            UserScope.create.mockReturnValue(userScopeMock);
        });

        it('throws LIST_APPLICATIONS_INVALID_PARAMS for invalid orderBy', async () => {
            await expect(app.listApplications({ orderBy: 'InvalidColumn' }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        });

        it('accepts each valid orderBy and resolves successfully', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            for (const orderBy of VALID_ORDER_BY_LIST_APPLICATIONS) {
                await expect(app.listApplications({ orderBy }, context)).resolves.toBeDefined();
            }
        });

        it('accepts valid orderBy case-insensitively', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await expect(app.listApplications({ orderBy: 'CREATEDAT' }, context)).resolves.toBeDefined();
            await expect(app.listApplications({ orderBy: 'StudyName' }, context)).resolves.toBeDefined();
        });

        it('passes applicant.fullName as orderBy when orderBy is applicant.applicantName', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({ orderBy: 'applicant.applicantName' }, context);
            const findManyOptions = findManyMock.mock.calls[0][1];
            expect(findManyOptions.orderBy).toEqual({ applicant: { fullName: 'desc' } });
        });

        it('passes requested orderBy through for other valid values', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({ orderBy: 'createdAt', sortDirection: 'ASC' }, context);
            const findManyOptions = findManyMock.mock.calls[0][1];
            expect(findManyOptions.orderBy).toEqual({ createdAt: 'asc' });
        });

        it('throws LIST_APPLICATIONS_INVALID_PARAMS for invalid sortDirection', async () => {
            await expect(app.listApplications({ sortDirection: 'INVALID' }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        });

        it('returns applications and aggregations when findMany is mocked', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            const result = await app.listApplications({}, context);
            expect(result).toHaveProperty('applications');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('programs');
            expect(result).toHaveProperty('studies');
            expect(result).toHaveProperty('studyAbbreviations');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('submitterNames');
            expect(Array.isArray(result.applications)).toBe(true);
            expect(result.total).toBe(0);
            expect(findManyMock).toHaveBeenCalled();
        });

        it('fills studyAbbreviation with studyName in the list response when abbrev is empty', async () => {
            const row = {
                id: 'a1',
                studyName: 'My Full Study',
                studyAbbreviation: '   ',
                status: NEW,
                applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' }
            };
            let n = 0;
            const findManyMock = jest.fn().mockImplementation(() => {
                n += 1;
                if (n === 1) {
                    return Promise.resolve([row]);
                }
                return Promise.resolve([]);
            });
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(1);
            const result = await app.listApplications({}, context);
            expect(result.applications[0].studyAbbreviation).toBe('My Full Study');
            expect(result.applications[0].studyName).toBe('My Full Study');
        });

        it('sets canBeReopened on list rows based on Approved status and revision chain', async () => {
            const rows = [
                { id: 'a1', status: APPROVED, nextRevisionId: null, studyName: 'S1', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'a2', status: APPROVED, nextRevisionId: 'successor-active', studyName: 'S2', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'a3', status: APPROVED, nextRevisionId: 'successor-canceled', studyName: 'S4', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'a4', status: IN_PROGRESS, studyName: 'S3', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
            ];
            let n = 0;
            const findManyMock = jest.fn().mockImplementation(() => {
                n += 1;
                if (n === 1) {
                    return Promise.resolve(rows);
                }
                return Promise.resolve([]);
            });
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(4);
            app.applicationDAO.findApplicationStatusesByIds = jest.fn().mockResolvedValue([
                { id: 'successor-active', status: REOPENED },
                { id: 'successor-canceled', status: CANCELED },
            ]);
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);

            const result = await app.listApplications({}, context);

            expect(app.applicationDAO.findApplicationStatusesByIds).toHaveBeenCalledTimes(1);
            expect(app.applicationDAO.findApplicationStatusesByIds).toHaveBeenCalledWith([
                'successor-active',
                'successor-canceled',
            ]);
            expect(result.applications).toHaveLength(4);
            expect(result.applications[0].canBeReopened).toBe(true);
            expect(result.applications[1].canBeReopened).toBe(false);
            expect(result.applications[2].canBeReopened).toBe(true);
            expect(result.applications[3].canBeReopened).toBe(false);
            expect(result.applications.every((row) => row.canBeRestored === false)).toBe(true);
        });

        it('sets canBeRestored on list rows for Canceled and Deleted applications', async () => {
            const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
            const validDeletedHistory = [{ status: IN_PROGRESS }, { status: DELETED }];
            const rows = [
                { id: 'c1', status: CANCELED, sequenceNumber: 1, history: validCanceledHistory, studyName: 'S1', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'c2', status: CANCELED, sequenceNumber: 2, history: validCanceledHistory, studyName: 'S2', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'd1', status: DELETED, sequenceNumber: 2, history: validDeletedHistory, studyName: 'S3', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'd2', status: DELETED, sequenceNumber: 3, history: validDeletedHistory, studyName: 'S4', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
            ];
            let n = 0;
            app.applicationDAO.findMany = jest.fn().mockImplementation(() => {
                n += 1;
                return Promise.resolve(n === 1 ? rows : []);
            });
            app.applicationDAO.count = jest.fn().mockResolvedValue(4);
            app.applicationDAO.findApplicationStatusesByIds = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds = jest.fn().mockResolvedValue([
                { nextRevisionId: 'c2' },
                { nextRevisionId: 'd2' },
            ]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);

            const result = await app.listApplications({}, context);

            expect(app.applicationDAO.findApprovedApplicationsByNextRevisionIds).toHaveBeenCalledTimes(1);
            expect(app.applicationDAO.findApprovedApplicationsByNextRevisionIds).toHaveBeenCalledWith([
                'c2',
                'd1',
                'd2',
            ]);
            expect(result.applications[0].canBeRestored).toBe(true);
            expect(result.applications[1].canBeRestored).toBe(true);
            expect(result.applications[2].canBeRestored).toBe(false);
            expect(result.applications[3].canBeRestored).toBe(true);
        });

        it('hydrates conditional and pendingConditions for approved rows via one study batch lookup', async () => {
            const rows = [
                { id: 'a1', status: APPROVED, studyName: 'Alpha Study', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'a2', status: APPROVED, studyName: 'Beta Study', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
            ];
            let n = 0;
            app.applicationDAO.findMany = jest.fn().mockImplementation(() => {
                n += 1;
                return Promise.resolve(n === 1 ? rows : []);
            });
            app.applicationDAO.count = jest.fn().mockResolvedValue(2);
            app.applicationDAO.findApplicationStatusesByIds = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([
                { _id: 'study-1', studyName: 'Alpha Study', pendingImageDeIdentification: true },
                { _id: 'study-2', studyName: 'Beta Study', controlledAccess: true, dbGaPID: null },
            ]);

            const result = await app.listApplications({}, context);

            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledTimes(1);
            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledWith(['Alpha Study', 'Beta Study']);
            expect(result.applications[0].conditional).toBe(true);
            expect(result.applications[0].pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
            expect(result.applications[1].conditional).toBe(true);
            expect(result.applications[1].pendingConditions).toContain(ERROR.CONTROLLED_STUDY_NO_DBGAPID);
        });

        it('skips batch revision lookups when the page is empty', async () => {
            app.applicationDAO.findMany = jest.fn().mockResolvedValue([]);
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            app.applicationDAO.findApplicationStatusesByIds = jest.fn();
            app.applicationDAO.findApprovedApplicationsByNextRevisionIds = jest.fn();
            mockApprovedStudiesService.findByStudyNames = jest.fn();

            await app.listApplications({}, context);

            expect(app.applicationDAO.findApplicationStatusesByIds).not.toHaveBeenCalled();
            expect(app.applicationDAO.findApprovedApplicationsByNextRevisionIds).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyNames).not.toHaveBeenCalled();
        });

        it('returns empty list when scope is study (only all and own supported for filters)', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'study', scopeValues: ['study1'] }]);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(false);
            const result = await app.listApplications({}, context);
            expect(result.applications).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.programs).toEqual([]);
            expect(result.studies).toEqual([]);
            expect(result.studyAbbreviations).toEqual([]);
            expect(result.status).toEqual([]);
            expect(result.submitterNames).toEqual([]);
        });

        it('returns empty list when scope is DC (only all and own supported for filters)', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'dc', scopeValues: ['dc1'] }]);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(false);
            const result = await app.listApplications({}, context);
            expect(result.applications).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.programs).toEqual([]);
            expect(result.studies).toEqual([]);
            expect(result.studyAbbreviations).toEqual([]);
            expect(result.status).toEqual([]);
            expect(result.submitterNames).toEqual([]);
        });

        it('throws LIST_APPLICATIONS_INVALID_PARAMS when params.statuses is not an array', async () => {
            await expect(app.listApplications({ statuses: 'APPROVED' }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            await expect(app.listApplications({ statuses: {} }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        });

        it('throws APPLICATION_INVALID_STATUSES for invalid status in params.statuses', async () => {
            await expect(app.listApplications({ statuses: ['InvalidStatus'] }, context))
                .rejects.toThrow(/Requested statuses.*InvalidStatus.*are not valid/);
        });

        it('accepts valid statuses case-insensitively and returns successfully', async () => {
            app.applicationDAO.findMany = jest.fn().mockResolvedValue([]);
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await expect(app.listApplications({ statuses: ['new', 'Approved'] }, context)).resolves.toBeDefined();
            const result = await app.listApplications({ statuses: ['new', 'Approved'] }, context);
            expect(result.applications).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('passes filter without status to DAO when statuses is empty array', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({ statuses: [] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.applicationDAO.count.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('passes filter without status to DAO when statuses contains All', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({ statuses: ['All'] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.applicationDAO.count.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('passes filter without status to DAO when statuses contains All with other statuses', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({ statuses: ['All', 'Approved'] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.applicationDAO.count.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('throws LIST_APPLICATIONS_INVALID_PARAMS for invalid first', async () => {
            await expect(app.listApplications({ first: 0 }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            await expect(app.listApplications({ first: 1.5 }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        });

        it('throws LIST_APPLICATIONS_INVALID_PARAMS for invalid offset', async () => {
            await expect(app.listApplications({ offset: -1 }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            await expect(app.listApplications({ offset: 1.5 }, context))
                .rejects.toThrow(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        });

        it('passes applicantID in filter when scope is own', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['own']);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            const ctx = { ...context, userInfo: { ...context.userInfo, _id: 'user-123' } };
            const findManyMock = jest.fn().mockResolvedValue([]);
            app.applicationDAO.findMany = findManyMock;
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await app.listApplications({}, ctx);
            const findManyCalls = findManyMock.mock.calls;
            expect(findManyCalls.length).toBeGreaterThan(0);
            const firstCallFilter = findManyCalls[0][0];
            expect(firstCallFilter).toEqual(expect.objectContaining({ applicantID: 'user-123' }));
            const countCalls = app.applicationDAO.count.mock.calls;
            expect(countCalls.length).toBe(1);
            expect(countCalls[0][0]).toEqual(expect.objectContaining({ applicantID: 'user-123' }));
        });

        it('returns empty list when scope is none or empty', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([]);
            UserScope.create.mockReturnValue({ isAllScope: () => false, isOwnScope: () => false });
            const result = await app.listApplications({}, context);
            expect(result.applications).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.programs).toEqual([]);
            expect(result.studies).toEqual([]);
            expect(result.studyAbbreviations).toEqual([]);
            expect(result.status).toEqual([]);
            expect(result.submitterNames).toEqual([]);
        });

        it('returns status as array not function', async () => {
            app.applicationDAO.findMany = jest.fn().mockResolvedValue([]);
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            const result = await app.listApplications({}, context);
            expect(Array.isArray(result.status)).toBe(true);
            expect(result.status).toEqual([]);
        });

        it('rejects with LIST_APPLICATIONS_FETCH_FAILED and application list step when findMany fails for list', async () => {
            app.applicationDAO.findMany = jest.fn().mockRejectedValue(new Error('DB error'));
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await expect(app.listApplications({}, context)).rejects.toThrow(ERROR.LIST_APPLICATIONS_FETCH_FAILED);
            await expect(app.listApplications({}, context)).rejects.toThrow(/fetching application list/);
        });

        it('rejects with LIST_APPLICATIONS_FETCH_FAILED and application count step when count fails', async () => {
            app.applicationDAO.findMany = jest.fn().mockResolvedValue([]);
            app.applicationDAO.count = jest.fn().mockRejectedValue(new Error('Count failed'));
            await expect(app.listApplications({}, context)).rejects.toThrow(ERROR.LIST_APPLICATIONS_FETCH_FAILED);
            await expect(app.listApplications({}, context)).rejects.toThrow(/fetching application count/);
        });

        it('rejects with LIST_APPLICATIONS_FETCH_FAILED when a filter-option query fails', async () => {
            let findManyCallCount = 0;
            app.applicationDAO.findMany = jest.fn().mockImplementation(() => {
                findManyCallCount++;
                if (findManyCallCount === 1) return Promise.resolve([]);
                if (findManyCallCount === 2) return Promise.resolve([]);
                return Promise.reject(new Error('Filter query failed'));
            });
            app.applicationDAO.count = jest.fn().mockResolvedValue(0);
            await expect(app.listApplications({}, context)).rejects.toThrow(ERROR.LIST_APPLICATIONS_FETCH_FAILED);
        });

        describe('studyName filter (searches both studyName and studyAbbreviation)', () => {
            it('passes OR condition when studyName is provided', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(0);
                await app.listApplications({ studyName: 'UniqueName' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.OR).toBeDefined();
                expect(Array.isArray(filter.OR)).toBe(true);
                expect(filter.OR).toHaveLength(2);
                expect(filter.OR[0]).toEqual({ studyName: { contains: 'UniqueName', mode: 'insensitive' } });
                expect(filter.OR[1]).toEqual({ studyAbbreviation: { contains: 'UniqueName', mode: 'insensitive' } });
            });

            it('returns applications matching study name when studyName filter is used', async () => {
                const matchingApp = { id: 'app1', studyName: 'Cancer Study', studyAbbreviation: 'CS', status: NEW, applicant: { fullName: 'Alice' } };
                const findManyMock = jest.fn().mockResolvedValue([matchingApp]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(1);
                const result = await app.listApplications({ studyName: 'Cancer' }, context);
                expect(result.applications.length).toBe(1);
                expect(result.applications[0].studyName).toBe('Cancer Study');
                expect(result.total).toBe(1);
            });

            it('returns applications matching study abbreviation when studyName filter is used', async () => {
                const matchingApp = { id: 'app2', studyName: 'Other Study', studyAbbreviation: 'BRF', status: NEW, applicant: { fullName: 'Bob' } };
                const findManyMock = jest.fn().mockResolvedValue([matchingApp]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(1);
                const result = await app.listApplications({ studyName: 'BRF' }, context);
                expect(result.applications.length).toBe(1);
                expect(result.applications[0].studyAbbreviation).toBe('BRF');
                expect(result.total).toBe(1);
            });

            it('studyName filter is case-insensitive', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(0);
                await app.listApplications({ studyName: 'aBc' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.OR[0].studyName).toEqual({ contains: 'aBc', mode: 'insensitive' });
                expect(filter.OR[1].studyAbbreviation).toEqual({ contains: 'aBc', mode: 'insensitive' });
            });

            it('does not add study filter when studyName is All', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(0);
                await app.listApplications({ studyName: 'All' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.OR).toBeUndefined();
            });

            it('does not add study filter when studyName is empty string', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.applicationDAO.findMany = findManyMock;
                app.applicationDAO.count = jest.fn().mockResolvedValue(0);
                await app.listApplications({ studyName: '' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.OR).toBeUndefined();
            });

            it('returns distinct studies and studyAbbreviations when studyName filter is applied', async () => {
                const apps = [
                    { id: 'app1', studyName: 'Study One', studyAbbreviation: 'S1', status: NEW, applicant: { fullName: 'A' } },
                    { id: 'app2', studyName: 'Study One', studyAbbreviation: 'S2', status: NEW, applicant: { fullName: 'B' } }
                ];
                const studyDistinctRows = [
                    { studyName: 'Study One', studyAbbreviation: 'S1' },
                    { studyName: 'Study One', studyAbbreviation: 'S2' }
                ];
                let callIndex = 0;
                app.applicationDAO.findMany = jest.fn().mockImplementation((filter, options) => {
                    callIndex++;
                    if (callIndex === 1) return Promise.resolve(apps);
                    if (callIndex === 2) {
                        expect(filter.OR).toBeDefined();
                        expect(options?.select?.studyName).toBe(true);
                        expect(options?.select?.studyAbbreviation).toBe(true);
                        return Promise.resolve(studyDistinctRows);
                    }
                    return Promise.resolve([]);
                });
                app.applicationDAO.count = jest.fn().mockResolvedValue(2);
                const result = await app.listApplications({ studyName: 'Study' }, context);
                expect(result.studies).toEqual(['Study One']);
                expect(result.studyAbbreviations).toEqual(expect.arrayContaining(['S1', 'S2']));
                expect(result.studyAbbreviations).toHaveLength(2);
            });
        });
    });

    describe('_getUserScope', () => {

        it('throws if invalid', async () => {
            UserScope.create.mockReturnValue({ isNoneScope: () => false, isAllScope: () => false, isOwnScope: () => false });
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['invalid']);
            await expect(app._getUserScope(context.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW))
                .rejects.toThrow(/permission/i);
        });
    });

    describe('approveApplication', () => {
        beforeEach(() => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue(null);
            mockApprovedStudiesService.findByApplicationID.mockResolvedValue(null);
            mockApprovedStudiesService.saveApprovedStudyFromApplication.mockResolvedValue({ _id: 'study1' });
        });

        it('throws error if duplicate approved study', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({ _id: 'app1', status: IN_REVIEW, studyName: 'study1' });
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'study1' }]);
            // Patch: Accept any error message containing "duplicate" (case-insensitive)
            await expect(app.approveApplication({ _id: 'app1', comment: 'Approved' }, context))
                .rejects.toThrow(/duplicate/i);
        });

        it('throws error if duplicate study exists without revision chain link', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
            });
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([
                { _id: 'study1', applicationID: 'unrelated-source' },
            ]);

            await expect(app.approveApplication({ _id: 'revision-app', comment: 'Approved' }, context))
                .rejects.toThrow(/duplicate/i);
        });

        it('skips approved study create/update on revision re-approval', async () => {
            const mockApplication = {
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const existingStudy = { _id: 'existing-study', applicationID: 'source-app', createdAt: '2020-01-01' };
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findByApplicationID.mockResolvedValue(existingStudy);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'existing-study' }]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();

            await app.approveApplication({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).not.toHaveBeenCalled();
            expect(app._findUsersByApplicantIDs).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyName).toHaveBeenCalled();
        });

        it('allows revision re-approval when predecessor is linked and study name already exists', async () => {
            const mockApplication = {
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const existingStudy = { _id: 'other-study', applicationID: 'unrelated-source' };
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findByApplicationID.mockResolvedValue(null);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([existingStudy]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            mockLogCollection.insert.mockResolvedValue();

            await app.approveApplication({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).not.toHaveBeenCalled();
        });

        it('allows revision re-approval when program name already exists from initial approval', async () => {
            const mockApplication = {
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Existing Program',
                sequenceNumber: 2,
                questionnaireData: JSON.stringify({ program: { _id: null }, accessTypes: ['Open Access'] }),
            };
            const existingStudy = { _id: 'existing-study', applicationID: 'source-app', createdAt: '2020-01-01' };
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findByApplicationID.mockResolvedValue(existingStudy);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'existing-study' }]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(null);
            mockOrganizationService.findOneByProgramName.mockResolvedValue({ _id: 'program1', name: 'Existing Program' });
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            mockLogCollection.insert.mockResolvedValue();

            await app.approveApplication({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).not.toHaveBeenCalled();
            expect(mockOrganizationService.upsertByProgramName).not.toHaveBeenCalled();
        });

        it('throws UPDATE_FAILED when DAO update returns falsy and does not call addNewInstitutions', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('1.0');
            app.applicationDAO.update = jest.fn().mockResolvedValue(null);

            await expect(app.approveApplication({ _id: 'app1', comment: 'Approved' }, context))
                .rejects.toThrow(ERROR.UPDATE_FAILED);

            expect(mockInstitutionService.addNewInstitutions).not.toHaveBeenCalled();
        });

        it('logs UpdateApplicationStateEvent with pre-approve status on success', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue({ program: { _id: 'program1' } });
            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(UpdateApplicationStateEvent.create).toHaveBeenCalledWith(
                'user1', 'john@doe.com', undefined, 'app1', IN_REVIEW, APPROVED
            );
            expect(mockLogCollection.insert).toHaveBeenCalled();
        });

        it('should create program before creating study when no existing program', async () => {
            const mockApplication = { 
                _id: 'app1', 
                status: IN_REVIEW, 
                studyName: 'study1',
                programName: 'Program One',
                programAbbreviation: 'PO',
                programDescription: 'Program Description',
                questionnaireData: JSON.stringify({ program: { _id: null } })
            };
            const mockQuestionnaire = { program: { _id: null } };
            const mockNewProgram = { _id: 'new-program-1', name: 'Program One' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(null);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            mockOrganizationService.upsertByProgramName.mockResolvedValue(mockNewProgram);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockOrganizationService.upsertByProgramName).toHaveBeenCalledWith(
                'Program One', 'PO', 'Program Description'
            );
            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'app1',
                    studyName: 'study1',
                    status: APPROVED,
                    reviewComment: 'Approved',
                }),
                mockQuestionnaire,
                undefined,
                undefined,
                undefined,
                mockNewProgram,
                null
            );
        });

        it('sends approveQuestionNotification when there are no pending approval conditions and submitter opted into review emails', async () => {
            const reviewNotification = USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW;
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                studyAbbreviation: 'S1',
                applicantID: 'user-applicant-1',
                applicant: {
                    applicantID: 'user-applicant-1',
                    applicantEmail: 'submitter@test.com',
                    applicantName: 'Submitter Name'
                },
                programName: 'Program One',
                programAbbreviation: 'PO',
                programDescription: 'Program Description',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' }, accessTypes: [], study: {} };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: []
            };
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.userCollection.find.mockResolvedValueOnce([{
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            }]);

            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockNotificationsService.approveQuestionNotification).toHaveBeenCalled();
            expect(mockNotificationsService.multipleChangesApproveQuestionNotification).not.toHaveBeenCalled();
            expect(mockNotificationsService.pendingImageDeIdentificationApproveQuestionNotification).not.toHaveBeenCalled();
        });

        it('sends pendingImageDeIdentificationApproveQuestionNotification when only pending image de-identification', async () => {
            const reviewNotification = USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW;
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                studyAbbreviation: 'S1',
                applicantID: 'user-applicant-1',
                applicant: {
                    applicantID: 'user-applicant-1',
                    applicantEmail: 'submitter@test.com',
                    applicantName: 'Submitter Name'
                },
                programName: 'Program One',
                programAbbreviation: 'PO',
                programDescription: 'Program Description',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' }, accessTypes: [], study: {} };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Looks good',
                history: []
            };
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.userCollection.find.mockResolvedValueOnce([{
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            }]);

            await app.approveApplication({
                _id: 'app1',
                comment: 'Looks good',
                pendingImageDeIdentification: true
            }, context);

            expect(mockNotificationsService.approveQuestionNotification).not.toHaveBeenCalled();
            expect(mockNotificationsService.pendingImageDeIdentificationApproveQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    firstName: 'Submitter Name',
                    reviewComments: 'Looks good',
                    study: 'study1',
                    contactEmail: mockEmailParams.conditionalSubmissionContact,
                    submissionGuideURL: mockEmailParams.submissionGuideURL
                })
            );
        });

        it('sends multipleChangesApproveQuestionNotification when image de-identification and model change pendings', async () => {
            const reviewNotification = USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW;
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                applicantID: 'user-applicant-1',
                applicant: {
                    applicantID: 'user-applicant-1',
                    applicantEmail: 'submitter@test.com',
                    applicantName: 'Submitter Name'
                },
                programName: 'Program One',
                programAbbreviation: 'PO',
                programDescription: 'Program Description',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' }, accessTypes: [], study: {} };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved with conditions',
                history: []
            };
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.userCollection.find.mockResolvedValueOnce([{
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            }]);

            await app.approveApplication({
                _id: 'app1',
                comment: 'Approved with conditions',
                pendingModelChange: true,
                pendingImageDeIdentification: true
            }, context);

            expect(mockNotificationsService.approveQuestionNotification).not.toHaveBeenCalled();
            expect(mockNotificationsService.pendingImageDeIdentificationApproveQuestionNotification).not.toHaveBeenCalled();
            expect(mockNotificationsService.multipleChangesApproveQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    firstName: 'Submitter Name',
                    reviewComments: 'Approved with conditions',
                    study: 'study1'
                }),
                false,
                true,
                false,
                true
            );
        });

        it('should pass pendingImageDeIdentification to saveApprovedStudyFromApplication when provided', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Program One',
                programAbbreviation: 'PO',
                programDescription: 'Program Description',
                questionnaireData: JSON.stringify({ program: { _id: null } })
            };
            const mockQuestionnaire = { program: { _id: null } };
            const mockNewProgram = { _id: 'new-program-1', name: 'Program One' };

            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(null);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            mockOrganizationService.upsertByProgramName.mockResolvedValue(mockNewProgram);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveApplication({
                _id: 'app1',
                comment: 'Approved',
                pendingImageDeIdentification: true
            }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'app1',
                    studyName: 'study1',
                    status: APPROVED,
                    reviewComment: 'Approved',
                }),
                mockQuestionnaire,
                undefined,
                true,
                undefined,
                mockNewProgram,
                null
            );
        });

        it('returns conditional and pendingConditions on the approved application when the study has pending image de-identification', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Existing Program',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };
            const mockExistingProgram = { _id: 'program1', name: 'Existing Program' };
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: []
            };

            mockApprovedStudiesService.findByStudyName
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{
                    controlledAccess: false,
                    pendingModelChange: false,
                    pendingImageDeIdentification: true
                }]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            const result = await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(result.status).toBe(APPROVED);
            expect(result.conditional).toBe(true);
            expect(result.pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
        });

        it('should use existing program when program exists', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Existing Program',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };
            const mockExistingProgram = { _id: 'program1', name: 'Existing Program' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockOrganizationService.upsertByProgramName).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'app1',
                    studyName: 'study1',
                    status: APPROVED,
                    reviewComment: 'Approved',
                }),
                mockQuestionnaire,
                undefined,
                undefined,
                undefined,
                mockExistingProgram,
                null
            );
        });

        it('should throw error for duplicate program when no existing program', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Duplicate Program',
                questionnaireData: JSON.stringify({ program: { _id: null } })
            };
            const mockQuestionnaire = { program: { _id: null } };
            const mockDuplicateProgram = { _id: 'duplicate1', name: 'Duplicate Program' };

            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(null);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(mockDuplicateProgram);
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await expect(app.approveApplication({ _id: 'app1', comment: 'Approved' }, context))
                .rejects.toThrow(/duplicate/i);
        });

        it('should not throw error for duplicate program when existing program exists', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Existing Program',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };
            const mockExistingProgram = { _id: 'program1', name: 'Existing Program' };
            const mockDuplicateProgram = { _id: 'duplicate1', name: 'Existing Program' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue(mockExistingProgram);
            mockOrganizationService.findOneByProgramName.mockResolvedValue(mockDuplicateProgram);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromApplication).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'app1',
                    studyName: 'study1',
                    status: APPROVED,
                    reviewComment: 'Approved',
                }),
                mockQuestionnaire,
                undefined,
                undefined,
                undefined,
                mockExistingProgram,
                null
            );
        });

        it('should throw and not update user studies when approved study creation returns no id', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.saveApprovedStudyFromApplication.mockResolvedValue(null);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([{
                _id: 'user1',
                userStatus: 'active',
                role: 'user',
                studies: [{ _id: 'existing-study' }],
            }]);
            mockLogCollection.insert.mockResolvedValue();
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await expect(app.approveApplication({ _id: 'app1', comment: 'Approved' }, context))
                .rejects.toThrow(ERROR.FAILED_APPROVED_STUDY_INSERTION);

            expect(mockUserService.updateUserInfo).not.toHaveBeenCalled();
        });

        it('should prepend approved study id to applicant studies on approval', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: [],
            };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockOrganizationService.getOrganizationByID.mockResolvedValue({ _id: 'program1' });
            mockOrganizationService.findOneByProgramName.mockResolvedValue(null);
            app.applicationDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            mockApprovedStudiesService.saveApprovedStudyFromApplication.mockResolvedValue({ _id: 'new-study-id' });
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([{
                _id: 'user1',
                userStatus: 'active',
                role: 'user',
                studies: [{ _id: 'existing-study' }],
            }]);
            mockUserService.updateUserInfo.mockResolvedValue();
            mockLogCollection.insert.mockResolvedValue();
            mockInstitutionService.addNewInstitutions.mockResolvedValue();
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.userCollection.find.mockResolvedValue([]);
            global.getApplicationQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveApplication({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockUserService.updateUserInfo).toHaveBeenCalledWith(
                expect.objectContaining({ _id: 'user1' }),
                expect.anything(),
                'user1',
                'active',
                'user',
                ['new-study-id', 'existing-study']
            );
        });
    });

    describe('inquireApplication', () => {
        const reviewNotification = USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW;

        function makeApplication(overrides = {}) {
            return {
                _id: 'app1',
                status: IN_REVIEW,
                version: '1.0',
                studyName: 'Default Study',
                studyAbbreviation: 'DS',
                questionnaireData: '{}',
                applicant: {
                    applicantID: 'user-applicant-1',
                    applicantEmail: 'submitter@test.com',
                    applicantName: 'Submitter Name'
                },
                history: [],
                ...overrides
            };
        }

        beforeEach(() => {
            app.verifyReviewerPermission = jest.fn().mockResolvedValue();
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('1.0');
            app.applicationDAO.update = jest.fn().mockResolvedValue({ acknowledged: true });
            mockUserService.getUsersByNotifications = jest.fn().mockResolvedValue([]);
            mockUserService.userCollection.find = jest.fn().mockResolvedValue([{
                _id: 'user-applicant-1',
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            }]);
            mockNotificationsService.inquireQuestionNotification = jest.fn().mockResolvedValue();
        });

        it('passes studyName and studyAbbreviation as NA when whitespace-only, null, or empty', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(makeApplication({
                studyName: '   ',
                studyAbbreviation: null
            }));
            await app.inquireApplication({ _id: 'app1', comment: 'Please clarify' }, context);
            expect(mockNotificationsService.inquireQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    firstName: 'Submitter Name',
                    reviewComments: 'Please clarify',
                    studyName: 'NA',
                    studyAbbreviation: 'NA'
                }),
                {}
            );
        });

        it('trims non-empty studyName and studyAbbreviation for the inquire email', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(makeApplication({
                studyName: '  My Full Study  ',
                studyAbbreviation: '  ABBR  '
            }));
            await app.inquireApplication({ _id: 'app1', comment: 'Need details' }, context);
            expect(mockNotificationsService.inquireQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    firstName: 'Submitter Name',
                    reviewComments: 'Need details',
                    studyName: 'My Full Study',
                    studyAbbreviation: 'ABBR'
                }),
                {}
            );
        });

        it('uses NA for study fields when the application object omits them', async () => {
            const withoutStudy = makeApplication();
            delete withoutStudy.studyName;
            delete withoutStudy.studyAbbreviation;
            app.getApplicationById = jest.fn().mockResolvedValue(withoutStudy);
            await app.inquireApplication({ _id: 'app1', comment: 'R' }, context);
            expect(mockNotificationsService.inquireQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({ studyName: 'NA', studyAbbreviation: 'NA' }),
                {}
            );
        });
    });

    describe('submitApplication', () => {
        it('returns reloaded application after update', async () => {
            const inProgressApp = {
                _id: 'app1',
                status: IN_PROGRESS,
                history: [],
                applicant: { applicantID: 'user1' },
            };
            const submittedApp = {
                _id: 'app1',
                status: SUBMITTED,
                history: [{ status: SUBMITTED, userID: 'user1' }],
                submittedDate: 1234567890,
                canBeReopened: false,
                applicant: { applicantID: 'user1', applicantName: 'John Doe', applicantEmail: 'john@doe.com' },
            };
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(inProgressApp)
                .mockResolvedValueOnce(submittedApp);
            app.applicationDAO = { update: jest.fn().mockResolvedValue(true) };
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.submitApplication({ _id: 'app1' }, context);

            expect(app.getApplicationById).toHaveBeenCalledTimes(2);
            expect(app.getApplicationById).toHaveBeenLastCalledWith('app1');
            expect(result).toBe(submittedApp);
            expect(result.status).toBe(SUBMITTED);
            expect(result.canBeReopened).toBe(false);
        });
    });

    describe('resumeInquiredApplication', () => {
        it('transitions owner application to In Progress', async () => {
            const application = {
                _id: 'app1',
                status: INQUIRED,
                version: '2.0',
                history: [{ status: INQUIRED, reviewComment: 'fix this' }],
                applicant: { applicantID: 'user1' }
            };
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce(application)
                .mockResolvedValueOnce({ ...application, status: IN_PROGRESS });
            app.applicationDAO = { update: jest.fn().mockResolvedValue(true) };
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.resumeInquiredApplication({ _id: 'app1' }, context);

            expect(result.status).toBe(IN_PROGRESS);
            expect(app.applicationDAO.update).toHaveBeenCalledWith(expect.objectContaining({
                _id: 'app1',
                status: IN_PROGRESS
            }));
        });

        it('rejects non-owner', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: INQUIRED,
                applicant: { applicantID: 'other-user' }
            });

            await expect(app.resumeInquiredApplication({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });
    });

    describe('reopenApplication', () => {
        it('delegates to resumeInquiredApplication', async () => {
            const spy = jest.spyOn(app, 'resumeInquiredApplication').mockResolvedValue({ _id: 'app1', status: IN_PROGRESS });
            await app.reopenApplication({ _id: 'app1' }, context);
            expect(spy).toHaveBeenCalledWith({ _id: 'app1' }, context);
        });
    });

    describe('reopenApprovedSubmissionRequest', () => {
        const createPermission = USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE;
        const approvedSource = {
            _id: 'approved-1',
            status: APPROVED,
            sequenceNumber: 1,
            nextRevisionId: null,
            questionnaireData: '{}',
            programName: 'Prog',
            studyName: 'Study',
            studyAbbreviation: 'ST',
            applicant: { applicantID: 'user1' },
            history: []
        };

        beforeEach(() => {
            UserScope.create.mockReturnValue(userScopeMock);
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['all']);
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            userScopeMock.isOwnScope.mockReturnValue(false);
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            app.userDAO = {
                findByIdAndStatus: jest.fn().mockResolvedValue({
                    _id: 'user1',
                    id: 'user1',
                    role: USER_CONSTANTS.USER.ROLES.SUBMITTER,
                    userStatus: USER_CONSTANTS.USER.STATUSES.ACTIVE,
                    permissions: [createPermission],
                }),
            };
            app.applicationDAO = {
                findApplicationStatusById: jest.fn(),
                reopenApprovedRevision: jest.fn().mockImplementation((_sourceId, doc) =>
                    Promise.resolve({ ...doc, version: '3.0' })
                ),
            };
            mockLogCollection.insert.mockResolvedValue();
        });

        afterEach(() => {
            console.warn.mockRestore();
        });

        it('clones approved SRF via reopenApprovedRevision and logs audit events', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            const reopenedDoc = {
                _id: 'new-revision-id',
                status: REOPENED,
                sequenceNumber: 2,
                submittedDate: null,
                version: '3.0',
            };
            app.applicationDAO.reopenApprovedRevision.mockResolvedValue(reopenedDoc);

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.applicationDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({
                    status: REOPENED,
                    sequenceNumber: 2,
                    submittedDate: null,
                }),
                false
            );
            expect(CreateApplicationEvent.create).toHaveBeenCalledWith(
                'user1', 'john@doe.com', undefined, expect.any(String)
            );
            expect(UpdateApplicationStateEvent.create).toHaveBeenCalledWith(
                'user1', 'john@doe.com', undefined, expect.any(String), APPROVED, REOPENED
            );
            expect(mockLogCollection.insert).toHaveBeenCalledTimes(2);
            expect(result.status).toBe(REOPENED);
            expect(result.applicant).toEqual({
                applicantID: 'user1',
                applicantName: '',
                applicantEmail: '',
            });
            expect(app.getApplicationById).toHaveBeenCalledTimes(1);
        });

        it('populates applicantName from firstName and lastName when fullName is missing', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'new-owner',
                id: 'new-owner',
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane@example.com',
                role: USER_CONSTANTS.USER.ROLES.USER,
                permissions: [createPermission],
            });

            const result = await app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'new-owner' },
                context
            );

            expect(result.applicant).toEqual({
                applicantID: 'new-owner',
                applicantName: 'Jane Smith',
                applicantEmail: 'jane@example.com',
            });
        });

        it('reassigns owner when ownerId is provided', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'new-owner',
                id: 'new-owner',
                fullName: 'New Owner',
                email: 'owner@example.com',
                role: USER_CONSTANTS.USER.ROLES.USER,
                userStatus: USER_CONSTANTS.USER.STATUSES.ACTIVE,
                permissions: [createPermission],
            });

            const result = await app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'new-owner' },
                context
            );

            expect(app.applicationDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ applicantID: 'new-owner' }),
                false
            );
            expect(result.applicant).toEqual({
                applicantID: 'new-owner',
                applicantName: 'New Owner',
                applicantEmail: 'owner@example.com',
            });
        });

        it('allows original owner with Admin role when create permission is present', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'user1',
                id: 'user1',
                fullName: 'Admin Owner',
                email: 'admin.owner@example.com',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                permissions: [createPermission],
            });

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(result.applicant).toEqual({
                applicantID: 'user1',
                applicantName: 'Admin Owner',
                applicantEmail: 'admin.owner@example.com',
            });
        });

        it('allows explicitly assigning original owner with Admin role when create permission is present', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'user1',
                id: 'user1',
                fullName: 'Admin Owner',
                email: 'admin.owner@example.com',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                permissions: [createPermission],
            });

            const result = await app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'user1' },
                context
            );

            expect(app.applicationDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ applicantID: 'user1' }),
                false
            );
            expect(result.applicant.applicantID).toBe('user1');
        });

        it('rejects original owner without submission_request:create', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'user1',
                id: 'user1',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                permissions: ['submission_request:view'],
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_ORIGINAL_INELIGIBLE);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'user1' },
                ERROR.VERIFY.REOPEN_OWNER_ORIGINAL_INELIGIBLE
            );
        });

        it('rejects explicitly assigning original owner without submission_request:create', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'user1',
                id: 'user1',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                permissions: ['submission_request:view'],
            });

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'user1' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_ORIGINAL_INELIGIBLE);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'user1' },
                ERROR.VERIFY.REOPEN_OWNER_ORIGINAL_INELIGIBLE
            );
        });

        it('rejects non-original Admin with create permission', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'admin-2',
                id: 'admin-2',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                permissions: [createPermission],
            });

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'admin-2' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_ROLE_INELIGIBLE);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'admin-2', role: USER_CONSTANTS.USER.ROLES.ADMIN },
                ERROR.VERIFY.REOPEN_OWNER_ROLE_INELIGIBLE
            );
        });

        it('rejects non-original User without create permission', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'new-owner',
                id: 'new-owner',
                role: USER_CONSTANTS.USER.ROLES.USER,
                permissions: [],
            });

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'new-owner' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_SPECIFIED_INELIGIBLE);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'new-owner' },
                ERROR.VERIFY.REOPEN_OWNER_SPECIFIED_INELIGIBLE
            );
        });

        it('rejects when source has no original owner and ownerId is not provided', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                ...approvedSource,
                applicant: undefined,
                applicantID: undefined,
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { applicationID: 'approved-1' },
                ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED
            );
        });

        it('rejects when original owner is inactive and ownerId is not provided', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue(null);

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'user1' },
                ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED
            );
        });

        it('rejects when specified ownerId is not found or inactive', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue(null);

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'missing-owner' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_NOT_ASSIGNABLE);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { ownerId: 'missing-owner' },
                ERROR.VERIFY.REOPEN_OWNER_NOT_ASSIGNABLE
            );
        });

        it('throws when reopenApprovedRevision reports invalid state', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.applicationDAO = {
                reopenApprovedRevision: jest.fn().mockRejectedValue(
                    new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION)
                ),
            };

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        });

        it('rejects when an active successor exists', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                ...approvedSource,
                nextRevisionId: 'existing-successor',
            });
            app.applicationDAO.findApplicationStatusById = jest.fn().mockResolvedValue({ status: REOPENED });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);

            expect(app.applicationDAO.reopenApprovedRevision).not.toHaveBeenCalled();
        });

        it('allows reopen over a terminal successor and replaces the existing link', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                ...approvedSource,
                nextRevisionId: 'canceled-successor',
            });
            app.applicationDAO.findApplicationStatusById = jest.fn().mockResolvedValue({ status: CANCELED });
            app.applicationDAO.reopenApprovedRevision.mockResolvedValue({
                _id: 'new-revision-id',
                status: REOPENED,
                sequenceNumber: 2,
                version: '3.0',
            });

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.applicationDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ status: REOPENED, sequenceNumber: 2 }),
                true
            );
            expect(result.status).toBe(REOPENED);
        });

        it('rejects when status is not Approved', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                ...approvedSource,
                status: IN_PROGRESS
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        });

        it('rejects without reopen scope', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'none', scopeValues: [] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('allows own-scope source owner to reopen without reassignment', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.applicationDAO = {
                findApplicationStatusById: jest.fn(),
                reopenApprovedRevision: jest.fn().mockImplementation((_sourceId, doc) =>
                    Promise.resolve({ ...doc, version: '3.0' })
                ),
            };
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.applicationDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ applicantID: 'user1', status: REOPENED }),
                false
            );
            expect(result.applicant.applicantID).toBe('user1');
        });

        it('rejects own-scope caller who is not the source owner', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getApplicationById = jest.fn().mockResolvedValue({
                ...approvedSource,
                applicant: { applicantID: 'other-user' },
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('rejects own-scope owner attempting to reassign ownerId', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'new-owner' },
                context
            )).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('rejects all-scope reassignment to ineligible owner role', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'admin-owner',
                id: 'admin-owner',
                role: USER_CONSTANTS.USER.ROLES.ADMIN,
                userStatus: USER_CONSTANTS.USER.STATUSES.ACTIVE,
                permissions: ['submission_request:create:all'],
            });

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'admin-owner' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_ROLE_INELIGIBLE);
        });

        it('rejects all-scope reassignment when target lacks create permission', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue(approvedSource);
            app.userDAO.findByIdAndStatus.mockResolvedValue({
                _id: 'user-no-create',
                id: 'user-no-create',
                role: USER_CONSTANTS.USER.ROLES.USER,
                userStatus: USER_CONSTANTS.USER.STATUSES.ACTIVE,
                permissions: ['submission_request:view:own'],
            });

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'user-no-create' },
                context
            )).rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_SPECIFIED_INELIGIBLE);
        });
    });

    describe('saveApplication from Reopened', () => {
        it('transitions Reopened to In Progress on save', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            jest.spyOn(app, 'getApplicationById').mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                applicant: { applicantID: 'user1' },
                history: []
            });
            jest.spyOn(app, '_updateApplication').mockResolvedValue({ _id: 'app-reopened', status: IN_PROGRESS });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const params = { application: { _id: 'app-reopened', studyName: 'Updated' }, status: IN_PROGRESS };
            await app.saveApplication(params, context);

            expect(app._updateApplication).toHaveBeenCalledWith(
                expect.objectContaining({ status: IN_PROGRESS }),
                REOPENED,
                'user1'
            );
        });
    });

    describe('rejectApplication', () => {
        beforeEach(() => {
            app.verifyReviewerPermission = jest.fn().mockResolvedValue();
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('2.0');
            app.applicationDAO.update = jest.fn().mockResolvedValue(true);
            app.applicationDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce({ _id: 'app1', status: SUBMITTED, history: [], version: '2.0' })
                .mockResolvedValueOnce({ _id: 'app1', status: REJECTED, history: [], version: '2.0' });
        });

        it('does not prune revision chain after rejecting application', async () => {
            await app.rejectApplication({ _id: 'app1', comment: 'rejected' }, context);

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('cancelApplication', () => {
        beforeEach(() => {
            app._sendCancelApplicationEmail = jest.fn().mockResolvedValue();
            app._getApplicationVersionByStatus = jest.fn().mockResolvedValue('3.0');
            app.applicationDAO.update = jest.fn().mockResolvedValue({ _id: 'app-reopened' });
            app.applicationDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });
            app.getApplicationById = jest.fn().mockImplementation(async (id) => ({
                _id: id,
                status: CANCELED,
                studyName: 'Study',
                applicant: { applicantID: 'user1' },
                history: [],
            }));
        });

        it('cancels Reopened SRF as admin', async () => {
            userScopeMock.isAllScope.mockReturnValue(true);
            userScopeMock.isOwnScope.mockReturnValue(false);
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user2' },
                history: [],
            });

            await app.cancelApplication({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.applicationDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: CANCELED })
            );
        });

        it('cancels Reopened SRF as assigned owner', async () => {
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user1' },
                history: [],
            });

            await app.cancelApplication({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.applicationDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: CANCELED })
            );
        });

        it('does not prune revision chain when canceling to Canceled status', async () => {
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user2' },
                history: [],
            });

            await app.cancelApplication({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });

        it('does not prune revision chain after deleting empty application', async () => {
            const callOrder = [];
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce({
                    _id: 'empty-app',
                    status: NEW,
                    applicant: { applicantID: 'user1' },
                    history: [],
                })
                .mockResolvedValueOnce({
                    _id: 'empty-app',
                    status: NEW,
                    applicant: { applicantID: 'user1' },
                    history: [],
                });
            app.applicationDAO.clearNextRevisionIdPointingTo = jest.fn().mockImplementation(async () => {
                callOrder.push('prune');
                return { modifiedCount: 0 };
            });
            app.applicationDAO.delete = jest.fn().mockImplementation(async () => {
                callOrder.push('delete');
                return true;
            });

            await app.cancelApplication({ _id: 'empty-app', comment: 'cancel' }, context);

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
            expect(callOrder).toEqual(['delete']);
        });

        it('does not prune revision chain when empty application delete fails', async () => {
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'empty-app',
                status: NEW,
                applicant: { applicantID: 'user1' },
                history: [],
            });
            app.applicationDAO.delete = jest.fn().mockResolvedValue(null);

            await expect(app.cancelApplication({ _id: 'empty-app', comment: 'cancel' }, context))
                .rejects.toThrow(ERROR.FAILED_DELETE_APPLICATION);

            expect(app.applicationDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('restoreApplication', () => {
        beforeEach(() => {
            app._sendRestoreApplicationEmail = jest.fn().mockResolvedValue();
            userScopeMock.isAllScope.mockReturnValue(true);
            userScopeMock.isOwnScope.mockReturnValue(false);
        });

        it('throws when history is too short', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: CANCELED,
                applicant: { applicantID: 'user1' },
                history: [{ status: CANCELED }],
            });

            await expect(app.restoreApplication({ _id: 'app1', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.INVALID_APPLICATION_RESTORE_STATE);
        });

        it('throws when a newer revision blocks restore', async () => {
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app2',
                status: CANCELED,
                sequenceNumber: 2,
                applicant: { applicantID: 'user1' },
                history: [{ status: REOPENED }, { status: CANCELED }],
            });
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue(null);

            await expect(app.restoreApplication({ _id: 'app2', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.INVALID_APPLICATION_RESTORE_NEWER_REVISION_EXISTS);
        });

        it('throws permission error before revision-chain check for unauthorized caller', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            app.getApplicationById = jest.fn().mockResolvedValue({
                _id: 'app2',
                status: CANCELED,
                sequenceNumber: 2,
                applicant: { applicantID: 'other-user' },
                history: [{ status: REOPENED }, { status: CANCELED }],
            });
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn();

            await expect(app.restoreApplication({ _id: 'app2', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });

        it('restores canceled Reopened SRF back to Reopened', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({
                _id: 'approved-parent',
                status: APPROVED,
                nextRevisionId: 'app-reopened',
            });
            app.getApplicationById = jest.fn()
                .mockResolvedValueOnce({
                    _id: 'app-reopened',
                    status: CANCELED,
                    sequenceNumber: 2,
                    applicant: { applicantID: 'user1' },
                    history: [{ status: REOPENED }, { status: CANCELED }],
                })
                .mockResolvedValueOnce({
                    _id: 'app-reopened',
                    status: REOPENED,
                    sequenceNumber: 2,
                    applicant: { applicantID: 'user1' },
                });
            app.applicationDAO.update = jest.fn().mockResolvedValue({ _id: 'app-reopened' });

            await app.restoreApplication({ _id: 'app-reopened', comment: 'restore' }, context);

            expect(app.applicationDAO.findApprovedParentSubmissionRequestByID).toHaveBeenCalledWith('app-reopened');
            expect(app.applicationDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: REOPENED })
            );
        });
    });

    describe('_getUserDisplayName', () => {
        it('prefers fullName when present', () => {
            expect(app._getUserDisplayName({ fullName: 'Full Name', firstName: 'A', lastName: 'B' }))
                .toBe('Full Name');
        });

        it('trims whitespace from fullName', () => {
            expect(app._getUserDisplayName({ fullName: '  Full Name  ', firstName: 'A', lastName: 'B' }))
                .toBe('Full Name');
        });

        it('falls back to firstName and lastName when fullName is absent', () => {
            expect(app._getUserDisplayName({ firstName: 'Jane', lastName: 'Smith' }))
                .toBe('Jane Smith');
        });

        it('falls back to firstName and lastName when fullName is whitespace-only', () => {
            expect(app._getUserDisplayName({ fullName: '   ', firstName: 'Jane', lastName: 'Smith' }))
                .toBe('Jane Smith');
        });

        it('falls back to applicantName when fullName and formatted name are empty', () => {
            expect(app._getUserDisplayName({ applicantName: 'Legacy Applicant' }))
                .toBe('Legacy Applicant');
        });

        it('prefers fullName over applicantName', () => {
            expect(app._getUserDisplayName({
                fullName: 'Full Name',
                applicantName: 'Legacy Applicant',
            })).toBe('Full Name');
        });

        it('prefers formatted name over applicantName when fullName is absent', () => {
            expect(app._getUserDisplayName({
                firstName: 'Jane',
                lastName: 'Smith',
                applicantName: 'Legacy Applicant',
            })).toBe('Jane Smith');
        });

        it('returns empty string when user is null or undefined', () => {
            expect(app._getUserDisplayName(null)).toBe('');
            expect(app._getUserDisplayName(undefined)).toBe('');
        });

        it('returns empty string when no display name fields are present', () => {
            expect(app._getUserDisplayName({})).toBe('');
            expect(app._getUserDisplayName({ email: 'user@example.com' })).toBe('');
        });
    });

    describe('_reformatRecordForApplicationResponse', () => {
        beforeEach(() => {
            app.applicationDAO.findApplicationStatusById = jest.fn();
        });

        it('uses applicantName from nested applicant when fullName and name parts are missing', async () => {
            const result = await app._reformatRecordForApplicationResponse({
                id: 'app-1',
                applicant: {
                    id: 'user-1',
                    applicantName: 'Stored Applicant',
                    email: 'user@example.com',
                },
            });

            expect(result.applicant).toEqual({
                applicantID: 'user-1',
                applicantName: 'Stored Applicant',
                applicantEmail: 'user@example.com',
            });
            expect(result.canBeReopened).toBe(false);
            expect(result.canBeRestored).toBe(false);
        });

        it('sets canBeReopened true when record is Approved without nextRevisionId', async () => {
            const result = await app._reformatRecordForApplicationResponse({
                id: 'app-1',
                status: APPROVED,
                nextRevisionId: null,
            });

            expect(result.canBeReopened).toBe(true);
            expect(result.canBeRestored).toBe(false);
        });

        it('sets canBeRestored true when record is Canceled sequence 1 with valid history', async () => {
            app.applicationDAO.findApprovedParentSubmissionRequestByID = jest.fn();
            const result = await app._reformatRecordForApplicationResponse({
                id: 'app-1',
                status: CANCELED,
                sequenceNumber: 1,
                history: [{ status: IN_PROGRESS }, { status: CANCELED }],
            });

            expect(result.canBeRestored).toBe(true);
            expect(result.canBeReopened).toBe(false);
        });

        it('prefers ownerUser fullName over nested applicant applicantName', async () => {
            const result = await app._reformatRecordForApplicationResponse(
                {
                    id: 'app-1',
                    applicant: { id: 'user-1', applicantName: 'Stored Applicant' },
                },
                { _id: 'user-2', fullName: 'New Owner', email: 'owner@example.com' }
            );

            expect(result.applicant).toEqual({
                applicantID: 'user-2',
                applicantName: 'New Owner',
                applicantEmail: 'owner@example.com',
            });
        });
    });
});
