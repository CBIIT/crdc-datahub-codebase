const { SubmissionRequest, VALID_ORDER_BY_LIST_SUBMISSION_REQUESTS } = require("../../services/submission-request");
const SubmissionRequestDAO = require('../../dao/submission-request');
const USER_PERMISSION_CONSTANTS = require("../../crdc-datahub-database-drivers/constants/user-permission-constants");
const ERROR = require('../../constants/error-constants');
const { NEW, APPROVED, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED, CANCELED, REJECTED, DELETED, SUBMITTED, IN_REVIEW } = require('../../constants/submission-request-constants');
const USER_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-constants');
const { DEFAULT_GPA_NAME } = require('../../domain/pending-gpa');
const { UserScope: RealUserScope } = require('../../domain/user-scope');
const SCOPES = require('../../constants/permission-scope-constants');
const { STUDY_ABBREVIATION_MAX_LENGTH } = require('../../crdc-datahub-database-drivers/constants/approved-study-constants');

// Mock SubmissionRequestDAO
jest.mock('../../dao/submission-request');

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
    findBySubmissionRequestID: jest.fn(),
    storeApprovedStudies: jest.fn(),
    saveApprovedStudyFromSubmissionRequest: jest.fn(),
    updateReapprovedStudy: jest.fn(),
};
const mockUserService = {
    findByID: jest.fn(),
    findByIDs: jest.fn(),
    getUsersByNotifications: jest.fn(),
    getUserByID: jest.fn(),
    updateUserInfo: jest.fn(),
};
const mockDbService = { updateOne: jest.fn(), updateMany: jest.fn() };
const mockNotificationsService = {
    approveQuestionNotification: jest.fn(),
    cancelSubmissionRequestNotification: jest.fn(),
    restoreSubmissionRequestNotification: jest.fn(),
    reopenSubmissionRequestNotification: jest.fn(),
    finalRemindSubmissionRequestsNotification: jest.fn(),
    remindSubmissionRequestsNotification: jest.fn(),
    multipleChangesApproveQuestionNotification: jest.fn(),
    dbGapMissingApproveQuestionNotification: jest.fn(),
    dataModelChangeApproveQuestionNotification: jest.fn(),
    pendingGPANotification: jest.fn(),
    pendingImageDeIdentificationApproveQuestionNotification: jest.fn(),
    inquireQuestionNotification: jest.fn(),
    submitQuestionNotification: jest.fn(),
    submitRequestReceivedNotification: jest.fn()
};
const mockEmailParams = { inactiveDays: 180, inactiveApplicationNotifyDays: [7, 30, 60], conditionalSubmissionContact: 'contact@email', url: 'http://test', submissionGuideURL: 'http://guide' };
const mockProgramService = {
    findOneByProgramName: jest.fn().mockResolvedValue(null),
    upsertByProgramName: jest.fn(),
    getProgramByID: jest.fn(),
    organizationCollection: { update: jest.fn() }
};
const mockInstitutionService = { addNewInstitutions: jest.fn() };
const mockConfigurationService = { findByType: jest.fn() };
const mockAuthorizationService = { getPermissionScope: jest.fn() };

// Mocked constants and helpers
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
global.verifySubmissionRequest = jest.fn(() => ({
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
global.getSubmissionRequestQuestionnaire = jest.fn(() => ({ accessTypes: [], study: {} }));
global.sendEmails = {
    submitSubmissionRequest: jest.fn(),
    rejectSubmissionRequest: jest.fn(),
    inquireSubmissionRequest: jest.fn(),
    inactiveSubmissionRequests: jest.fn()
};
global.getCCEmails = jest.fn(() => []);
global.getUserEmails = jest.fn(() => []);
global.setDefaultIfNoName = jest.fn(name => name || 'NA');
global.EMAIL_NOTIFICATIONS = {
    SUBMISSION_REQUEST: {
        REQUEST_DELETE: 'REQUEST_DELETE',
        REQUEST_REVIEW: 'REQUEST_REVIEW',
        REQUEST_CANCEL: 'REQUEST_CANCEL',
        REQUEST_EXPIRING: 'REQUEST_EXPIRING',
        REQUEST_REOPENED: 'REQUEST_REOPENED'
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

describe('SubmissionRequest', () => {
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
        app = new SubmissionRequest(
            mockLogCollection,
            mockApplicationCollection,
            mockApprovedStudiesService,
            mockUserService,
            mockDbService,
            mockNotificationsService,
            mockEmailParams,
            mockProgramService,
            mockInstitutionService,
            mockConfigurationService,
            mockAuthorizationService
        );

        appService = new SubmissionRequest(
            mockLogCollection,
            {}, // submissionRequestCollection (unused)
            mockApprovedStudiesService,
            mockUserService,
            mockDbService,
            mockNotificationsService,
            { inactiveDays: 180, inactiveApplicationNotifyDays: [7, 30], url: 'http://test', conditionalSubmissionContact: 'help@test.com' },
            mockProgramService,
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

    describe('getSubmissionRequest', () => {
        beforeEach(() => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.ALL, scopeValues: [] },
            ]);
        });

        it('should return submissionRequest with upgraded version', async () => {
            // Mock getSubmissionRequestById to return an submissionRequest with APPROVED status and version '2.0'
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED, version: '2.0' });
            // Mock _checkConditionalApproval to do nothing
            app._checkConditionalApproval = jest.fn().mockResolvedValue(undefined);
            // Mock _getSubmissionRequestVersionByStatus to return '2.0'
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('2.0');

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context)).resolves.toMatchObject({ _id: 'app1', version: '2.0' });

            expect(app.getSubmissionRequestById).toHaveBeenCalledWith('app1');
            expect(app._checkConditionalApproval).toHaveBeenCalledWith(expect.objectContaining({ _id: 'app1', status: APPROVED, version: '2.0' }));
            expect(app._getSubmissionRequestVersionByStatus).toHaveBeenCalledWith(APPROVED, '2.0');
        });

        it('calls _checkConditionalApproval when status matches Approved case-insensitively', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({ _id: 'app1', status: 'approved', version: '2.0' });
            app._checkConditionalApproval = jest.fn().mockResolvedValue(undefined);
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('2.0');

            await app.getSubmissionRequest({ _id: 'app1' }, context);

            expect(app._checkConditionalApproval).toHaveBeenCalledWith(expect.objectContaining({ _id: 'app1', status: 'approved' }));
        });

        it('does not replace missing or whitespace-only studyAbbreviation with study name', async () => {
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('3.0');

            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                studyName: 'Full Study',
                studyAbbreviation: null,
                applicant: { applicantID: 'u1', applicantName: 'Submitter', applicantEmail: 's@test.com' }
            });
            await expect(app.getSubmissionRequest({ _id: 'app1' }, context)).resolves.toMatchObject({
                studyAbbreviation: null,
                studyName: 'Full Study'
            });

            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                studyName: 'Full Study',
                studyAbbreviation: '   ',
                applicant: { applicantID: 'u1', applicantName: 'Submitter', applicantEmail: 's@test.com' }
            });
            await expect(app.getSubmissionRequest({ _id: 'app1' }, context)).resolves.toMatchObject({
                studyAbbreviation: '   ',
                studyName: 'Full Study'
            });
        });

        it('rejects own-scope caller who is not the applicant', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.OWN, scopeValues: [] },
            ]);

            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: APPROVED,
                applicant: { applicantID: 'other-user' },
            });

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.INVALID_PERMISSION);
        });

        it('allows own-scope caller who owns the submissionRequest', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.OWN, scopeValues: [] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                version: '3.0',
                applicant: { applicantID: 'user1' },
            });
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('3.0');

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context)).resolves.toMatchObject({
                _id: 'app1',
                applicant: { applicantID: 'user1' },
            });
        });

        it('allows all-scope caller to view a non-owned submissionRequest', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                version: '3.0',
                applicant: { applicantID: 'other-user' },
            });
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('3.0');

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context)).resolves.toMatchObject({
                _id: 'app1',
            });
        });

        it('rejects none scope the same as unsupported scopes', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.NONE, scopeValues: [] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                applicant: { applicantID: 'user1' },
            });

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.INVALID_PERMISSION);
        });

        it.each([
            ['study', SCOPES.STUDY],
            ['DC', SCOPES.DC],
            ['role', SCOPES.ROLE],
        ])('rejects %s scope like none', async (_label, scope) => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope, scopeValues: ['study-1'] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                applicant: { applicantID: 'user1' },
            });

            await expect(app.getSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.INVALID_PERMISSION);
        });

        it('allows previous owner to view their older approved revision after reassignment', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.OWN, scopeValues: [] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'approved-v1',
                status: APPROVED,
                applicant: { applicantID: 'user1' },
            });
            app._checkConditionalApproval = jest.fn().mockResolvedValue(undefined);
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('2.0');

            await expect(app.getSubmissionRequest({ _id: 'approved-v1' }, context)).resolves.toMatchObject({
                _id: 'approved-v1',
                applicant: { applicantID: 'user1' },
            });
        });

        it('blocks previous owner from viewing reassigned reopened revision', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.OWN, scopeValues: [] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'reopened-v2',
                status: IN_PROGRESS,
                applicant: { applicantID: 'new-owner' },
            });

            await expect(app.getSubmissionRequest({ _id: 'reopened-v2' }, context))
                .rejects.toThrow(ERROR.INVALID_PERMISSION);
        });

        it('resolves view scope via submission_request:view permission', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: NEW,
                applicant: { applicantID: 'user1' },
            });
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('3.0');

            await app.getSubmissionRequest({ _id: 'app1' }, context);

            expect(mockAuthorizationService.getPermissionScope).toHaveBeenCalledWith(
                context.userInfo,
                USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW
            );
        });

        it('returns view permission error for own-scope caller when submissionRequest id is missing', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([
                { scope: SCOPES.OWN, scopeValues: [] },
            ]);
            app.getSubmissionRequestById = jest.fn().mockRejectedValue(
                new Error(`${ERROR.SUBMISSION_REQUEST_NOT_FOUND}missing-id`)
            );

            await expect(app.getSubmissionRequest({ _id: 'missing-id' }, context))
                .rejects.toThrow(ERROR.INVALID_PERMISSION);
        });

        it('returns not found for all-scope caller when submissionRequest id is missing', async () => {
            app.getSubmissionRequestById = jest.fn().mockRejectedValue(
                new Error(`${ERROR.SUBMISSION_REQUEST_NOT_FOUND}missing-id`)
            );

            await expect(app.getSubmissionRequest({ _id: 'missing-id' }, context))
                .rejects.toThrow(`${ERROR.SUBMISSION_REQUEST_NOT_FOUND}missing-id`);
        });
    });

    describe('_canViewSubmissionRequest', () => {
        it('returns true for all scope regardless of ownership', () => {
            const userScope = new RealUserScope([{ scope: SCOPES.ALL, scopeValues: [] }]);
            expect(app._canViewSubmissionRequest(
                userScope,
                { _id: 'user1' },
                { applicant: { applicantID: 'other-user' } }
            )).toBe(true);
        });

        it('returns true for own scope when user is the applicant', () => {
            const userScope = new RealUserScope([{ scope: SCOPES.OWN, scopeValues: [] }]);
            expect(app._canViewSubmissionRequest(
                userScope,
                { _id: 'user1' },
                { applicant: { applicantID: 'user1' } }
            )).toBe(true);
        });

        it('resolves applicantID from root field for own scope', () => {
            const userScope = new RealUserScope([{ scope: SCOPES.OWN, scopeValues: [] }]);
            expect(app._canViewSubmissionRequest(
                userScope,
                { _id: 'user1' },
                { applicantID: 'user1' }
            )).toBe(true);
        });

        it('returns false for own scope when user is not the applicant', () => {
            const userScope = new RealUserScope([{ scope: SCOPES.OWN, scopeValues: [] }]);
            expect(app._canViewSubmissionRequest(
                userScope,
                { _id: 'user1' },
                { applicant: { applicantID: 'other-user' } }
            )).toBe(false);
        });

        it.each([
            ['none', SCOPES.NONE],
            ['study', SCOPES.STUDY],
            ['DC', SCOPES.DC],
            ['role', SCOPES.ROLE],
        ])('returns false for %s scope', (_label, scope) => {
            const userScope = new RealUserScope([{ scope, scopeValues: [] }]);
            expect(app._canViewSubmissionRequest(
                userScope,
                { _id: 'user1' },
                { applicant: { applicantID: 'user1' } }
            )).toBe(false);
        });
    });

    describe('_getSubmissionRequestVersionByStatus', () => {
        it('returns new version for NEW/IN_PROGRESS/INQUIRED/REOPENED', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            // Patch: simulate status logic for new version
            await expect(app._getSubmissionRequestVersionByStatus(NEW)).resolves.toBe('3.0');
            await expect(app._getSubmissionRequestVersionByStatus(IN_PROGRESS)).resolves.toBe('3.0');
            await expect(app._getSubmissionRequestVersionByStatus(INQUIRED)).resolves.toBe('3.0');
            await expect(app._getSubmissionRequestVersionByStatus(REOPENED)).resolves.toBe('3.0');
        });

        it('returns current version for other status if version is null', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            await expect(app._getSubmissionRequestVersionByStatus(APPROVED)).resolves.toBe('2.0');
        });

        it('returns passed version if present', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            await expect(app._getSubmissionRequestVersionByStatus(APPROVED, '1.5')).resolves.toBe('1.5');
        });
    });

    describe('_checkConditionalApproval', () => {
        it('sets conditional and pendingConditions if needed', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ controlledAccess: true, dbGaPID: null, pendingModelChange: true }]);
            const submissionRequest = { studyName: 'study1' };
            await app._checkConditionalApproval(submissionRequest);
            expect(submissionRequest.conditional).toBe(true);
            expect(submissionRequest.pendingConditions).toContain(ERROR.CONTROLLED_STUDY_NO_DBGAPID);
            expect(submissionRequest.pendingConditions).toContain(ERROR.PENDING_APPROVED_STUDY);
        });

        it('includes pending image de-identification in pendingConditions when applicable', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{
                controlledAccess: false,
                pendingModelChange: false,
                pendingImageDeIdentification: true
            }]);
            const submissionRequest = { studyName: 'study1' };
            await app._checkConditionalApproval(submissionRequest);
            expect(submissionRequest.conditional).toBe(true);
            expect(submissionRequest.pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
        });

        it('sets conditional false and empty pendingConditions when no studies found', async () => {
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            const submissionRequest = { studyName: 'study1' };
            await app._checkConditionalApproval(submissionRequest);
            expect(submissionRequest.conditional).toBe(false);
            expect(submissionRequest.pendingConditions).toEqual([]);
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
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn();
        });

        it('returns false when there is no nextRevisionId', async () => {
            await expect(app._hasActiveLaterRevisions({ _id: 'seq1', status: APPROVED }))
                .resolves.toBe(false);
            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).not.toHaveBeenCalled();
        });

        it('returns true when the immediate successor is non-terminal', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: REOPENED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(true);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).toHaveBeenCalledWith('seq2');
        });

        it('returns true when the immediate successor is Approved', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: APPROVED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(true);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).toHaveBeenCalledTimes(1);
        });

        it('returns false when the immediate successor is terminal', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: CANCELED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(false);
        });

        it('returns false when the immediate successor is terminal even if nextRevisionId is set', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: CANCELED });

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            })).resolves.toBe(false);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).toHaveBeenCalledTimes(1);
        });

        it('throws when findSubmissionRequestStatusByID fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockRejectedValueOnce(new Error('not found'));

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'missing',
            })).rejects.toThrow(ERROR.INTERNAL_ERROR);

            expect(console.error).toHaveBeenCalled();
            console.error.mockRestore();
        });

        it('returns false when findSubmissionRequestStatusByID resolves null', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce(null);

            await expect(app._hasActiveLaterRevisions({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'missing',
            })).resolves.toBe(false);
        });
    });

    describe('_hasApprovedParentSRF', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('returns true when an Approved parent links to this submissionRequest', async () => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            });

            await expect(app._hasApprovedParentSRF({ _id: 'seq2', status: CANCELED }))
                .resolves.toBe(true);
            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).toHaveBeenCalledWith('seq2');
        });

        it('returns false when no Approved parent links to this submissionRequest', async () => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue(null);

            await expect(app._hasApprovedParentSRF({ _id: 'seq2', status: CANCELED }))
                .resolves.toBe(false);
        });

        it('returns false when submissionRequest id is missing', async () => {
            await expect(app._hasApprovedParentSRF({ status: CANCELED }))
                .resolves.toBe(false);
            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });
    });

    describe('_computeCanBeReopened', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn();
        });

        it('returns true for Approved with no nextRevisionId', async () => {
            await expect(app._computeCanBeReopened({ status: APPROVED, nextRevisionId: null }))
                .resolves.toBe(true);
            await expect(app._computeCanBeReopened({ status: APPROVED }))
                .resolves.toBe(true);
            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).not.toHaveBeenCalled();
        });

        it('returns false when an active successor exists', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: REOPENED });

            await expect(app._computeCanBeReopened({
                status: APPROVED,
                nextRevisionId: 'successor-id',
            })).resolves.toBe(false);
        });

        it('returns true when all successors are terminal', async () => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID.mockResolvedValueOnce({ status: CANCELED });

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
            expect(app.submissionRequestDAO.findSubmissionRequestStatusByID).not.toHaveBeenCalled();
        });
    });

    describe('_computeCanBeRestored', () => {
        const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
        const validDeletedHistory = [{ status: IN_PROGRESS }, { status: DELETED }];

        beforeEach(() => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('returns true for Canceled sequence 1 with valid history', async () => {
            await expect(app._computeCanBeRestored({
                status: CANCELED,
                sequenceNumber: 1,
                history: validCanceledHistory,
            })).resolves.toBe(true);
            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
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
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
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
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue(null);

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
            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });
    });

    describe('_computeSRFStateFields', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn();
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn();
        });

        it('sets canBeReopened and canBeRestored on the submissionRequest object', async () => {
            const submissionRequest = { status: APPROVED, nextRevisionId: null };
            await app._computeSRFStateFields(submissionRequest);
            expect(submissionRequest.canBeReopened).toBe(true);
            expect(submissionRequest.canBeRestored).toBe(false);
        });

        it('sets canBeRestored true for linked canceled revisions', async () => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID.mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                nextRevisionId: 'seq2',
            });
            const submissionRequest = {
                _id: 'seq2',
                status: CANCELED,
                sequenceNumber: 2,
                history: [{ status: REOPENED }, { status: CANCELED }],
            };
            await app._computeSRFStateFields(submissionRequest);
            expect(submissionRequest.canBeReopened).toBe(false);
            expect(submissionRequest.canBeRestored).toBe(true);
        });

        it('returns null when submissionRequest is null', async () => {
            await expect(app._computeSRFStateFields(null)).resolves.toBeNull();
        });
    });

    describe('_batchComputeListSubmissionRequestFields', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs = jest.fn().mockResolvedValue([]);
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);
        });

        it('returns an empty study map for an empty page', async () => {
            const result = await app._batchComputeListSubmissionRequestFields([]);

            expect(result.studyByLowerName).toEqual(new Map());
            expect(app.submissionRequestDAO.findSubmissionRequestStatusesByIDs).not.toHaveBeenCalled();
            expect(app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyNames).not.toHaveBeenCalled();
        });

        it('sets canBeReopened and canBeRestored from batch prefetched data', async () => {
            const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
            const rows = [
                { id: 'a1', status: APPROVED, nextRevisionId: 'successor-active', studyName: 'S1' },
                { id: 'c2', status: CANCELED, sequenceNumber: 2, history: validCanceledHistory, studyName: 'S2' },
            ];
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs.mockResolvedValue([
                { id: 'successor-active', status: REOPENED },
            ]);
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs.mockResolvedValue([
                { nextRevisionId: 'c2' },
            ]);

            await app._batchComputeListSubmissionRequestFields(rows);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusesByIDs).toHaveBeenCalledWith(['successor-active']);
            expect(app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs).toHaveBeenCalledWith(['c2']);
            expect(rows[0].canBeReopened).toBe(false);
            expect(rows[1].canBeRestored).toBe(true);
        });

        it('dedupes study names case-insensitively for findByStudyNames', async () => {
            const rows = [
                { id: 'a1', status: APPROVED, studyName: 'MyStudy' },
                { id: 'a2', status: APPROVED, studyName: 'mystudy' },
            ];

            await app._batchComputeListSubmissionRequestFields(rows);

            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledWith(['MyStudy']);
        });
    });

    describe('_pruneRevisionChainOnTerminal', () => {
        it('clears inbound nextRevisionId links via the DAO', async () => {
            app.submissionRequestDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });

            await app._pruneRevisionChainOnTerminal('terminal-app-id');

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).toHaveBeenCalledWith('terminal-app-id');
        });

        it('does not call DAO when submissionRequestID is falsy', async () => {
            app.submissionRequestDAO.clearNextRevisionIdPointingTo = jest.fn();

            await app._pruneRevisionChainOnTerminal(null);

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('getSubmissionRequestById', () => {
        it('returns result from submissionRequestDAO', async () => {
            app.submissionRequestDAO = {
                findSubmissionRequestWithApplicantByID: jest.fn().mockResolvedValue({
                    id: 'app1',
                    applicant: {
                        id: '',
                        firstName: '',
                        lastName: '',
                        email: ''
                    }
                })
            };
            await expect(app.getSubmissionRequestById('app1')).resolves.toEqual({
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
            expect(app.submissionRequestDAO.findSubmissionRequestWithApplicantByID).toHaveBeenCalledWith('app1');
        });

        it('throws if not found', async () => {
            app.submissionRequestDAO = {
                findSubmissionRequestWithApplicantByID: jest.fn().mockResolvedValue(null)
            };
            await expect(app.getSubmissionRequestById('app1')).rejects.toThrow(ERROR.SUBMISSION_REQUEST_NOT_FOUND + 'app1');
        });
    });

    describe('createSubmissionRequest', () => {
        it('creates and returns submissionRequest', async () => {
            // Patch: use submissionRequestDAO mock to avoid Prisma call
            app.submissionRequestDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            const submissionRequest = { controlledAccess: true };
            const userInfo = context.userInfo;
            await expect(app.createSubmissionRequest(submissionRequest, userInfo)).resolves.toMatchObject({ controlledAccess: true });
            expect(app.submissionRequestDAO.insert).toHaveBeenCalled();
            expect(mockLogCollection.insert).toHaveBeenCalled();
        });

        it('defaults to New when no status is requested for new submissionRequests', async () => {
            app.submissionRequestDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const submissionRequest = { controlledAccess: true };
            const userInfo = context.userInfo;

            const result = await app.createSubmissionRequest(submissionRequest, userInfo);

            expect(result.status).toBe(NEW);
            expect(result.history).toHaveLength(1);
            expect(result.history[0]).toMatchObject({ userID: userInfo._id, status: NEW });
            expect(app.submissionRequestDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ status: NEW }));
        });

        it('adds a New event before In Progress when requested', async () => {
            app.submissionRequestDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const submissionRequest = { controlledAccess: true };
            const userInfo = context.userInfo;

            const result = await app.createSubmissionRequest(submissionRequest, userInfo, IN_PROGRESS);

            expect(result.status).toBe(IN_PROGRESS);
            expect(result.history).toHaveLength(2);
            expect(result.history[0]).toMatchObject({ userID: userInfo._id, status: NEW });
            expect(result.history[1]).toMatchObject({ userID: userInfo._id, status: IN_PROGRESS });
            expect(new Date(result.history[0].dateTime).getTime()).toBeLessThan(new Date(result.history[1].dateTime).getTime());
            expect(app.submissionRequestDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ status: IN_PROGRESS }));
        });

        it('initializes sequenceNumber to 1', async () => {
            app.submissionRequestDAO = {
                insert: jest.fn().mockResolvedValue({ acknowledged: true }),
            };
            mockLogCollection.insert.mockResolvedValue();
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            await app.createSubmissionRequest({}, context.userInfo);

            expect(app.submissionRequestDAO.insert).toHaveBeenCalledWith(expect.objectContaining({ sequenceNumber: 1 }));
        });
    });

    describe('saveSubmissionRequest', () => {
        it('creates new submissionRequest with New status if no status is provided', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            const params = { application: {} };
            jest.spyOn(app, 'createSubmissionRequest').mockResolvedValue({ _id: 'app2' });
            await expect(app.saveSubmissionRequest(params, context)).resolves.toEqual({ _id: 'app2' });
            expect(app.createSubmissionRequest).toHaveBeenCalledWith({}, context.userInfo, NEW);
        });

        it('creates new submissionRequest with In Progress status when requested', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            const params = { application: {}, status: IN_PROGRESS };
            jest.spyOn(app, 'createSubmissionRequest').mockResolvedValue({ _id: 'app2' });
            await expect(app.saveSubmissionRequest(params, context)).resolves.toEqual({ _id: 'app2' });
            expect(app.createSubmissionRequest).toHaveBeenCalledWith({}, context.userInfo, IN_PROGRESS);
        });

        it("should throw an error when the submissionRequest does not exist", async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            const params = { application: { _id: 'a-app-that-does-not-exist' } };

            await expect(app.saveSubmissionRequest(params, context)).rejects.toThrow(ERROR.SUBMISSION_REQUEST_NOT_FOUND);
        });

        it.each([CANCELED, REJECTED, DELETED, SUBMITTED, IN_REVIEW, APPROVED])('should throw error when trying to set the status to %s', async (status) => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'invalid-status-provided', applicant: { applicantID: 'user1' }, status: NEW });

            const params = { application: { _id: 'invalid-status-provided' }, status };
            await expect(app.saveSubmissionRequest(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it("should throw an error if no status is provided", async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);

            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'no-status-provided', applicant: { applicantID: 'user1' }, status: NEW });

            const params = { application: { _id: 'no-status-provided' } }; // NOTE: We're omitting status param
            await expect(app.saveSubmissionRequest(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it('throws if not owner', async () => {
            // Setup: the stored submissionRequest has a different applicantID than the current user
            const params = { application: { _id: 'app1' } };
            // Mock getSubmissionRequestById to return an submissionRequest with applicantID 'other'
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'app1', applicant: { applicantID: 'other' }, status: NEW });
            await expect(app.saveSubmissionRequest(params, context)).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('should throw an error when studyAbbreviation exceeds the character limit', async () => {
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'app1', applicant: { applicantID: 'user1' }, status: IN_PROGRESS });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const params = { application: { _id: 'app1', studyAbbreviation: 'A'.repeat(STUDY_ABBREVIATION_MAX_LENGTH + 1) }, status: IN_PROGRESS };
            await expect(app.saveSubmissionRequest(params, context)).rejects.toThrow("Study abbreviation cannot exceed");
        });

        it('should not throw when studyAbbreviation is at the character limit', async () => {
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'app1', applicant: { applicantID: 'user1' }, status: IN_PROGRESS });
            jest.spyOn(app, '_updateSubmissionRequest').mockResolvedValue({ _id: 'app1', status: IN_PROGRESS });
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValueOnce({ _id: 'app1', applicant: { applicantID: 'user1' }, status: IN_PROGRESS });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const params = { application: { _id: 'app1', studyAbbreviation: 'A'.repeat(STUDY_ABBREVIATION_MAX_LENGTH) }, status: IN_PROGRESS };
            await expect(app.saveSubmissionRequest(params, context)).resolves.toBeDefined();
        });

        it('should not throw when studyAbbreviation is absent', async () => {
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({ _id: 'app1', applicant: { applicantID: 'user1' }, status: IN_PROGRESS });
            jest.spyOn(app, '_updateSubmissionRequest').mockResolvedValue({ _id: 'app1', status: IN_PROGRESS });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const params = { application: { _id: 'app1' }, status: IN_PROGRESS };
            await expect(app.saveSubmissionRequest(params, context)).resolves.toBeDefined();
        });
    });

    describe('getMyLastSubmissionRequest', () => {
        it('returns last approved submissionRequest', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false); // Ensure user has scope
            userScopeMock.isAllScope.mockReturnValue(true);   // Ensure user has all scope
            app.submissionRequestDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED }),
            };
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({
                _id: 'app1',
                status: APPROVED,
                institution: { id: 'inst1', _id: 'inst1' },
            });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const result = await app.getMyLastSubmissionRequest({}, context);
            expect(app.submissionRequestDAO.findLatestApprovedByApplicantID).toHaveBeenCalledWith('user1');
            expect(app.getSubmissionRequestById).toHaveBeenCalledWith('app1');
            expect(result).toMatchObject({ _id: 'app1', version: '3.0', institution: { id: 'inst1', _id: 'inst1' } });
        });

        it('hydrates conditional and pendingConditions when approved study has pending image de-identification', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            UserScope.create.mockReturnValue(userScopeMock);
            app.submissionRequestDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({ _id: 'app1', status: APPROVED }),
            };
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({
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

            const result = await app.getMyLastSubmissionRequest({}, context);

            expect(result).toMatchObject({
                _id: 'app1',
                version: '3.0',
                conditional: true,
                institution: { id: 'inst1', _id: 'inst1' }
            });
            expect(result.pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
        });

        it('returns null when no previous approved submissionRequest exists', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            
            app.submissionRequestDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue(null),
            };

            const result = await app.getMyLastSubmissionRequest({}, context);
            expect(result).toBeNull();
        });

        it('returns the most recent approved submissionRequest even when it has a successor revision', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isAllScope.mockReturnValue(true);
            app.submissionRequestDAO = {
                findLatestApprovedByApplicantID: jest.fn().mockResolvedValue({
                    _id: 'seq1',
                    status: APPROVED,
                    nextRevisionId: 'seq2',
                    createdAt: new Date('2024-02-01'),
                }),
            };
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({
                _id: 'seq1',
                status: APPROVED,
                studyName: 'Study',
                nextRevisionId: 'seq2',
            });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const result = await app.getMyLastSubmissionRequest({}, context);

            expect(result).toMatchObject({ _id: 'seq1', version: '3.0' });
        });
    });

    describe('listSubmissionRequests', () => {
        const mockListDao = () => {
            app.submissionRequestDAO.findManyWithApplicant = jest.fn().mockResolvedValue([]);
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            app.submissionRequestDAO.distinct = jest.fn().mockResolvedValue([]);
            app.submissionRequestDAO.distinctApplicantFullNames = jest.fn().mockResolvedValue([]);
        };

        beforeEach(() => {
            mockListDao();
            userScopeMock.isAllScope = jest.fn(() => true);
            userScopeMock.isOwnScope = jest.fn(() => false);
            userScopeMock.isStudyScope = jest.fn(() => false);
            userScopeMock.isDCScope = jest.fn(() => false);
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['all']);
            UserScope.create.mockReturnValue(userScopeMock);
        });

        it('throws LIST_SUBMISSION_REQUESTS_INVALID_PARAMS for invalid orderBy', async () => {
            await expect(app.listSubmissionRequests({ orderBy: 'InvalidColumn' }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        });

        it('accepts each valid orderBy and resolves successfully', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            for (const orderBy of VALID_ORDER_BY_LIST_SUBMISSION_REQUESTS) {
                await expect(app.listSubmissionRequests({ orderBy }, context)).resolves.toBeDefined();
            }
        });

        it('accepts valid orderBy case-insensitively', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            await expect(app.listSubmissionRequests({ orderBy: 'CREATEDAT' }, context)).resolves.toBeDefined();
            await expect(app.listSubmissionRequests({ orderBy: 'StudyName' }, context)).resolves.toBeDefined();
        });

        it('passes applicant.fullName as orderBy when orderBy is applicant.applicantName', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            await app.listSubmissionRequests({ orderBy: 'applicant.applicantName' }, context);
            const findManyOptions = findManyMock.mock.calls[0][1];
            expect(findManyOptions.orderBy).toBe('applicant.fullName');
            expect(findManyOptions.sortDirection).toBe('DESC');
        });

        it('passes requested orderBy through for other valid values', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            await app.listSubmissionRequests({ orderBy: 'createdAt', sortDirection: 'ASC' }, context);
            const findManyOptions = findManyMock.mock.calls[0][1];
            expect(findManyOptions.orderBy).toBe('createdAt');
            expect(findManyOptions.sortDirection).toBe('ASC');
        });

        it('throws LIST_SUBMISSION_REQUESTS_INVALID_PARAMS for invalid sortDirection', async () => {
            await expect(app.listSubmissionRequests({ sortDirection: 'INVALID' }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        });

        it('returns submissionRequests and aggregations when findMany is mocked', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            const result = await app.listSubmissionRequests({}, context);
            expect(result).toHaveProperty('submissionRequests');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('programs');
            expect(result).toHaveProperty('studies');
            expect(result).toHaveProperty('studyAbbreviations');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('submitterNames');
            expect(Array.isArray(result.submissionRequests)).toBe(true);
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
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(1);
            const result = await app.listSubmissionRequests({}, context);
            expect(result.submissionRequests[0].studyAbbreviation).toBe('My Full Study');
            expect(result.submissionRequests[0].studyName).toBe('My Full Study');
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
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(4);
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs = jest.fn().mockResolvedValue([
                { id: 'successor-active', status: REOPENED },
                { id: 'successor-canceled', status: CANCELED },
            ]);
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);

            const result = await app.listSubmissionRequests({}, context);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusesByIDs).toHaveBeenCalledTimes(1);
            expect(app.submissionRequestDAO.findSubmissionRequestStatusesByIDs).toHaveBeenCalledWith([
                'successor-active',
                'successor-canceled',
            ]);
            expect(result.submissionRequests).toHaveLength(4);
            expect(result.submissionRequests[0].canBeReopened).toBe(true);
            expect(result.submissionRequests[1].canBeReopened).toBe(false);
            expect(result.submissionRequests[2].canBeReopened).toBe(true);
            expect(result.submissionRequests[3].canBeReopened).toBe(false);
            expect(result.submissionRequests.every((row) => row.canBeRestored === false)).toBe(true);
        });

        it('sets canBeRestored on list rows for Canceled and Deleted submissionRequests', async () => {
            const validCanceledHistory = [{ status: IN_PROGRESS }, { status: CANCELED }];
            const validDeletedHistory = [{ status: IN_PROGRESS }, { status: DELETED }];
            const rows = [
                { id: 'c1', status: CANCELED, sequenceNumber: 1, history: validCanceledHistory, studyName: 'S1', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'c2', status: CANCELED, sequenceNumber: 2, history: validCanceledHistory, studyName: 'S2', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'd1', status: DELETED, sequenceNumber: 2, history: validDeletedHistory, studyName: 'S3', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'd2', status: DELETED, sequenceNumber: 3, history: validDeletedHistory, studyName: 'S4', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
            ];
            let n = 0;
            app.submissionRequestDAO.findManyWithApplicant = jest.fn().mockImplementation(() => {
                n += 1;
                return Promise.resolve(n === 1 ? rows : []);
            });
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(4);
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs = jest.fn().mockResolvedValue([]);
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs = jest.fn().mockResolvedValue([
                { nextRevisionId: 'c2' },
                { nextRevisionId: 'd2' },
            ]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([]);

            const result = await app.listSubmissionRequests({}, context);

            expect(app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs).toHaveBeenCalledTimes(1);
            expect(app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs).toHaveBeenCalledWith([
                'c2',
                'd1',
                'd2',
            ]);
            expect(result.submissionRequests[0].canBeRestored).toBe(true);
            expect(result.submissionRequests[1].canBeRestored).toBe(true);
            expect(result.submissionRequests[2].canBeRestored).toBe(false);
            expect(result.submissionRequests[3].canBeRestored).toBe(true);
        });

        it('hydrates conditional and pendingConditions for approved rows via one study batch lookup', async () => {
            const rows = [
                { id: 'a1', status: APPROVED, studyName: 'Alpha Study', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
                { id: 'a2', status: APPROVED, studyName: 'Beta Study', applicant: { id: 'u1', fullName: 'Alice', email: 'a@a' } },
            ];
            let n = 0;
            app.submissionRequestDAO.findManyWithApplicant = jest.fn().mockImplementation(() => {
                n += 1;
                return Promise.resolve(n === 1 ? rows : []);
            });
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(2);
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs = jest.fn().mockResolvedValue([]);
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs = jest.fn().mockResolvedValue([]);
            mockApprovedStudiesService.findByStudyNames.mockResolvedValue([
                { _id: 'study-1', studyName: 'Alpha Study', pendingImageDeIdentification: true },
                { _id: 'study-2', studyName: 'Beta Study', controlledAccess: true, dbGaPID: null },
            ]);

            const result = await app.listSubmissionRequests({}, context);

            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledTimes(1);
            expect(mockApprovedStudiesService.findByStudyNames).toHaveBeenCalledWith(['Alpha Study', 'Beta Study']);
            expect(result.submissionRequests[0].conditional).toBe(true);
            expect(result.submissionRequests[0].pendingConditions).toContain(ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION);
            expect(result.submissionRequests[1].conditional).toBe(true);
            expect(result.submissionRequests[1].pendingConditions).toContain(ERROR.CONTROLLED_STUDY_NO_DBGAPID);
        });

        it('skips batch revision lookups when the page is empty', async () => {
            mockListDao();
            app.submissionRequestDAO.findSubmissionRequestStatusesByIDs = jest.fn();
            app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs = jest.fn();
            mockApprovedStudiesService.findByStudyNames = jest.fn();

            await app.listSubmissionRequests({}, context);

            expect(app.submissionRequestDAO.findSubmissionRequestStatusesByIDs).not.toHaveBeenCalled();
            expect(app.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyNames).not.toHaveBeenCalled();
        });

        it('returns empty list when scope is study (only all and own supported for filters)', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'study', scopeValues: ['study1'] }]);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(false);
            const result = await app.listSubmissionRequests({}, context);
            expect(result.submissionRequests).toEqual([]);
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
            const result = await app.listSubmissionRequests({}, context);
            expect(result.submissionRequests).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.programs).toEqual([]);
            expect(result.studies).toEqual([]);
            expect(result.studyAbbreviations).toEqual([]);
            expect(result.status).toEqual([]);
            expect(result.submitterNames).toEqual([]);
        });

        it('throws LIST_SUBMISSION_REQUESTS_INVALID_PARAMS when params.statuses is not an array', async () => {
            await expect(app.listSubmissionRequests({ statuses: 'APPROVED' }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            await expect(app.listSubmissionRequests({ statuses: {} }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        });

        it('throws SUBMISSION_REQUEST_INVALID_STATUSES for invalid status in params.statuses', async () => {
            await expect(app.listSubmissionRequests({ statuses: ['InvalidStatus'] }, context))
                .rejects.toThrow(/Requested statuses.*InvalidStatus.*are not valid/);
        });

        it('accepts valid statuses case-insensitively and returns successfully', async () => {
            mockListDao();
            await expect(app.listSubmissionRequests({ statuses: ['new', 'Approved'] }, context)).resolves.toBeDefined();
            const result = await app.listSubmissionRequests({ statuses: ['new', 'Approved'] }, context);
            expect(result.submissionRequests).toEqual([]);
            expect(result.total).toBe(0);
        });

        it('passes filter without status to DAO when statuses is empty array', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            await app.listSubmissionRequests({ statuses: [] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.submissionRequestDAO.countWithApplicant.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('passes filter without status to DAO when statuses contains All', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            await app.listSubmissionRequests({ statuses: ['All'] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.submissionRequestDAO.countWithApplicant.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('passes filter without status to DAO when statuses contains All with other statuses', async () => {
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            await app.listSubmissionRequests({ statuses: ['All', 'Approved'] }, context);
            const findManyFilter = findManyMock.mock.calls[0][0];
            const countFilter = app.submissionRequestDAO.countWithApplicant.mock.calls[0][0];
            expect(findManyFilter).not.toHaveProperty('status');
            expect(countFilter).not.toHaveProperty('status');
        });

        it('throws LIST_SUBMISSION_REQUESTS_INVALID_PARAMS for invalid first', async () => {
            await expect(app.listSubmissionRequests({ first: 0 }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            await expect(app.listSubmissionRequests({ first: 1.5 }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        });

        it('throws LIST_SUBMISSION_REQUESTS_INVALID_PARAMS for invalid offset', async () => {
            await expect(app.listSubmissionRequests({ offset: -1 }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            await expect(app.listSubmissionRequests({ offset: 1.5 }, context))
                .rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        });

        it('passes applicantID in filter when scope is own', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue(['own']);
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            const ctx = { ...context, userInfo: { ...context.userInfo, _id: 'user-123' } };
            const findManyMock = jest.fn().mockResolvedValue([]);
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = findManyMock;
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
            await app.listSubmissionRequests({}, ctx);
            const findManyCalls = findManyMock.mock.calls;
            expect(findManyCalls.length).toBeGreaterThan(0);
            const firstCallFilter = findManyCalls[0][0];
            expect(firstCallFilter).toEqual(expect.objectContaining({ applicantID: 'user-123' }));
            const countCalls = app.submissionRequestDAO.countWithApplicant.mock.calls;
            expect(countCalls.length).toBe(1);
            expect(countCalls[0][0]).toEqual(expect.objectContaining({ applicantID: 'user-123' }));
        });

        it('returns empty list when scope is none or empty', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([]);
            UserScope.create.mockReturnValue({ isAllScope: () => false, isOwnScope: () => false });
            const result = await app.listSubmissionRequests({}, context);
            expect(result.submissionRequests).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.programs).toEqual([]);
            expect(result.studies).toEqual([]);
            expect(result.studyAbbreviations).toEqual([]);
            expect(result.status).toEqual([]);
            expect(result.submitterNames).toEqual([]);
        });

        it('returns status as array not function', async () => {
            mockListDao();
            const result = await app.listSubmissionRequests({}, context);
            expect(Array.isArray(result.status)).toBe(true);
            expect(result.status).toEqual([]);
        });

        it('rejects with LIST_SUBMISSION_REQUESTS_FETCH_FAILED and submissionRequest list step when findMany fails for list', async () => {
            mockListDao();
            app.submissionRequestDAO.findManyWithApplicant = jest.fn().mockRejectedValue(new Error('DB error'));
            await expect(app.listSubmissionRequests({}, context)).rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED);
            await expect(app.listSubmissionRequests({}, context)).rejects.toThrow(/fetching submission request list/);
        });

        it('rejects with LIST_SUBMISSION_REQUESTS_FETCH_FAILED and submissionRequest count step when count fails', async () => {
            mockListDao();
            app.submissionRequestDAO.countWithApplicant = jest.fn().mockRejectedValue(new Error('Count failed'));
            await expect(app.listSubmissionRequests({}, context)).rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED);
            await expect(app.listSubmissionRequests({}, context)).rejects.toThrow(/fetching submission request count/);
        });

        it('rejects with LIST_SUBMISSION_REQUESTS_FETCH_FAILED when a filter-option query fails', async () => {
            mockListDao();
            app.submissionRequestDAO.distinct = jest.fn().mockRejectedValue(new Error('Filter query failed'));
            await expect(app.listSubmissionRequests({}, context)).rejects.toThrow(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED);
        });

        describe('studyName filter (searches both studyName and studyAbbreviation)', () => {
            it('passes $or regex condition when studyName is provided', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                mockListDao();
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                await app.listSubmissionRequests({ studyName: 'UniqueName' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.$or).toBeDefined();
                expect(Array.isArray(filter.$or)).toBe(true);
                expect(filter.$or).toHaveLength(2);
                expect(filter.$or[0].studyName).toEqual(expect.any(RegExp));
                expect(filter.$or[0].studyName.source).toBe('UniqueName');
                expect(filter.$or[0].studyName.flags).toContain('i');
                expect(filter.$or[1].studyAbbreviation).toEqual(expect.any(RegExp));
                expect(filter.$or[1].studyAbbreviation.source).toBe('UniqueName');
            });

            it('returns submissionRequests matching study name when studyName filter is used', async () => {
                const matchingApp = { id: 'app1', studyName: 'Cancer Study', studyAbbreviation: 'CS', status: NEW, applicant: { fullName: 'Alice' } };
                const findManyMock = jest.fn().mockResolvedValue([matchingApp]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(1);
                const result = await app.listSubmissionRequests({ studyName: 'Cancer' }, context);
                expect(result.submissionRequests.length).toBe(1);
                expect(result.submissionRequests[0].studyName).toBe('Cancer Study');
                expect(result.total).toBe(1);
            });

            it('returns submissionRequests matching study abbreviation when studyName filter is used', async () => {
                const matchingApp = { id: 'app2', studyName: 'Other Study', studyAbbreviation: 'BRF', status: NEW, applicant: { fullName: 'Bob' } };
                const findManyMock = jest.fn().mockResolvedValue([matchingApp]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(1);
                const result = await app.listSubmissionRequests({ studyName: 'BRF' }, context);
                expect(result.submissionRequests.length).toBe(1);
                expect(result.submissionRequests[0].studyAbbreviation).toBe('BRF');
                expect(result.total).toBe(1);
            });

            it('studyName filter is case-insensitive', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
                await app.listSubmissionRequests({ studyName: 'aBc' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.$or[0].studyName).toEqual(expect.any(RegExp));
                expect(filter.$or[0].studyName.source).toBe('aBc');
                expect(filter.$or[1].studyAbbreviation.source).toBe('aBc');
            });

            it('escapes regex metacharacters in studyName search term', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
                await app.listSubmissionRequests({ studyName: '***' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.$or[0].studyName.source).toBe('\\*\\*\\*');
                expect(filter.$or[1].studyAbbreviation.source).toBe('\\*\\*\\*');
            });

            it('does not add study filter when studyName is All', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
                await app.listSubmissionRequests({ studyName: 'All' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.$or).toBeUndefined();
            });

            it('does not add study filter when studyName is empty string', async () => {
                const findManyMock = jest.fn().mockResolvedValue([]);
                app.submissionRequestDAO.findManyWithApplicant = findManyMock;
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(0);
                await app.listSubmissionRequests({ studyName: '' }, context);
                const filter = findManyMock.mock.calls[0][0];
                expect(filter.$or).toBeUndefined();
            });

            it('returns distinct studies and studyAbbreviations when studyName filter is applied', async () => {
                const apps = [
                    { id: 'app1', studyName: 'Study One', studyAbbreviation: 'S1', status: NEW, applicant: { fullName: 'A' } },
                    { id: 'app2', studyName: 'Study One', studyAbbreviation: 'S2', status: NEW, applicant: { fullName: 'B' } }
                ];
                let callIndex = 0;
                app.submissionRequestDAO.findManyWithApplicant = jest.fn().mockImplementation(() => {
                    callIndex++;
                    // First call: page results; second: study facet rows for in-memory distinct
                    return Promise.resolve(callIndex <= 2 ? apps : []);
                });
                app.submissionRequestDAO.countWithApplicant = jest.fn().mockResolvedValue(2);
                const result = await app.listSubmissionRequests({ studyName: 'Study' }, context);
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

    describe('approveSubmissionRequest', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue(null);
            mockApprovedStudiesService.findBySubmissionRequestID.mockResolvedValue(null);
            mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest.mockResolvedValue({ _id: 'study1' });
            mockApprovedStudiesService.updateReapprovedStudy.mockReset().mockResolvedValue({ _id: 'existing-study', applicationID: 'revision-app' });
        });

        it('throws error if duplicate approved study', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({ _id: 'app1', status: IN_REVIEW, studyName: 'study1' });
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'study1' }]);
            // Patch: Accept any error message containing "duplicate" (case-insensitive)
            await expect(app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context))
                .rejects.toThrow(/duplicate/i);
        });

        it('throws error if duplicate study exists without revision chain link', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
            });
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([
                { _id: 'study1', applicationID: 'unrelated-source' },
            ]);

            await expect(app.approveSubmissionRequest({ _id: 'revision-app', comment: 'Approved' }, context))
                .rejects.toThrow(/duplicate/i);
        });

        it('skips approved study create on revision re-approval, but updates the existing study', async () => {
            const mockApplication = {
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const existingStudy = { _id: 'existing-study', applicationID: 'source-app', createdAt: '2020-01-01' };
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findBySubmissionRequestID.mockResolvedValue(existingStudy);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'existing-study' }]);
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).not.toHaveBeenCalled();
            expect(app._findUsersByApplicantIDs).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.findByStudyName).toHaveBeenCalled();
            expect(mockApprovedStudiesService.updateReapprovedStudy).toHaveBeenCalledWith(
                existingStudy,
                expect.objectContaining({ _id: 'revision-app' }),
                expect.any(Object),
                undefined,
                undefined,
                undefined
            );
        });

        it('updates the existing study on revision re-approval even when already linked to the current submissionRequest', async () => {
            const mockApplication = {
                _id: 'revision-app',
                status: IN_REVIEW,
                studyName: 'study1',
                sequenceNumber: 2,
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            // submissionRequestID already points at the submissionRequest being (re)approved, but other fields
            // (e.g. dbGaPID, GPAName, controlledAccess) may still have changed and should be refreshed.
            const existingStudy = { _id: 'existing-study', applicationID: 'revision-app', createdAt: '2020-01-01' };
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findBySubmissionRequestID.mockResolvedValue(existingStudy);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'existing-study' }]);
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.updateReapprovedStudy).toHaveBeenCalledWith(
                existingStudy,
                expect.objectContaining({ _id: 'revision-app' }),
                expect.any(Object),
                undefined,
                undefined,
                undefined
            );
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findBySubmissionRequestID.mockResolvedValue(null);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([existingStudy]);
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.updateReapprovedStudy).toHaveBeenCalledWith(
                existingStudy,
                expect.objectContaining({ _id: 'revision-app' }),
                expect.any(Object),
                undefined,
                undefined,
                undefined
            );
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({ _id: 'source-app' });
            mockApprovedStudiesService.findBySubmissionRequestID.mockResolvedValue(existingStudy);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([{ _id: 'existing-study' }]);
            mockProgramService.getProgramByID.mockResolvedValue(null);
            mockProgramService.findOneByProgramName.mockResolvedValue({ _id: 'program1', name: 'Existing Program' });
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'revision-app', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).not.toHaveBeenCalled();
            expect(mockProgramService.upsertByProgramName).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.updateReapprovedStudy).toHaveBeenCalledWith(
                existingStudy,
                expect.objectContaining({ _id: 'revision-app' }),
                expect.any(Object),
                undefined,
                undefined,
                expect.any(Boolean)
            );
        });

        it('throws UPDATE_FAILED when DAO update returns falsy and does not call addNewInstitutions', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } })
            };
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('1.0');
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue(null);

            await expect(app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context))
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
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue({ program: { _id: 'program1' } });
            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

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
            mockProgramService.getProgramByID.mockResolvedValue(null);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            mockProgramService.upsertByProgramName.mockResolvedValue(mockNewProgram);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockProgramService.upsertByProgramName).toHaveBeenCalledWith(
                'Program One', 'PO', 'Program Description'
            );
            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: []
            };
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByID.mockResolvedValueOnce({
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            });

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Looks good',
                history: []
            };
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByID.mockResolvedValueOnce({
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            });

            await app.approveSubmissionRequest({
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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'GPA' })
            );
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved with conditions',
                history: []
            };
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByID.mockResolvedValueOnce({
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            });

            await app.approveSubmissionRequest({
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
                    study: 'study1',
                    contactEmail: mockEmailParams.conditionalSubmissionContact,
                    submissionGuideURL: mockEmailParams.submissionGuideURL
                }),
                false,
                true,
                false,
                true
            );
        });

        it('should pass pendingImageDeIdentification to saveApprovedStudyFromSubmissionRequest when provided', async () => {
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

            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockProgramService.getProgramByID.mockResolvedValue(null);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            mockProgramService.upsertByProgramName.mockResolvedValue(mockNewProgram);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveSubmissionRequest({
                _id: 'app1',
                comment: 'Approved',
                pendingImageDeIdentification: true
            }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
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

        it('returns conditional and pendingConditions on the approved submissionRequest when the study has pending image de-identification', async () => {
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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            const result = await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockProgramService.upsertByProgramName).not.toHaveBeenCalled();
            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
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

            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockProgramService.getProgramByID.mockResolvedValue(null);
            mockProgramService.findOneByProgramName.mockResolvedValue(mockDuplicateProgram);
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await expect(app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context))
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
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(mockDuplicateProgram);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
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

        it('does not treat missing GPA name as pending for controlled access approval', async () => {
            const reviewNotification = USER_PERMISSION_CONSTANTS.EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW;
            const mockQuestionnaire = {
                program: { _id: 'program1' },
                accessTypes: ['Controlled Access'],
                study: { dbGaPPPHSNumber: 'phs001234' }
            };
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
                questionnaireData: JSON.stringify(mockQuestionnaire)
            };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: []
            };

            mockApprovedStudiesService.findByStudyName
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{
                    controlledAccess: true,
                    isPendingGPA: false,
                    pendingModelChange: false,
                    pendingImageDeIdentification: false,
                    dbGaPID: 'phs001234'
                }]);
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: '' })
            );
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();
            mockUserService.getUsersByNotifications.mockResolvedValue([]);
            mockUserService.findByID.mockResolvedValueOnce({
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            });

            const result = await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
                expect.objectContaining({ GPAName: '' }),
                mockQuestionnaire,
                undefined,
                undefined,
                false,
                mockExistingProgram,
                null
            );
            expect(mockNotificationsService.pendingGPANotification).not.toHaveBeenCalled();
            expect(mockNotificationsService.approveQuestionNotification).toHaveBeenCalled();
            expect(result.pendingConditions).not.toContain(ERROR.PENDING_APPROVED_STUDY_NO_GPA_INFO);
        });

        it('persists default GPA name on approved study when approving controlled access SRF without GPA', async () => {
            const mockQuestionnaire = {
                program: { _id: 'program1' },
                accessTypes: ['Controlled Access'],
                study: { dbGaPPPHSNumber: 'phs001234' }
            };
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                studyAbbreviation: 'S1',
                programName: 'Program One',
                controlledAccess: true,
                openAccess: false,
                ORCID: '0000-0001',
                PI: 'PI Name',
                organization: { name: 'Org One' },
                questionnaireData: JSON.stringify(mockQuestionnaire)
            };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };
            const approvedFromDb = {
                ...mockApplication,
                status: APPROVED,
                reviewComment: 'Approved',
                history: []
            };

            mockApprovedStudiesService.findByStudyName
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{
                    controlledAccess: true,
                    isPendingGPA: false,
                    pendingModelChange: false,
                    pendingImageDeIdentification: false,
                    dbGaPID: 'phs001234'
                }]);
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: '' })
            );
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
                expect.objectContaining({ GPAName: '', controlledAccess: true }),
                mockQuestionnaire,
                undefined,
                undefined,
                false,
                mockExistingProgram,
                null
            );
        });

        it('keeps provided GPA name for controlled access approval', async () => {
            const mockQuestionnaire = {
                program: { _id: 'program1' },
                accessTypes: ['Controlled Access'],
                study: { dbGaPPPHSNumber: 'phs001234' }
            };
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                programName: 'Program One',
                questionnaireData: JSON.stringify(mockQuestionnaire)
            };
            const mockExistingProgram = { _id: 'program1', name: 'Program One' };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockProgramService.getProgramByID.mockResolvedValue(mockExistingProgram);
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload, GPAName: 'Actual GPA' })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([]);
            mockLogCollection.insert.mockResolvedValue();

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest).toHaveBeenCalledWith(
                expect.objectContaining({ GPAName: 'Actual GPA' }),
                mockQuestionnaire,
                undefined,
                undefined,
                false,
                mockExistingProgram,
                null
            );
        });
    });

    describe("_saveApprovedStudies", () => {
        it.each([
            ["phs001234", "phs001234"],
            ["phs001234.v5", "phs001234"],
            ["phs001234.p3", "phs001234"],
            ["phs001234.v5.p2", "phs001234"],
            ["phs001234.v5.p2 ", "phs001234"],
        ])(
            "should store only the base phs prefix and 6 digits when dbGaPPPHSNumber is %s",
            async (phsInput, expectedBase) => {
                const aSubmissionRequest = {
                    _id: 'app1',
                    studyName: 'Study One',
                    studyAbbreviation: 'STUDY1',
                    organization: { name: 'Org One' },
                    controlledAccess: true,
                    ORCID: '0000-0001',
                    PI: 'PI Name',
                    openAccess: false,
                    programName: 'Program One',
                };
                const questionnaire = {
                    study: { name: 'Study One Name', dbGaPPPHSNumber: phsInput },
                };
                mockApprovedStudiesService.storeApprovedStudies.mockResolvedValue({ _id: 'approvedStudy1' });

                await app._saveApprovedStudies(aSubmissionRequest, questionnaire, false, undefined, false, null);

                expect(mockApprovedStudiesService.storeApprovedStudies).toHaveBeenCalled();
                const args = mockApprovedStudiesService.storeApprovedStudies.mock.calls[0];
                expect(args[3]).toBe(expectedBase);
            }
        );

        it.each([
            ['', null],
            [' ', null],
            ['phs', null],
            ['phs1234', null],
            ['phs00123', null],
            ['001234', null],
            ['phs-001234', null],
            ['abc', null],
            ['.v5', null],
        ])(
            "should default to null when it doesn't start with phs prefix and 6 digits: %s",
            async (phsInput) => {
                const aSubmissionRequest = {
                    _id: 'app1',
                    studyName: 'Study One',
                    studyAbbreviation: 'STUDY1',
                    organization: { name: 'Org One' },
                    controlledAccess: true,
                    ORCID: '0000-0001',
                    PI: 'PI Name',
                    openAccess: false,
                    programName: 'Program One',
                };
                const questionnaire = {
                    study: { name: 'Study One Name', dbGaPPPHSNumber: phsInput },
                };
                mockApprovedStudiesService.storeApprovedStudies.mockResolvedValue({ _id: 'approvedStudy1' });

                await app._saveApprovedStudies(aSubmissionRequest, questionnaire, false, undefined, false, null);

                expect(mockApprovedStudiesService.storeApprovedStudies).toHaveBeenCalled();
                const args = mockApprovedStudiesService.storeApprovedStudies.mock.calls[0];
                expect(args[3]).toBeNull();
            }
        );

        it('should throw and not update user studies when approved study creation returns no id', async () => {
            const mockApplication = {
                _id: 'app1',
                status: IN_REVIEW,
                studyName: 'study1',
                questionnaireData: JSON.stringify({ program: { _id: 'program1' } }),
            };
            const mockQuestionnaire = { program: { _id: 'program1' } };

            mockApprovedStudiesService.findByStudyName.mockResolvedValue([]);
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(mockApplication);
            mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest.mockResolvedValue(null);
            app._findUsersByApplicantIDs = jest.fn().mockResolvedValue([{
                _id: 'user1',
                userStatus: 'active',
                role: 'user',
                studies: [{ _id: 'existing-study' }],
            }]);
            mockLogCollection.insert.mockResolvedValue();
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await expect(app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context))
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
            mockProgramService.getProgramByID.mockResolvedValue({ _id: 'program1' });
            mockProgramService.findOneByProgramName.mockResolvedValue(null);
            app.submissionRequestDAO.update = jest.fn().mockImplementation((payload) =>
                Promise.resolve({ ...mockApplication, ...payload })
            );
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(mockApplication)
                .mockResolvedValueOnce(approvedFromDb);
            mockApprovedStudiesService.saveApprovedStudyFromSubmissionRequest.mockResolvedValue({ _id: 'new-study-id' });
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
            mockUserService.findByID.mockResolvedValue(null);
            global.getSubmissionRequestQuestionnaire = jest.fn().mockReturnValue(mockQuestionnaire);

            await app.approveSubmissionRequest({ _id: 'app1', comment: 'Approved' }, context);

            expect(mockUserService.updateUserInfo).toHaveBeenCalledWith(
                expect.objectContaining({ _id: 'user1' }),
                expect.anything(),
                'user1',
                'active',
                'user',
                ['new-study-id', 'existing-study']
            );
        });

        it.each([
            [undefined],
            [null],
            [''],
            ['   '],
        ])('defaults blank controlled-access GPA name to Not Provided when saving approved study (GPAName: %p)', async (GPAName) => {
            const aSubmissionRequest = {
                _id: 'app1',
                studyName: 'Study One',
                studyAbbreviation: 'STUDY1',
                organization: { name: 'Org One' },
                controlledAccess: true,
                ORCID: '0000-0001',
                PI: 'PI Name',
                openAccess: false,
                programName: 'Program One',
                GPAName,
            };
            const questionnaire = {
                study: { name: 'Study One Name', dbGaPPPHSNumber: 'phs001234' },
            };
            mockApprovedStudiesService.storeApprovedStudies.mockResolvedValue({ _id: 'approvedStudy1' });

            await app._saveApprovedStudies(aSubmissionRequest, questionnaire, false, undefined, false, null);

            const pendingGPA = mockApprovedStudiesService.storeApprovedStudies.mock.calls[0][12];
            expect(pendingGPA).toEqual({
                GPAName: DEFAULT_GPA_NAME,
                isPendingGPA: false,
            });
        });

        it('passes provided GPA name unchanged for controlled-access approved study', async () => {
            const aSubmissionRequest = {
                _id: 'app1',
                studyName: 'Study One',
                studyAbbreviation: 'STUDY1',
                organization: { name: 'Org One' },
                controlledAccess: true,
                ORCID: '0000-0001',
                PI: 'PI Name',
                openAccess: false,
                programName: 'Program One',
                GPAName: '  Actual GPA  ',
            };
            const questionnaire = {
                study: { name: 'Study One Name', dbGaPPPHSNumber: 'phs001234' },
            };
            mockApprovedStudiesService.storeApprovedStudies.mockResolvedValue({ _id: 'approvedStudy1' });

            await app._saveApprovedStudies(aSubmissionRequest, questionnaire, false, undefined, false, null);

            const pendingGPA = mockApprovedStudiesService.storeApprovedStudies.mock.calls[0][12];
            expect(pendingGPA).toEqual({
                GPAName: 'Actual GPA',
                isPendingGPA: false,
            });
        });

        it('does not default GPA name for non-controlled-access approved study', async () => {
            const aSubmissionRequest = {
                _id: 'app1',
                studyName: 'Study One',
                studyAbbreviation: 'STUDY1',
                organization: { name: 'Org One' },
                controlledAccess: false,
                ORCID: '0000-0001',
                PI: 'PI Name',
                openAccess: true,
                programName: 'Program One',
                GPAName: '',
            };
            const questionnaire = {
                study: { name: 'Study One Name', dbGaPPPHSNumber: 'phs001234' },
            };
            mockApprovedStudiesService.storeApprovedStudies.mockResolvedValue({ _id: 'approvedStudy1' });

            await app._saveApprovedStudies(aSubmissionRequest, questionnaire, false, undefined, false, null);

            const pendingGPA = mockApprovedStudiesService.storeApprovedStudies.mock.calls[0][12];
            expect(pendingGPA).toEqual({
                GPAName: '',
                isPendingGPA: false,
            });
        });
    });

    describe('inquireSubmissionRequest', () => {
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
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('1.0');
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue({ acknowledged: true });
            mockUserService.getUsersByNotifications = jest.fn().mockResolvedValue([]);
            mockUserService.findByID = jest.fn().mockResolvedValue({
                _id: 'user-applicant-1',
                email: 'submitter@test.com',
                notifications: [reviewNotification]
            });
            mockNotificationsService.inquireQuestionNotification = jest.fn().mockResolvedValue();
        });

        it('passes studyName and studyAbbreviation as NA when whitespace-only, null, or empty', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(makeApplication({
                studyName: '   ',
                studyAbbreviation: null
            }));
            await app.inquireSubmissionRequest({ _id: 'app1', comment: 'Please clarify' }, context);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(makeApplication({
                studyName: '  My Full Study  ',
                studyAbbreviation: '  ABBR  '
            }));
            await app.inquireSubmissionRequest({ _id: 'app1', comment: 'Need details' }, context);
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

        it('uses NA for study fields when the submissionRequest object omits them', async () => {
            const withoutStudy = makeApplication();
            delete withoutStudy.studyName;
            delete withoutStudy.studyAbbreviation;
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(withoutStudy);
            await app.inquireSubmissionRequest({ _id: 'app1', comment: 'R' }, context);
            expect(mockNotificationsService.inquireQuestionNotification).toHaveBeenCalledWith(
                'submitter@test.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({ studyName: 'NA', studyAbbreviation: 'NA' }),
                {}
            );
        });

        it('preserves submissionRequest version 3.0 when inquiring', async () => {
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            app._getSubmissionRequestVersionByStatus = SubmissionRequest.prototype._getSubmissionRequestVersionByStatus.bind(app);
            const submissionRequest = makeApplication({ status: IN_REVIEW, version: '3.0' });
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(submissionRequest)
                .mockResolvedValueOnce({ ...submissionRequest, status: INQUIRED, version: '3.0' });

            await app.inquireSubmissionRequest({ _id: 'app1', comment: 'Please clarify' }, context);

            expect(app.submissionRequestDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ version: '3.0' })
            );
        });
    });

    describe('submitSubmissionRequest', () => {
        function makeApplication(overrides = {}) {
            return {
                _id: 'app1',
                status: IN_PROGRESS,
                studyName: 'Test Study',
                studyAbbreviation: 'TS',
                programName: 'CDS',
                PI: 'Dr. Jane Smith',
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
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue({ acknowledged: true });
            mockUserService.findByID = jest.fn().mockResolvedValue(null);
            mockUserService.getUsersByNotifications = jest.fn()
                .mockResolvedValueOnce([{ email: 'federal@test.com' }])
                .mockResolvedValueOnce([{ email: 'federal@test.com' }, { email: 'admin@test.com' }]);
            mockNotificationsService.submitQuestionNotification = jest.fn().mockResolvedValue();
        });

        it('passes pi from submissionRequest.PI to submitQuestionNotification, not the submitter name', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(makeApplication());
            await app.submitSubmissionRequest({ _id: 'app1' }, context);

            expect(mockNotificationsService.submitQuestionNotification).toHaveBeenCalledWith(
                ['federal@test.com'],
                [],
                ['admin@test.com'],
                expect.objectContaining({
                    pi: 'Dr. Jane Smith, and associated with the CDS program.',
                    study: 'Test Study',
                    url: 'http://test'
                })
            );
            const { pi } = mockNotificationsService.submitQuestionNotification.mock.calls[0][3];
            expect(pi).not.toContain('John Doe');
        });

        it('appends a period to pi when programName is missing', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(makeApplication({ programName: undefined }));
            await app.submitSubmissionRequest({ _id: 'app1' }, context);

            expect(mockNotificationsService.submitQuestionNotification).toHaveBeenCalledWith(
                expect.any(Array),
                [],
                expect.any(Array),
                expect.objectContaining({
                    pi: 'Dr. Jane Smith.'
                })
            );
        });

        it('uses NA for pi when submissionRequest.PI is blank', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(makeApplication({ PI: '   ' }));
            await app.submitSubmissionRequest({ _id: 'app1' }, context);

            expect(mockNotificationsService.submitQuestionNotification).toHaveBeenCalledWith(
                expect.any(Array),
                [],
                expect.any(Array),
                expect.objectContaining({
                    pi: 'NA, and associated with the CDS program.'
                })
            );
        });
    });

    describe('submitSubmissionRequest', () => {
        it('returns reloaded submissionRequest after update', async () => {
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
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(inProgressApp)
                .mockResolvedValueOnce(submittedApp);
            app.submissionRequestDAO = { update: jest.fn().mockResolvedValue(true) };
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.submitSubmissionRequest({ _id: 'app1' }, context);

            expect(app.getSubmissionRequestById).toHaveBeenCalledTimes(2);
            expect(app.getSubmissionRequestById).toHaveBeenLastCalledWith('app1');
            expect(result).toBe(submittedApp);
            expect(result.status).toBe(SUBMITTED);
            expect(result.canBeReopened).toBe(false);
        });
    });

    describe('resumeInquiredSubmissionRequest', () => {
        it('transitions owner submissionRequest to In Revision', async () => {
            const submissionRequest = {
                _id: 'app1',
                status: INQUIRED,
                version: '2.0',
                history: [{ status: INQUIRED, reviewComment: 'fix this' }],
                applicant: { applicantID: 'user1' }
            };
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce(submissionRequest)
                .mockResolvedValueOnce({ ...submissionRequest, status: IN_REVISION });
            app.submissionRequestDAO = { update: jest.fn().mockResolvedValue(true) };
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.resumeInquiredSubmissionRequest({ _id: 'app1' }, context);

            expect(result.status).toBe(IN_REVISION);
            expect(app.submissionRequestDAO.update).toHaveBeenCalledWith(expect.objectContaining({
                _id: 'app1',
                status: IN_REVISION
            }));
        });

        it('rejects when submissionRequest is already In Revision', async () => {
            const submissionRequest = {
                _id: 'app1',
                status: IN_REVISION,
                version: '2.0',
                history: [{ status: IN_REVISION, reviewComment: 'already in revision' }],
                applicant: { applicantID: 'user1' }
            };

            app.getSubmissionRequestById = jest.fn().mockResolvedValueOnce(submissionRequest);
            await expect(app.resumeInquiredSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it('rejects invalid starting statuses such as Submitted', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: SUBMITTED,
                applicant: { applicantID: 'user1' }
            });

            await expect(app.resumeInquiredSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it('rejects non-owner', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: INQUIRED,
                applicant: { applicantID: 'other-user' }
            });

            await expect(app.resumeInquiredSubmissionRequest({ _id: 'app1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });
    });

    describe('reopenSubmissionRequest', () => {
        it('delegates to resumeInquiredSubmissionRequest', async () => {
            const spy = jest.spyOn(app, 'resumeInquiredSubmissionRequest').mockResolvedValue({ _id: 'app1', status: IN_PROGRESS });
            await app.reopenSubmissionRequest({ _id: 'app1' }, context);
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
            app.submissionRequestDAO = {
                findSubmissionRequestStatusByID: jest.fn(),
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
            const reopenedDoc = {
                _id: 'new-revision-id',
                status: REOPENED,
                sequenceNumber: 2,
                submittedDate: null,
                version: '3.0',
            };
            app.submissionRequestDAO.reopenApprovedRevision.mockResolvedValue(reopenedDoc);

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.submissionRequestDAO.reopenApprovedRevision).toHaveBeenCalledWith(
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
            expect(app.getSubmissionRequestById).toHaveBeenCalledTimes(1);
        });

        it('populates applicantName from firstName and lastName when fullName is missing', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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

            expect(app.submissionRequestDAO.reopenApprovedRevision).toHaveBeenCalledWith(
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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

            expect(app.submissionRequestDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ applicantID: 'user1' }),
                false
            );
            expect(result.applicant.applicantID).toBe('user1');
        });

        it('rejects original owner without submission_request:create', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                ...approvedSource,
                applicant: undefined,
                applicantID: undefined,
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED);

            expect(console.warn).toHaveBeenCalledWith(
                'Reopen owner resolution failed:',
                { submissionRequestID: 'approved-1' },
                ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED
            );
        });

        it('rejects when original owner is inactive and ownerId is not provided', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
            app.submissionRequestDAO = {
                reopenApprovedRevision: jest.fn().mockRejectedValue(
                    new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST)
                ),
            };

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it('rejects when an active successor exists', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                ...approvedSource,
                nextRevisionId: 'existing-successor',
            });
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn().mockResolvedValue({ status: REOPENED });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);

            expect(app.submissionRequestDAO.reopenApprovedRevision).not.toHaveBeenCalled();
        });

        it('allows reopen over a terminal successor and replaces the existing link', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                ...approvedSource,
                nextRevisionId: 'canceled-successor',
            });
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn().mockResolvedValue({ status: CANCELED });
            app.submissionRequestDAO.reopenApprovedRevision.mockResolvedValue({
                _id: 'new-revision-id',
                status: REOPENED,
                sequenceNumber: 2,
                version: '3.0',
            });

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.submissionRequestDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ status: REOPENED, sequenceNumber: 2 }),
                true
            );
            expect(result.status).toBe(REOPENED);
        });

        it('rejects when status is not Approved', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                ...approvedSource,
                status: IN_PROGRESS
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        });

        it('rejects without reopen scope', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'none', scopeValues: [] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('allows own-scope source owner to reopen without reassignment', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
            app.submissionRequestDAO = {
                findSubmissionRequestStatusByID: jest.fn(),
                reopenApprovedRevision: jest.fn().mockImplementation((_sourceId, doc) =>
                    Promise.resolve({ ...doc, version: '3.0' })
                ),
            };
            mockLogCollection.insert.mockResolvedValue();

            const result = await app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context);

            expect(app.submissionRequestDAO.reopenApprovedRevision).toHaveBeenCalledWith(
                'approved-1',
                expect.objectContaining({ applicantID: 'user1', status: REOPENED }),
                false
            );
            expect(result.applicant.applicantID).toBe('user1');
        });

        it('rejects own-scope caller who is not the source owner', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                ...approvedSource,
                applicant: { applicantID: 'other-user' },
            });

            await expect(app.reopenApprovedSubmissionRequest({ _id: 'approved-1' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('rejects own-scope owner attempting to reassign ownerId', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            UserScope.create.mockImplementation((scopes) => new (require('../../domain/user-scope').UserScope)(scopes));
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);

            await expect(app.reopenApprovedSubmissionRequest(
                { _id: 'approved-1', ownerId: 'new-owner' },
                context
            )).rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
        });

        it('rejects all-scope reassignment to ineligible owner role', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue(approvedSource);
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

    describe('_sendReopenSubmissionRequestEmail', () => {
        const reopenedSubmissionRequest = {
            _id: 'reopen-app-1',
            status: REOPENED,
            studyName: 'Test Study',
            studyAbbreviation: 'TS',
            programName: 'Test Program',
            programAbbreviation: 'TP',
            questionnaireData: JSON.stringify({ primaryContact: { email: 'pc@test.com' }, pi: { email: 'pi@test.com' } }),
        };

        const ownerUser = {
            _id: 'owner-1',
            id: 'owner-1',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            notifications: ['submission_request:reopened'],
        };

        beforeEach(() => {
            mockUserService.findByID.mockResolvedValue(ownerUser);
            mockUserService.getUsersByNotifications.mockResolvedValue([
                { _id: 'bcc-user', email: 'bcc@example.com' }
            ]);
            mockNotificationsService.reopenSubmissionRequestNotification.mockResolvedValue();
        });

        it('sends reopen notification email to the owner', async () => {
            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                'jane@example.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    firstName: 'Jane Doe',
                    isOwnershipChanged: false,
                }),
                expect.objectContaining({
                    studyName: 'Test Study',
                    studyAbbreviation: 'TS',
                    programName: 'Test Program',
                    programAbbreviation: 'TP',
                    contactEmail: `${mockEmailParams.conditionalSubmissionContact}.`,
                })
            );
        });

        it('sets isOwnershipChanged to true when owner differs from previous owner', async () => {
            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'previous-owner-id');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                'jane@example.com',
                expect.any(Array),
                expect.any(Array),
                expect.objectContaining({
                    isOwnershipChanged: true,
                }),
                expect.any(Object)
            );
        });

        it('includes previous owner in CC when ownership changed', async () => {
            const previousOwner = { _id: 'prev-owner', email: 'prev@example.com' };
            mockUserService.findByID
                .mockResolvedValueOnce(ownerUser)
                .mockResolvedValueOnce(previousOwner);

            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'prev-owner');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                'jane@example.com',
                expect.arrayContaining(['prev@example.com']),
                expect.any(Array),
                expect.objectContaining({ isOwnershipChanged: true }),
                expect.any(Object)
            );
        });

        it('does not include previous owner in CC when their email matches the new owner', async () => {
            const previousOwner = { _id: 'prev-owner', email: 'jane@example.com' };
            mockUserService.findByID
                .mockResolvedValueOnce(ownerUser)
                .mockResolvedValueOnce(previousOwner);

            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'prev-owner');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                'jane@example.com',
                expect.not.arrayContaining(['jane@example.com']),
                expect.any(Array),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('returns early without sending email when applicant has no email', async () => {
            mockUserService.findByID.mockResolvedValue({ ...ownerUser, email: null });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, { ...ownerUser, email: null }, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('returns early when applicant notifications do not include REQUEST_REOPENED', async () => {
            const ownerWithoutNotification = { ...ownerUser, notifications: ['other_notification'] };
            mockUserService.findByID.mockResolvedValue(ownerWithoutNotification);

            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerWithoutNotification, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).not.toHaveBeenCalled();
        });

        it('uses "NA" for missing studyName via studyLabelForEmailBody', async () => {
            const appNoStudy = { ...reopenedSubmissionRequest, studyName: null };

            await app._sendReopenSubmissionRequestEmail(appNoStudy, ownerUser, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                expect.any(Array),
                expect.any(Object),
                expect.objectContaining({
                    studyName: 'NA',
                })
            );
        });

        it('uses "NA" for missing studyAbbreviation', async () => {
            const appNoAbbrev = { ...reopenedSubmissionRequest, studyAbbreviation: null };

            await app._sendReopenSubmissionRequestEmail(appNoAbbrev, ownerUser, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                expect.any(Array),
                expect.any(Object),
                expect.objectContaining({
                    studyAbbreviation: 'NA',
                })
            );
        });

        it('does not throw when notification service rejects', async () => {
            mockNotificationsService.reopenSubmissionRequestNotification.mockRejectedValue(new Error('SMTP failure'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await expect(app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'owner-1'))
                .resolves.toBeUndefined();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to send reopen submissionRequest notification email'),
                'SMTP failure'
            );
            consoleSpy.mockRestore();
        });

        it('filters BCC emails to exclude CC and applicant emails', async () => {
            mockUserService.getUsersByNotifications.mockResolvedValue([
                { _id: 'bcc1', email: 'bcc1@example.com' },
                { _id: 'bcc2', email: 'jane@example.com' },
            ]);

            await app._sendReopenSubmissionRequestEmail(reopenedSubmissionRequest, ownerUser, 'owner-1');

            expect(mockNotificationsService.reopenSubmissionRequestNotification).toHaveBeenCalledWith(
                'jane@example.com',
                expect.any(Array),
                expect.not.arrayContaining(['jane@example.com']),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });

    describe('saveSubmissionRequest from Reopened', () => {
        it('transitions Reopened to In Progress on save', async () => {
            userScopeMock.isNoneScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            jest.spyOn(app, 'getSubmissionRequestById').mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                applicant: { applicantID: 'user1' },
                history: []
            });
            jest.spyOn(app, '_updateSubmissionRequest').mockResolvedValue({ _id: 'app-reopened', status: IN_PROGRESS });
            mockConfigurationService.findByType.mockResolvedValue({ current: '2.0', new: '3.0' });

            const params = { application: { _id: 'app-reopened', studyName: 'Updated' }, status: IN_PROGRESS };
            await app.saveSubmissionRequest(params, context);

            expect(app._updateSubmissionRequest).toHaveBeenCalledWith(
                expect.objectContaining({ status: IN_PROGRESS }),
                REOPENED,
                'user1'
            );
        });
    });

    describe('rejectSubmissionRequest', () => {
        beforeEach(() => {
            app.verifyReviewerPermission = jest.fn().mockResolvedValue();
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('2.0');
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue(true);
            app.submissionRequestDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });
            app.getSubmissionRequestById = jest.fn()
                .mockResolvedValueOnce({ _id: 'app1', status: SUBMITTED, history: [], version: '2.0' })
                .mockResolvedValueOnce({ _id: 'app1', status: REJECTED, history: [], version: '2.0' });
        });

        it('does not prune revision chain after rejecting submissionRequest', async () => {
            await app.rejectSubmissionRequest({ _id: 'app1', comment: 'rejected' }, context);

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('cancelSubmissionRequest', () => {
        beforeEach(() => {
            app._sendCancelSubmissionRequestEmail = jest.fn().mockResolvedValue();
            app._getSubmissionRequestVersionByStatus = jest.fn().mockResolvedValue('3.0');
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue({ _id: 'app-reopened' });
            app.submissionRequestDAO.clearNextRevisionIdPointingTo = jest.fn().mockResolvedValue({ modifiedCount: 1 });
            app.getSubmissionRequestById = jest.fn().mockImplementation(async (id) => ({
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
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user2' },
                history: [],
            });

            await app.cancelSubmissionRequest({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.submissionRequestDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: CANCELED })
            );
        });

        it('cancels Reopened SRF as assigned owner', async () => {
            userScopeMock.isAllScope.mockReturnValue(false);
            userScopeMock.isOwnScope.mockReturnValue(true);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user1' },
                history: [],
            });

            await app.cancelSubmissionRequest({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.submissionRequestDAO.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: CANCELED })
            );
        });

        it('does not prune revision chain when canceling to Canceled status', async () => {
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app-reopened',
                status: REOPENED,
                studyName: 'Study',
                applicant: { applicantID: 'user2' },
                history: [],
            });

            await app.cancelSubmissionRequest({ _id: 'app-reopened', comment: 'cancel' }, context);

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });

        it('does not prune revision chain after deleting empty submissionRequest', async () => {
            const callOrder = [];
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getSubmissionRequestById = jest.fn()
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
            app.submissionRequestDAO.clearNextRevisionIdPointingTo = jest.fn().mockImplementation(async () => {
                callOrder.push('prune');
                return { modifiedCount: 0 };
            });
            app.submissionRequestDAO.delete = jest.fn().mockImplementation(async () => {
                callOrder.push('delete');
                return true;
            });

            await app.cancelSubmissionRequest({ _id: 'empty-app', comment: 'cancel' }, context);

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
            expect(callOrder).toEqual(['delete']);
        });

        it('does not prune revision chain when empty submissionRequest delete fails', async () => {
            userScopeMock.isAllScope.mockReturnValue(true);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'empty-app',
                status: NEW,
                applicant: { applicantID: 'user1' },
                history: [],
            });
            app.submissionRequestDAO.delete = jest.fn().mockResolvedValue(null);

            await expect(app.cancelSubmissionRequest({ _id: 'empty-app', comment: 'cancel' }, context))
                .rejects.toThrow(ERROR.FAILED_DELETE_SUBMISSION_REQUEST);

            expect(app.submissionRequestDAO.clearNextRevisionIdPointingTo).not.toHaveBeenCalled();
        });
    });

    describe('restoreSubmissionRequest', () => {
        beforeEach(() => {
            app._sendRestoreSubmissionRequestEmail = jest.fn().mockResolvedValue();
            userScopeMock.isAllScope.mockReturnValue(true);
            userScopeMock.isOwnScope.mockReturnValue(false);
        });

        it('throws when history is too short', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app1',
                status: CANCELED,
                applicant: { applicantID: 'user1' },
                history: [{ status: CANCELED }],
            });

            await expect(app.restoreSubmissionRequest({ _id: 'app1', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.INVALID_SUBMISSION_REQUEST_RESTORE_STATE);
        });

        it('throws when a newer revision blocks restore', async () => {
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app2',
                status: CANCELED,
                sequenceNumber: 2,
                applicant: { applicantID: 'user1' },
                history: [{ status: REOPENED }, { status: CANCELED }],
            });
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue(null);

            await expect(app.restoreSubmissionRequest({ _id: 'app2', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.INVALID_SUBMISSION_REQUEST_RESTORE_NEWER_REVISION_EXISTS);
        });

        it('throws permission error before revision-chain check for unauthorized caller', async () => {
            mockAuthorizationService.getPermissionScope.mockResolvedValue([{ scope: 'own', scopeValues: ['user1'] }]);
            app.getSubmissionRequestById = jest.fn().mockResolvedValue({
                _id: 'app2',
                status: CANCELED,
                sequenceNumber: 2,
                applicant: { applicantID: 'other-user' },
                history: [{ status: REOPENED }, { status: CANCELED }],
            });
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn();

            await expect(app.restoreSubmissionRequest({ _id: 'app2', comment: 'restore' }, context))
                .rejects.toThrow(ERROR.VERIFY.INVALID_PERMISSION);
            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).not.toHaveBeenCalled();
        });

        it('restores canceled Reopened SRF back to Reopened', async () => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn().mockResolvedValue({
                _id: 'approved-parent',
                status: APPROVED,
                nextRevisionId: 'app-reopened',
            });
            app.getSubmissionRequestById = jest.fn()
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
            app.submissionRequestDAO.update = jest.fn().mockResolvedValue({ _id: 'app-reopened' });

            await app.restoreSubmissionRequest({ _id: 'app-reopened', comment: 'restore' }, context);

            expect(app.submissionRequestDAO.findApprovedParentSubmissionRequestByID).toHaveBeenCalledWith('app-reopened');
            expect(app.submissionRequestDAO.update).toHaveBeenCalledWith(
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

    describe('_reformatRecordForSubmissionRequestResponse', () => {
        beforeEach(() => {
            app.submissionRequestDAO.findSubmissionRequestStatusByID = jest.fn();
        });

        it('uses applicantName from nested applicant when fullName and name parts are missing', async () => {
            const result = await app._reformatRecordForSubmissionRequestResponse({
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
            const result = await app._reformatRecordForSubmissionRequestResponse({
                id: 'app-1',
                status: APPROVED,
                nextRevisionId: null,
            });

            expect(result.canBeReopened).toBe(true);
            expect(result.canBeRestored).toBe(false);
        });

        it('sets canBeRestored true when record is Canceled sequence 1 with valid history', async () => {
            app.submissionRequestDAO.findApprovedParentSubmissionRequestByID = jest.fn();
            const result = await app._reformatRecordForSubmissionRequestResponse({
                id: 'app-1',
                status: CANCELED,
                sequenceNumber: 1,
                history: [{ status: IN_PROGRESS }, { status: CANCELED }],
            });

            expect(result.canBeRestored).toBe(true);
            expect(result.canBeReopened).toBe(false);
        });

        it('prefers ownerUser fullName over nested applicant applicantName', async () => {
            const result = await app._reformatRecordForSubmissionRequestResponse(
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
