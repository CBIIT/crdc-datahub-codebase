const {SUBMITTED, APPROVED, REJECTED, IN_PROGRESS, IN_REVIEW, DELETED, CANCELED, NEW, INQUIRED, IN_REVISION, REOPENED} = require("../constants/submission-request-constants");
const {STUDY_ABBREVIATION_MAX_LENGTH} = require("../crdc-datahub-database-drivers/constants/approved-study-constants");
const {v4} = require('uuid')
const {getCurrentTime, subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {HistoryEventBuilder} = require("../domain/history-event");
const {verifySubmissionRequest} = require("../verifier/submission-request-verifier");
const {verifySession} = require("../verifier/user-info-verifier");
const ERROR = require("../constants/error-constants");
const USER_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-constants");
const {CreateApplicationEvent, UpdateApplicationStateEvent} = require("../crdc-datahub-database-drivers/domain/log-events");
const ROLES = USER_CONSTANTS.USER.ROLES;
const {parseJsonString, isTrue} = require("../crdc-datahub-database-drivers/utility/string-utility");
const {isUndefined, replaceErrorString, escapeRegexLiteral} = require("../utility/string-util");
const {defaultStudyAbbreviationToStudyName, defaultStudyAbbreviationToNA} = require("../utility/study-abbrev-helpers");
const {EMAIL_NOTIFICATIONS} = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const {UserScope} = require("../domain/user-scope");
const {UtilityService} = require("../services/utility");
const InstitutionDAO = require("../dao/institution");
const SubmissionRequestDAO = require("../dao/submission-request");
const UserDAO = require("../dao/user");
const {formatName} = require("../utility/format-name");
const {PendingGPA} = require("../domain/pending-gpa");
const {
    REOPEN_ASSIGNABLE_ROLES,
    hasSubmissionRequestCreatePermission,
} = require("../utility/reopen-owner-utility");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INSTITUTION_NAME_LENGTH = 100;
// Valid orderBy values for listSubmissionRequests. "applicant.applicantName" is accepted and mapped to "applicant.fullName".
const VALID_ORDER_BY_LIST_SUBMISSION_REQUESTS = [
    "applicant.applicantName",
    "applicant.fullName",
    "programName",
    "studyName",
    "studyAbbreviation",
    "status",
    "version",
    "createdAt",
    "updatedAt",
    "submittedDate"
];
const TERMINAL_REVISION_STATUSES = Object.freeze([REJECTED, CANCELED, DELETED]);

class SubmissionRequest {
    _DELETE_REVIEW_COMMENT="This Submission Request has been deleted by the system due to inactivity.";
    _ALL_FILTER="All";
    _FINAL_INACTIVE_REMINDER = "finalInactiveReminder";
    _INACTIVE_REMINDER = "inactiveReminder";
    _CRDC_TEAM = "the CRDC team";
    constructor(logCollection, submissionRequestCollection, approvedStudiesService, userService, dbService, notificationsService, emailParams, programService, institutionService, configurationService, authorizationService) {
        this.logCollection = logCollection;
        this.approvedStudiesService = approvedStudiesService;
        this.userService = userService;
        this.notificationService = notificationsService;
        this.emailParams = emailParams;
        this.programService = programService;
        this.institutionService = institutionService;
        this.configurationService = configurationService;
        this.authorizationService = authorizationService;
        this.institionDAO = new InstitutionDAO()
        this.submissionRequestDAO = new SubmissionRequestDAO();
        this.userDAO = new UserDAO();
        this._VALID_LIST_SUBMISSION_REQUEST_STATUSES = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, APPROVED, INQUIRED, IN_REVISION, REOPENED, REJECTED, CANCELED, DELETED, this._ALL_FILTER];
    }

    _normalizeSubmissionRequestStatus(status) {
        return String(status ?? "").trim().toLowerCase();
    }

    _isApprovedSubmissionRequest(submissionRequest) {
        return this._normalizeSubmissionRequestStatus(submissionRequest?.status) === this._normalizeSubmissionRequestStatus(APPROVED);
    }

    _isTerminalRevisionStatus(status) {
        const normalized = this._normalizeSubmissionRequestStatus(status);
        return TERMINAL_REVISION_STATUSES.some(
            (terminalStatus) => this._normalizeSubmissionRequestStatus(terminalStatus) === normalized
        );
    }

    /**
     * Loads status for the immediate revision successor (minimal DB read).
     * @param {string} revisionID Successor submissionRequest _id
     * @returns {Promise<{ status: string }|null>}
     */
    async _loadRevisionChainSuccessor(revisionID) {
        try {
            return await this.submissionRequestDAO.findSubmissionRequestStatusByID(revisionID);
        } catch (err) {
            console.error('Failed to load revision successor while checking active later revisions:', revisionID, err);
            throw new Error(ERROR.INTERNAL_ERROR);
        }
    }

    /**
     * Returns true when the immediate revision successor has a non-terminal status.
     * @param {object} submissionRequest submission request document that may have nextRevisionId
     * @param {string|undefined|null} successorStatus Status of the direct successor, when known
     * @returns {boolean}
     */
    _hasSuccessorWithNonTerminalStatus(submissionRequest, successorStatus) {
        const nextRevisionID = submissionRequest?.nextRevisionId;
        if (!nextRevisionID) {
            return false;
        }
        if (successorStatus == null) {
            return false;
        }
        return !this._isTerminalRevisionStatus(successorStatus);
    }

    /**
     * Loads the successor and delegates to _hasSuccessorWithNonTerminalStatus.
     * Valid chains are Approved → tail; only the direct successor is checked.
     * @param {object} submissionRequest submission request document that may have nextRevisionId
     * @returns {Promise<boolean>}
     */
    async _hasActiveLaterRevisions(submissionRequest) {
        const nextRevisionID = submissionRequest?.nextRevisionId;
        if (!nextRevisionID) {
            return false;
        }
        const successor = await this._loadRevisionChainSuccessor(nextRevisionID);
        return this._hasSuccessorWithNonTerminalStatus(submissionRequest, successor?.status);
    }

    /**
     * True when an Approved parent SRF links to this submissionRequest via nextRevisionId.
     * @param {object} submissionRequest Candidate submissionRequest
     * @returns {Promise<boolean>}
     */
    async _hasApprovedParentSRF(submissionRequest) {
        const submissionRequestID = submissionRequest?._id ?? submissionRequest?.id;
        if (!submissionRequestID) {
            return false;
        }
        const parent = await this.submissionRequestDAO.findApprovedParentSubmissionRequestByID(submissionRequestID);
        return Boolean(parent);
    }

    /**
     * True when Approved and the immediate successor (if linked) is absent or terminal.
     * Returns the existing boolean when already set on the submission request (response-only field).
     * @param {object} submissionRequest submission request document
     * @returns {Promise<boolean>}
     */
    async _computeCanBeReopened(submissionRequest) {
        if (typeof submissionRequest?.canBeReopened === 'boolean') {
            return submissionRequest.canBeReopened;
        }
        if (!this._isApprovedSubmissionRequest(submissionRequest)) {
            return false;
        }
        return !(await this._hasActiveLaterRevisions(submissionRequest));
    }

    /**
     * True when history supports restore (prior state exists and latest entry is Canceled/Deleted).
     * @param {object} submissionRequest submission request document
     * @returns {boolean}
     */
    _hasValidRestoreHistory(submissionRequest) {
        const history = submissionRequest?.history;
        if ((history?.length ?? 0) < 2) {
            return false;
        }
        return [CANCELED, DELETED].includes(history.at(-1)?.status);
    }

    /**
     * True when status is Canceled or Deleted and history supports restore.
     * @param {object} submissionRequest submission request document
     * @returns {boolean}
     */
    _isRestoreCandidate(submissionRequest) {
        const status = this._normalizeSubmissionRequestStatus(submissionRequest?.status);
        const isCanceledOrDeleted = [CANCELED, DELETED].some(
            (terminalStatus) => this._normalizeSubmissionRequestStatus(terminalStatus) === status
        );
        return isCanceledOrDeleted && this._hasValidRestoreHistory(submissionRequest);
    }

    /**
     * True when restoreSubmissionRequest would succeed for this submissionRequest.
     * @param {object} submissionRequest submission request document
     * @param {boolean} hasApprovedParent Whether an Approved parent links to this submissionRequest
     * @returns {boolean}
     */
    _computeCanBeRestoredFromParentCheck(submissionRequest, hasApprovedParent) {
        if (typeof submissionRequest?.canBeRestored === 'boolean') {
            return submissionRequest.canBeRestored;
        }
        if (!this._isRestoreCandidate(submissionRequest)) {
            return false;
        }
        const sequenceNumber = submissionRequest?.sequenceNumber ?? 1;
        if (sequenceNumber === 1) {
            return true;
        }
        return hasApprovedParent;
    }

    /**
     * True when Approved and the immediate successor (if linked) is absent or terminal.
     * @param {object} submissionRequest submission request document
     * @param {Map<string, string>} successorStatusById Prefetched successor id → status map
     * @returns {boolean}
     */
    _computeCanBeReopenedFromSuccessorStatus(submissionRequest, successorStatusById) {
        if (typeof submissionRequest?.canBeReopened === 'boolean') {
            return submissionRequest.canBeReopened;
        }
        if (!this._isApprovedSubmissionRequest(submissionRequest)) {
            return false;
        }
        const nextRevisionID = submissionRequest?.nextRevisionId;
        const successorStatus = nextRevisionID ? successorStatusById.get(nextRevisionID) : undefined;
        return !this._hasSuccessorWithNonTerminalStatus(submissionRequest, successorStatus);
    }

    /**
     * True when restoreSubmissionRequest would succeed for this submissionRequest.
     * Returns the existing boolean when already set on the submission request (response-only field).
     * @param {object} submissionRequest submission request document
     * @returns {Promise<boolean>}
     */
    async _computeCanBeRestored(submissionRequest) {
        if (typeof submissionRequest?.canBeRestored === 'boolean') {
            return submissionRequest.canBeRestored;
        }
        if (!this._isRestoreCandidate(submissionRequest)) {
            return false;
        }
        if ((submissionRequest?.sequenceNumber ?? 1) === 1) {
            return true;
        }
        const hasApprovedParent = await this._hasApprovedParentSRF(submissionRequest);
        return this._computeCanBeRestoredFromParentCheck(submissionRequest, hasApprovedParent);
    }

    /**
     * Computes SRF state fields for a submission request API response (e.g. canBeReopened, canBeRestored).
     * @param {object} submissionRequest submission request document
     * @returns {Promise<object|null>}
     */
    async _computeSRFStateFields(submissionRequest) {
        if (!submissionRequest) {
            return submissionRequest;
        }
        const [canBeReopened, canBeRestored] = await Promise.all([
            this._computeCanBeReopened(submissionRequest),
            this._computeCanBeRestored(submissionRequest),
        ]);
        submissionRequest.canBeReopened = canBeReopened;
        submissionRequest.canBeRestored = canBeRestored;
        return submissionRequest;
    }

    /**
     * Builds conditional / pendingConditions from an approved study record.
     * @param {object|undefined|null} study Approved study document
     * @returns {{ conditional: boolean, pendingConditions: string[] }}
     */
    _resolveConditionalApprovalFields(study) {
        if (!study) {
            return { conditional: false, pendingConditions: [] };
        }
        const pendingConditions = [
            ...(study?.controlledAccess && !study?.dbGaPID ? [ERROR.CONTROLLED_STUDY_NO_DBGAPID] : []),
            ...(isTrue(study?.pendingModelChange) ? [ERROR.PENDING_APPROVED_STUDY] : []),
            ...((isTrue(study?.controlledAccess) && isTrue(study?.isPendingGPA)) ? [ERROR.PENDING_APPROVED_STUDY_NO_GPA_INFO] : []),
            ...(isTrue(study?.pendingImageDeIdentification) ? [ERROR.PENDING_IMAGE_DEIDENTIFICATION_CONDITION] : []),
        ];
        return {
            conditional: pendingConditions.length > 0,
            pendingConditions,
        };
    }

    /**
     * Batch-prefetches revision-chain and approved-study data for a list page, then sets
     * canBeReopened / canBeRestored on each submissionRequest in memory.
     * @param {object[]} submissionRequests Paginated submission request rows from listSubmissionRequests
     * @returns {Promise<{ studyByLowerName: Map<string, object> }>}
     */
    async _batchComputeListSubmissionRequestFields(submissionRequests) {
        const studyByLowerName = new Map();
        if (!submissionRequests?.length) {
            return { studyByLowerName };
        }

        const successorIds = [...new Set(
            submissionRequests
                .filter((app) => this._isApprovedSubmissionRequest(app) && app.nextRevisionId)
                .map((app) => app.nextRevisionId)
        )];

        const restoreCandidateIds = submissionRequests
            .filter((app) => this._isRestoreCandidate(app) && (app?.sequenceNumber ?? 1) > 1)
            .map((app) => app._id ?? app.id)
            .filter(Boolean);

        const studyNamesByLower = new Map();
        for (const app of submissionRequests) {
            if (!this._isApprovedSubmissionRequest(app)) {
                continue;
            }
            const name = app.studyName?.trim();
            if (!name) {
                continue;
            }
            const key = name.toLowerCase();
            if (!studyNamesByLower.has(key)) {
                studyNamesByLower.set(key, name);
            }
        }
        const studyNames = [...studyNamesByLower.values()];

        // Batch database queries and perform in parallel
        const [successors, parents, studies] = await Promise.all([
            successorIds.length
                ? this.submissionRequestDAO.findSubmissionRequestStatusesByIDs(successorIds)
                : [],
            restoreCandidateIds.length
                ? this.submissionRequestDAO.findApprovedSubmissionRequestsByNextRevisionIDs(restoreCandidateIds)
                : [],
            studyNames.length
                ? this.approvedStudiesService.findByStudyNames(studyNames)
                : [],
        ]);

        const successorStatusById = new Map(
            (successors ?? []).map((successor) => [successor.id ?? successor._id, successor.status])
        );
        const approvedParentSuccessorIds = new Set(
            (parents ?? []).map((parent) => parent.nextRevisionId).filter(Boolean)
        );

        for (const study of studies ?? []) {
            const key = study.studyName?.trim().toLowerCase();
            if (key && !studyByLowerName.has(key)) {
                studyByLowerName.set(key, study);
            }
        }

        for (const app of submissionRequests) {
            if (typeof app?.canBeReopened !== 'boolean') {
                app.canBeReopened = this._computeCanBeReopenedFromSuccessorStatus(app, successorStatusById);
            }
            if (typeof app?.canBeRestored !== 'boolean') {
                const submissionRequestID = app._id ?? app.id;
                const hasApprovedParent = submissionRequestID
                    ? approvedParentSuccessorIds.has(submissionRequestID)
                    : false;
                app.canBeRestored = this._computeCanBeRestoredFromParentCheck(app, hasApprovedParent);
            }
        }

        return { studyByLowerName };
    }

    /**
     * Clears inbound nextRevisionId links (revision chain link removal).
     * @param {string} submissionRequestID Successor submissionRequest _id whose inbound links should be cleared
     */
    async _pruneRevisionChainOnTerminal(submissionRequestID) {
        if (!submissionRequestID) {
            return;
        }
        try {
            await this.submissionRequestDAO.clearNextRevisionIdPointingTo(submissionRequestID);
        } catch (err) {
            console.error('Failed to clear revision chain link for successor submissionRequest:', submissionRequestID, err);
        }
    }

    /**
     * Get the applicant display name
     * @param {object} user The user object
     * @returns {string} The applicant display name
     */
    _getUserDisplayName(user) {
        return user?.fullName?.trim() || formatName(user) || user?.applicantName || "";
    }

    /**
     * True when the user may view this submissionRequest.
     * Enforces submission_request:view scope rules: only all and own grant access.
     * @param {object} userScope Resolved UserScope for SUBMISSION_REQUEST.VIEW
     * @param {object} userInfo Session user
     * @param {object} submissionRequest Loaded submission request document
     * @returns {boolean}
     */
    _canViewSubmissionRequest(userScope, userInfo, submissionRequest) {
        if (userScope.isAllScope()) {
            return true;
        }
        if (userScope.isOwnScope()) {
            const ownerID = submissionRequest?.applicant?.applicantID ?? submissionRequest?.applicantID;
            return userInfo?._id === ownerID;
        }
        return false;
    }

    /**
     * Returns a single submissionRequest when the caller may view it (view:all, or view:own as applicant).
     * Non-all callers receive the same view error for missing and unauthorized records to avoid ID enumeration.
     * @param {{ _id: string }} params Submission Request _id
     * @param {object} context Request context with userInfo
     * @returns {Promise<object>} Hydrated submissionRequest
     * @throws {Error} When the submission request is missing or the caller cannot view it
     */
    async getSubmissionRequest(params, context) {
        verifySession(context)
            .verifyInitialized();

        const userScopesList = await this.authorizationService.getPermissionScope(
            context?.userInfo,
            USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW
        );
        const userScope = UserScope.create(userScopesList);

        // mask submissionRequest not found error for non-all-scoped callers to avoid ID enumeration
        let submissionRequest;
        try {
            submissionRequest = await this.getSubmissionRequestById(params._id);
        } catch (error) {
            if (!userScope.isAllScope() && error.message?.startsWith(ERROR.SUBMISSION_REQUEST_NOT_FOUND)) {
                throw new Error(ERROR.INVALID_PERMISSION);
            }
            throw error;
        }
        if (!this._canViewSubmissionRequest(userScope, context.userInfo, submissionRequest)) {
            throw new Error(ERROR.INVALID_PERMISSION);
        }

        // add logics to check if conditional approval
        if (this._isApprovedSubmissionRequest(submissionRequest)) {
            await this._checkConditionalApproval(submissionRequest);
        }
        // populate the version with auto upgrade based on configuration
        submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest.version);
        return submissionRequest;
    }

    async _getSubmissionRequestVersionByStatus(status, version = null ) {
        const config = await this.configurationService.findByType("APPLICATION_FORM_VERSIONS"); //get version config dynamically
        const currentVersion = config?.current || "2.0";
        const newStatusVersion = config?.new || "3.0";
        // auto upgrade version based on configuration if status is NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED
        // for status other than NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED, keep original version if exists, else set current version.
        return [NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED].includes(status)
            ? newStatusVersion
            : (!version) ? currentVersion : version;
    }

    /**
     * Computes conditional / pendingConditions from the approved study for this submissionRequest study name.
     * @returns {Promise<{ conditional: boolean, pendingConditions: string[] }>}
     */
    async _computeConditionalApprovalFields(studyName) {
        const studyArr = await this.approvedStudiesService.findByStudyName(studyName);
        if (!studyArr || studyArr.length < 1) {
            return { conditional: false, pendingConditions: [] };
        }
        return this._resolveConditionalApprovalFields(studyArr[0]);
    }

    async _checkConditionalApproval(submissionRequest) {
        const { conditional, pendingConditions } = await this._computeConditionalApprovalFields(submissionRequest.studyName);
        submissionRequest.conditional = conditional;
        submissionRequest.pendingConditions = pendingConditions;
    }

    /**
     * Reformats a DB record into a submission request API response shape and computes response fields.
     * @param {object} record submission request document from the database
     * @param {object} [ownerUser] Optional owner user for applicant fields
     * @returns {Promise<object|null>}
     */
    async _reformatRecordForSubmissionRequestResponse(record, ownerUser) {
        if (!record) {
            return record;
        }
        const hydrated = { ...record };
        if (ownerUser) {
            hydrated.applicant = {
                applicantID: ownerUser.id ?? ownerUser._id ?? "",
                applicantName: this._getUserDisplayName(ownerUser) || "",
                applicantEmail: ownerUser.email || "",
            };
        } else if (hydrated.applicant && typeof hydrated.applicant === 'object') {
            hydrated.applicant = {
                applicantID: hydrated.applicant?.id || hydrated.applicant?.applicantID || "",
                applicantName: this._getUserDisplayName(hydrated.applicant) || "",
                applicantEmail: hydrated.applicant?.email || hydrated.applicant?.applicantEmail || "",
            };
        }
        if (hydrated.id && !hydrated._id) {
            hydrated._id = hydrated.id;
        }
        return await this._computeSRFStateFields(hydrated);
    }

    async getSubmissionRequestById(id) {
        const result = await this.submissionRequestDAO.findSubmissionRequestWithApplicantByID(id);
        if (!result) {
            throw new Error(ERROR.SUBMISSION_REQUEST_NOT_FOUND+id);
        }

        return await this._reformatRecordForSubmissionRequestResponse(result);
    }
    
    async reviewSubmissionRequest(params, context) {
        await this.verifyReviewerPermission(context);
        const submissionRequest = await this.getSubmissionRequest(params, context);
        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        if (submissionRequest && submissionRequest.status && submissionRequest.status === SUBMITTED) {
            // If Submitted status, change it to In Review
            const history = HistoryEventBuilder.createEvent(context.userInfo._id, IN_REVIEW, null);
            const updated = await this.submissionRequestDAO.update({
                _id: submissionRequest._id,
                status: IN_REVIEW,
                updatedAt: history.dateTime,
                history: [...(submissionRequest.history || []), history]
            });
            if (updated) {
                const promises = [
                    await this.getSubmissionRequestById(params._id),
                    this.logCollection.insert(
                        UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, IN_REVIEW)
                    )
                ];
                return await Promise.all(promises).then(function(results) {
                    return results[0];
                });
            }
        }
        // populate the version with auto upgrade based on configuration
        submissionRequest.version  = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest.version);
        return await this._computeSRFStateFields(submissionRequest) || null;
    }

    async createSubmissionRequest(submissionRequest, userInfo, status = NEW) {
        const timestamp = getCurrentTime();

        const history = [HistoryEventBuilder.createEvent(userInfo._id, NEW, null, timestamp)];
        if (status === IN_PROGRESS) {
            // Add an additional 1s to the timestamp to ensure the events can be correctly sorted
            const eventTime = new Date(timestamp.getTime() + 1000);
            history.push(HistoryEventBuilder.createEvent(userInfo._id, IN_PROGRESS, null, eventTime));
        }

        let newSubmissionRequestProperties = {
            _id: v4(undefined, undefined, undefined),
            status,
            controlledAccess: submissionRequest?.controlledAccess,
            applicantID: userInfo._id,
            history,
            createdAt: timestamp,
            updatedAt: timestamp,
            programAbbreviation: submissionRequest?.programAbbreviation,
            programDescription: submissionRequest?.programDescription,
            version: (submissionRequest?.version)? submissionRequest.version : await this._getSubmissionRequestVersionByStatus(status),
            inactiveReminder: false, // If deleted, it will set true
            inactiveReminder_7: false,
            inactiveReminder_15: false,
            inactiveReminder_30: false,
            finalInactiveReminder: false,
            sequenceNumber: 1,
        };

        if (userInfo?.organization?.orgID) {
            newSubmissionRequestProperties.organization = {
                _id: userInfo?.organization?.orgID,
                name: userInfo?.organization?.orgName || ""
            }
        }

        submissionRequest = {
            ...submissionRequest,
            ...newSubmissionRequestProperties
        };
        const res = await this.submissionRequestDAO.insert(submissionRequest);
        if (res?.acknowledged) await this.logCollection.insert(CreateApplicationEvent.create(userInfo._id, userInfo.email, userInfo.IDP, submissionRequest._id));
        return await this._computeSRFStateFields(submissionRequest);
    }

    /**
     * Provides API functionality to create or save a submission request.
     * 
     * @note If no ID is provided in the submission request object, a new submissionRequest will be created.
     * @param {{ application: object, status: typeof NEW | typeof IN_PROGRESS }} params GraphQL params; `application` is the schema input field name for the SRF payload
     * @param {object} context The request context containing user information
     * @returns {Promise<object>} The created or updated submission request object
     */
    async saveSubmissionRequest(params, context) {
        verifySession(context)
            .verifyInitialized()
        let inputSubmissionRequest = params.application;
        const id = inputSubmissionRequest?._id;
        if (!id) {
            const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE);
            if (userScope.isNoneScope()) {
                throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
            }
            const requestedStatus = params?.status ?? NEW;
            if (![NEW, IN_PROGRESS].includes(requestedStatus)) {
                throw new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
            }
            this._validateStudy(inputSubmissionRequest);
            return await this.createSubmissionRequest(inputSubmissionRequest, context.userInfo, requestedStatus);
        }

        const storedSubmissionRequest = await this.getSubmissionRequestById(id);
        if (storedSubmissionRequest?.applicant.applicantID !== context?.userInfo?._id) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const prevStatus = storedSubmissionRequest?.status;
        let targetStatus = params?.status;
        if (prevStatus === REOPENED) {
            targetStatus = IN_PROGRESS;
        } else if (prevStatus === IN_REVISION) {
            targetStatus = IN_REVISION;
        } else if (!targetStatus || ![NEW, IN_PROGRESS].includes(targetStatus)) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        }

        let submissionRequest = {...storedSubmissionRequest, ...inputSubmissionRequest, status: targetStatus };
        // auto upgrade version based on configuration
        submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status);

        this._validateStudy(inputSubmissionRequest);

        if (inputSubmissionRequest?.newInstitutions?.length > 0) {
            await this._validateNewInstitution(inputSubmissionRequest?.newInstitutions);
        }

        submissionRequest = await this._updateSubmissionRequest(submissionRequest, prevStatus, context?.userInfo?._id);
        if (prevStatus !== submissionRequest.status){
            await logStateChange(this.logCollection, context.userInfo, submissionRequest, prevStatus);
        }
        return this.getSubmissionRequestById(submissionRequest?._id);
    }

    _validateStudy(submissionRequest) {
        if (submissionRequest?.studyAbbreviation && submissionRequest.studyAbbreviation.length > STUDY_ABBREVIATION_MAX_LENGTH) {
            throw new Error(replaceErrorString(ERROR.MAX_STUDY_ABBREVIATION_LENGTH, STUDY_ABBREVIATION_MAX_LENGTH));
        }
    }

    async _validateNewInstitution(newInstitutions) {
        const newInstitutionNames = newInstitutions
            .map(i => i?.name)
            .filter(Boolean);

        const newInstitutionIDs = newInstitutions
            .map(i => i?.id)
            .filter(Boolean);

        // The institution name is stored only when the SR gets approval, and only unique institutions should be stored.
        const duplicatesNames = newInstitutionNames.filter((item, index) => newInstitutionNames.indexOf(item) !== index);
        if (duplicatesNames.length > 0) {
            throw new Error(`${ERROR.DUPLICATE_INSTITUTION_NAME};${duplicatesNames.join(", ")}`);
        }
        // This is the generated institution ID by FE.
        const duplicatesIDs = newInstitutionIDs.filter((item, index) => newInstitutionIDs.indexOf(item) !== index);
        if (duplicatesIDs.length > 0) {
            throw new Error(`${ERROR.DUPLICATE_INSTITUTION_ID};${duplicatesIDs.join(", ")}`);
        }

        if (newInstitutionNames.length > 0) {
            const existingInstitutions = await this.institionDAO.findMany({
                name: { $in: newInstitutionNames },
            });
            if (existingInstitutions.length > 0) {
                const existingInstitutionNames = existingInstitutions.map(i => i?.name);
                throw new Error(`${ERROR.DUPLICATE_INSTITUTION_NAME};${existingInstitutionNames.join(", ")}`);
            }
        }

        const InvalidInstitutionNames = newInstitutionNames.filter(i => i?.length > MAX_INSTITUTION_NAME_LENGTH);
        if (InvalidInstitutionNames?.length > 0) {
            throw new Error(`${ERROR.MAX_INSTITUTION_NAME_LIMIT};${InvalidInstitutionNames.join(", ")}`);
        }
    }

    /**
     * Returns the current user's most recent Approved SRF.
     * Used when starting a new submission to auto-fill PI data from the prior approval.
     * @param {object} params Request parameters (unused)
     * @param {object} context Request context with userInfo
     * @returns {Promise<object|null>} Hydrated submissionRequest or null when none exist
     */
    async getMyLastSubmissionRequest(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const userID = context.userInfo._id;
        const submissionRequest = await this.submissionRequestDAO.findLatestApprovedByApplicantID(userID);
        if (!submissionRequest) {
            return null;
        }
        const res = await this.getSubmissionRequestById(submissionRequest._id);
        if (this._isApprovedSubmissionRequest(res)) {
            await this._checkConditionalApproval(res);
        }
        res.version = await this._getSubmissionRequestVersionByStatus(IN_PROGRESS);
        return res;
    }

    /**
     * Build a case-insensitive fullName regex for applicant filtering, or null when unused.
     * @param {string} [submitterName]
     * @returns {RegExp|null}
     */
    _getApplicantFullNameMatch(submitterName) {
        if (submitterName != null && submitterName !== this._ALL_FILTER) {
            return new RegExp(escapeRegexLiteral(submitterName.trim()), 'i');
        }
        return null;
    }

    _validateListSubmissionRequestsParams(params) {
        // Validate statuses, case insensitive
        const validStatusesLower = new Set(this._VALID_LIST_SUBMISSION_REQUEST_STATUSES.map(s => String(s).toLowerCase()));
        const statusesParameter = params?.statuses;
        if (statusesParameter != null) {
            if (!Array.isArray(statusesParameter)) {
                console.error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS, { statuses: statusesParameter });
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            }
            if (statusesParameter.length > 0) {
                statusesParameter.forEach(status => {
                    const statusLower = (status != null ? String(status) : '').toLowerCase();
                    if (!validStatusesLower.has(statusLower)) {
                        throw new Error(replaceErrorString(ERROR.SUBMISSION_REQUEST_INVALID_STATUSES, `'${status}'`));
                    }
                });
            }
        }
        // Validate orderBy parameter, case insensitive. Map legacy "applicant.applicantName" to "applicant.fullName".
        const validOrderByValues = VALID_ORDER_BY_LIST_SUBMISSION_REQUESTS;
        const orderByInput = (params?.orderBy ?? "").toString().trim();
        let orderBy = "createdAt";
        if (orderByInput) {
            const matchingKey = validOrderByValues.find((k) => k.toLowerCase() === orderByInput.toLowerCase());
            if (!matchingKey) {
                const validOrderByValuesString = [...validOrderByValues].sort().join(", ");
                console.error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS, { orderBy: orderByInput, validOrderByValues: validOrderByValuesString });
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS + " Valid orderBy values: " + validOrderByValuesString);
            }
            orderBy = matchingKey === "applicant.applicantName" ? "applicant.fullName" : matchingKey;
        }
        // Validate sortDirection parameter, case insensitive
        const sortDirection = (params?.sortDirection || "DESC").toString().toUpperCase();
        if (sortDirection !== "ASC" && sortDirection !== "DESC") {
            console.error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS, { sortDirection: params?.sortDirection });
            throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
        }
        // Validate first parameter when provided: must be a positive integer or -1
        const first = params?.first;
        if (first !== undefined && first !== null) {
            const firstNum = Number(first);
            if (!Number.isInteger(firstNum) || (firstNum !== -1 && firstNum < 1)) {
                console.error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS, { first: params?.first });
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            }
        }
        // Validate offset parameter when provided: must be a non-negative integer
        const offset = params?.offset;
        if (offset !== undefined && offset !== null) {
            const offsetNum = Number(offset);
            if (!Number.isInteger(offsetNum) || offsetNum < 0) {
                console.error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS, { offset: params?.offset });
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_INVALID_PARAMS);
            }
        }
        // Return orderBy and sortDirection for pagination
        return { orderBy, sortDirection };
    }

    /**
     * Lists submission requests with filters, pagination, and facet values.
     * Computes canBeReopened and canBeRestored per row from revision-chain rules.
     * @param {object} params Filter, pagination, and sort parameters
     * @param {object} context Request context with userInfo
     * @returns {Promise<object>} submissionRequests, total, programs, studies, and filter facets
     */
    async listSubmissionRequests(params, context) {
        // Verify that the user is authenticated and has the necessary permissions to list submissionRequests
        verifySession(context)
            .verifyInitialized()

        // Get the user information from the context
        const userInfo = context?.userInfo;

        // Only the all and own scopes are currently required for listing submissionRequests (per PBACDefaults_config: submission_request:view...).
        // All other scopes will return an empty list.
        const userScopesList = await this.authorizationService.getPermissionScope(userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW);
        const userScope = UserScope.create(userScopesList);
        if (!userScope.isAllScope() && !userScope.isOwnScope()) {
            console.warn(ERROR.VERIFY.INVALID_PERMISSION + ": list submission requests");
            console.warn("Triggered by user: " + userInfo?._id);
            return {
                submissionRequests: [],
                total: 0,
                programs: [],
                studies: [],
                studyAbbreviations: [],
                status: [],
                submitterNames: []
            };
        }

        // Validate list submissionRequests parameters and map the orderBy / sortDirection for pagination
        const { orderBy, sortDirection } = this._validateListSubmissionRequestsParams(params);

        // Build filter conditions:
        // Statuses filter: ignored if input is falsy, empty array, or contains "All" (case-insensitive).
        // Normalize statuses to proper case (e.g. "New", "In Progress") since DB stores title case.
        const statusesParam = params?.statuses;
        const applyStatusesFilter = statusesParam != null && Array.isArray(statusesParam) && statusesParam.length > 0
            && !statusesParam.some((s) => typeof s === 'string' && s.toLowerCase() === 'all');
        // Map statuses to proper case (e.g. "New", "In Progress") since DB stores title case.
        const statusLowerToCanonical = new Map(this._VALID_LIST_SUBMISSION_REQUEST_STATUSES.map(s => [String(s).toLowerCase(), s]));
        const statusesForQuery = applyStatusesFilter
            ? (statusesParam || []).map(s => statusLowerToCanonical.get((s != null ? String(s) : '').toLowerCase())).filter(Boolean).filter(s => s !== this._ALL_FILTER)
            : [];
        const statusCondition = statusesForQuery.length > 0 ? { status: { $in: statusesForQuery } } : {};
        // Submitter name filter (applied after applicant $lookup)
        const applicantFullNameMatch = this._getApplicantFullNameMatch(params?.submitterName);
        // Program name filter
        const programNameCondition = (params.programName != null && params.programName !== this._ALL_FILTER)
            ? { programName: params.programName }
            : {};
        // Study filter: search both studyName and studyAbbreviation (OR), case-insensitive partial match
        const studySearchTerm = params.studyName?.trim();
        const hasStudyFilter = studySearchTerm?.length > 0 && params.studyName !== this._ALL_FILTER;
        let studyCondition = {};
        if (hasStudyFilter) {
            const studyRegex = new RegExp(escapeRegexLiteral(studySearchTerm), 'i');
            studyCondition = {
                $or: [
                    { studyName: studyRegex },
                    { studyAbbreviation: studyRegex }
                ]
            };
        }
        // Assemble generic filter conditions; if scope is own, add applicantID filter
        const baseConditions = { ...statusCondition, ...programNameCondition, ...studyCondition };
        const genericFilterConditions = userScope.isOwnScope()
            ? { ...baseConditions, applicantID: userInfo?._id }
            : baseConditions;

        // Pagination / sort options for the applicant-joined list query
        const listOptions = {
            applicantFullNameMatch,
            orderBy,
            sortDirection,
            skip: params?.offset,
            limit: params?.first,
        };

        // Query filtered and paginated submission request list
        let submissionRequests;
        try {
            submissionRequests = await this.submissionRequestDAO.findManyWithApplicant(
                { ...genericFilterConditions },
                listOptions
            );
            submissionRequests = submissionRequests ?? [];
        } catch (err) {
            console.error("List submission requests fetch error: submission request list", err);
            throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED + " Failed step: fetching submission request list.");
        }

        // Query total submission request count
        let totalCount;
        try {
            totalCount = await this.submissionRequestDAO.countWithApplicant(
                genericFilterConditions,
                { applicantFullNameMatch }
            );
        } catch (err) {
            console.error("List submission requests fetch error: submission request count", err);
            throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED + " Failed step: fetching submission request count.");
        }

        // When study filter uses OR, fetch studyName + studyAbbreviation once and derive both distinct lists in memory
        let studyFilterDistinctRows = null;
        if (hasStudyFilter) {
            try {
                studyFilterDistinctRows = await this.submissionRequestDAO.findManyWithApplicant(
                    genericFilterConditions,
                    { applicantFullNameMatch }
                );
            } catch (err) {
                console.error("List submission requests fetch error: gathering distinct study values", err);
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED + " Failed step: gathering distinct study values.");
            }
        }

        // Query distinct filter options in parallel (programs, studies, studyAbbreviations, statuses, submitter names)
        const runQuery = async (queryName, fn) => {
            try {
                return await fn();
            } catch (err) {
                console.error("List submission requests fetch error:", queryName, err);
                throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED);
            }
        };
        let programs, studies, studyAbbreviations, statusesList, submitterNames;
        try {
            [programs, studies, studyAbbreviations, statusesList, submitterNames] = await Promise.all([
                runQuery("programs", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.programName;
                    if (applicantFullNameMatch) {
                        const rows = await this.submissionRequestDAO.findManyWithApplicant(
                            filterConditions,
                            { applicantFullNameMatch }
                        );
                        return Array.from(new Set((rows ?? []).map((item) => item.programName).filter(Boolean)));
                    }
                    return (await this.submissionRequestDAO.distinct('programName', filterConditions)).filter(Boolean);
                }),
                runQuery("studies", async () => {
                    if (studyFilterDistinctRows !== null) {
                        const names = (studyFilterDistinctRows ?? []).map(item => item.studyName).filter(Boolean);
                        return Array.from(new Set(names));
                    }
                    const filterConditions = { ...genericFilterConditions };
                    if (applicantFullNameMatch) {
                        const rows = await this.submissionRequestDAO.findManyWithApplicant(
                            filterConditions,
                            { applicantFullNameMatch }
                        );
                        return Array.from(new Set((rows ?? []).map((item) => item.studyName).filter(Boolean)));
                    }
                    return (await this.submissionRequestDAO.distinct('studyName', filterConditions)).filter(Boolean);
                }),
                runQuery("study abbreviations", async () => {
                    if (studyFilterDistinctRows !== null) {
                        const abbreviations = (studyFilterDistinctRows ?? []).map(item => item.studyAbbreviation).filter(Boolean);
                        return Array.from(new Set(abbreviations));
                    }
                    const filterConditions = { ...genericFilterConditions };
                    if (applicantFullNameMatch) {
                        const rows = await this.submissionRequestDAO.findManyWithApplicant(
                            filterConditions,
                            { applicantFullNameMatch }
                        );
                        return Array.from(new Set((rows ?? []).map((item) => item.studyAbbreviation).filter(Boolean)));
                    }
                    return (await this.submissionRequestDAO.distinct('studyAbbreviation', filterConditions)).filter(Boolean);
                }),
                runQuery("statuses", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.status;
                    if (applicantFullNameMatch) {
                        const rows = await this.submissionRequestDAO.findManyWithApplicant(
                            filterConditions,
                            { applicantFullNameMatch }
                        );
                        return Array.from(new Set((rows ?? []).map((item) => item.status).filter(Boolean)));
                    }
                    return (await this.submissionRequestDAO.distinct('status', filterConditions)).filter(Boolean);
                }),
                runQuery("submitter names", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    return await this.submissionRequestDAO.distinctApplicantFullNames(filterConditions);
                }),
            ]);
        } catch (err) {
            // If the error message includes the expected error message, it has already been logged and formatted and can be rethrown
            if (err.message?.includes(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED)) {
                throw err;
            }
            // Log the error, format it and rethrow
            console.error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED, err);
            throw new Error(ERROR.LIST_SUBMISSION_REQUESTS_FETCH_FAILED + " Please see logs for more information.");
        }

        // Batch-prefetch SRF state and approved-study data, then map to plain objects so GraphQL
        // always receives conditional / pendingConditions.
        const { studyByLowerName } = await this._batchComputeListSubmissionRequestFields(submissionRequests);
        const mappedSubmissionRequests = [];
        for (const app of submissionRequests) {
            const applicant = {
                applicantID: app?.applicant?.id || app?.applicant?._id || "",
                applicantName: this._getUserDisplayName(app.applicant) || "",
                applicantEmail: app?.applicant?.email || "",
            };
            if (!this._isApprovedSubmissionRequest(app)) {
                mappedSubmissionRequests.push({
                    ...app,
                    applicant,
                    studyAbbreviation: defaultStudyAbbreviationToStudyName(app.studyAbbreviation, app.studyName),
                });
                continue;
            }
            const study = studyByLowerName.get(app.studyName?.trim().toLowerCase());
            const { conditional, pendingConditions } = this._resolveConditionalApprovalFields(study);
            mappedSubmissionRequests.push({
                ...app,
                applicant,
                conditional,
                pendingConditions,
                studyAbbreviation: defaultStudyAbbreviationToStudyName(app.studyAbbreviation, app.studyName),
            });
        }
        submissionRequests = mappedSubmissionRequests;

        // Sort statuses in display order
        const statusOrder = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, INQUIRED, IN_REVISION, REOPENED, APPROVED, REJECTED, CANCELED, DELETED];
        const statuses = (statusesList || []).sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));
        // Return the results
        return {
            submissionRequests,
            total: totalCount,
            programs: programs || [],
            studies: studies || [],
            studyAbbreviations: studyAbbreviations || [],
            status: statuses,
            submitterNames: submitterNames || []
        };
    }

    async submitSubmissionRequest(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.SUBMIT);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const submissionRequest = await this.getSubmissionRequestById(params._id);
        const validStatus = [IN_PROGRESS, INQUIRED, IN_REVISION]; // updated based on new requirement.
        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state(validStatus);
        // In Progress -> In Submitted
        const history = submissionRequest.history || [];
        const historyEvent = HistoryEventBuilder.createEvent(context.userInfo._id, SUBMITTED, null);
        history.push(historyEvent)
        const aSubmissionRequest = {
            _id: submissionRequest._id,
            history: history,
            status: SUBMITTED,
            updatedAt: historyEvent.dateTime,
            submittedDate: historyEvent.dateTime
        };
        const updated = await this.submissionRequestDAO.update(aSubmissionRequest);
        if (!updated) throw new Error(ERROR.UPDATE_FAILED);
        const logEvent = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, SUBMITTED);
        await Promise.all([
            await this.logCollection.insert(logEvent),
            await sendEmails.submitSubmissionRequest(this.notificationService, this.userService, this.emailParams, context.userInfo, submissionRequest)
        ]);
        return await this.getSubmissionRequestById(submissionRequest._id);
    }


    _getInProgressComment(history) {
        const isValidComment = history?.length > 1 &&
            ([CANCELED, DELETED].includes(history?.at(-2)?.status) // Restored Reason
            || INQUIRED === history?.at(-1)?.status);
        return isValidComment ? history?.at(-1)?.reviewComment : null;
    }

    async resumeInquiredSubmissionRequest(params, context) {
        verifySession(context)
            .verifyInitialized();
        const submissionRequestID = params?._id ?? params?.id;
        const submissionRequest = await this.getSubmissionRequestById(submissionRequestID);
        if (context?.userInfo?._id !== submissionRequest?.applicant?.applicantID) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state([INQUIRED]);

        submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest?.version);
        if (submissionRequest && submissionRequest.status) {
            const reviewComment = this._getInProgressComment(submissionRequest?.history);
            const history = HistoryEventBuilder.createEvent(context.userInfo._id, IN_REVISION, reviewComment);
            const updated = await this.submissionRequestDAO.update({
                _id: submissionRequest._id,
                status: IN_REVISION,
                updatedAt: history.dateTime,
                version: submissionRequest.version,
                history: [...(submissionRequest.history || []), history]
            });
            if (updated) {
                const promises = [
                    await this.getSubmissionRequestById(submissionRequestID),
                    await this.logCollection.insert(UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, IN_REVISION))
                ];
                return await Promise.all(promises).then(function(results) {
                    return results[0];
                });
            }
        }
        return await this._computeSRFStateFields(submissionRequest);
    }

    async reopenSubmissionRequest(params, context) {
        return this.resumeInquiredSubmissionRequest(params, context);
    }

    async reopenApprovedSubmissionRequest(params, context) {
        // Verifications
        verifySession(context)
            .verifyInitialized();

        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.REOPEN);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const source = await this.getSubmissionRequestById(params._id);
        verifySubmissionRequest(source)
            .notEmpty()
            .state([APPROVED]);

        if (!(await this._computeCanBeReopened(source))) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        }

        const replaceExistingLink = Boolean(source.nextRevisionId);
        const sourceOwnerId = source?.applicant?.applicantID ?? source?.applicantID;
        const isAllScope = userScope.isAllScope();
        const isOwnScope = userScope.isOwnScope();

        if (!isAllScope && !isOwnScope) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        if (isOwnScope) {
            if (context.userInfo._id !== sourceOwnerId) {
                throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
            }
            if (params?.ownerId && params.ownerId !== context.userInfo._id) {
                throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
            }
        }

        // Get the reopened SRF owner and verify
        const ownerUser = await this._getReopenSRFOwnerAndVerify(
            source,
            isAllScope ? params?.ownerId : null
        );

        // Clone the submission request for reopen
        const timestamp = getCurrentTime();
        const historyEvent = HistoryEventBuilder.createEvent(context.userInfo._id, REOPENED, null, timestamp);
        const version = await this._getSubmissionRequestVersionByStatus(REOPENED);
        const sourceSequence = source?.sequenceNumber ?? 1;
        const reopenedSubmissionRequest = {
            // initialization fields 
            _id: v4(undefined, undefined, undefined),
            status: REOPENED,
            sequenceNumber: sourceSequence + 1,
            submittedDate: null,
            version,
            createdAt: timestamp,
            updatedAt: timestamp,
            applicantID: ownerUser._id ?? ownerUser.id,
            history: [historyEvent],
            inactiveReminder: false,
            inactiveReminder_7: false,
            inactiveReminder_15: false,
            inactiveReminder_30: false,
            finalInactiveReminder: false,
            // copied fields from source SRF
            questionnaireData: source.questionnaireData,
            programName: source.programName,
            programAbbreviation: source.programAbbreviation,
            programDescription: source.programDescription,
            studyName: source.studyName,
            studyAbbreviation: source.studyAbbreviation,
            controlledAccess: source.controlledAccess,
            openAccess: source.openAccess,
            wholeProgram: source.wholeProgram,
            ORCID: source.ORCID,
            PI: source.PI,
            GPAName: source.GPAName,
            organization: source.organization,
            newInstitutions: source.newInstitutions
        };
        const insertedApp = await this.submissionRequestDAO.reopenApprovedRevision(
            source._id,
            reopenedSubmissionRequest,
            replaceExistingLink
        );

        // Log the audit events
        const { _id: actorId, email, IDP } = context.userInfo;
        await Promise.all([
            this.logCollection.insert(CreateApplicationEvent.create(actorId, email, IDP, insertedApp._id)),
            this.logCollection.insert(UpdateApplicationStateEvent.create(
                actorId, email, IDP, insertedApp._id, APPROVED, REOPENED
            ))
        ]);

        await this._sendReopenSubmissionRequestEmail(insertedApp, ownerUser, sourceOwnerId);

        // Compile API response
        insertedApp.version = await this._getSubmissionRequestVersionByStatus(insertedApp.status, insertedApp.version);
        return await this._reformatRecordForSubmissionRequestResponse(insertedApp, ownerUser);
    }

    _logReopenOwnerValidationFailure(details, errorCode) {
        console.warn("Reopen owner resolution failed:", details, errorCode);
    }

    async _getReopenSRFOwnerAndVerify(source, inputOwnerID) {
        const originalOwnerID = source?.applicant?.applicantID ?? source?.applicantID;
        const maintainOriginalOwner = !inputOwnerID || inputOwnerID === originalOwnerID;
        const activeStatus = USER_CONSTANTS.USER.STATUSES.ACTIVE;

        let ownerUser;
        if (!inputOwnerID) {
            if (!originalOwnerID) {
                const error = ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED;
                this._logReopenOwnerValidationFailure({ submissionRequestID: source._id }, error);
                throw new Error(error);
            }

            ownerUser = await this.userDAO.findByIdAndStatus(originalOwnerID, activeStatus);
            if (!ownerUser) {
                const error = ERROR.VERIFY.REOPEN_OWNER_UNRESOLVED;
                this._logReopenOwnerValidationFailure({ ownerId: originalOwnerID }, error);
                throw new Error(error);
            }
        } else {
            ownerUser = await this.userDAO.findByIdAndStatus(inputOwnerID, activeStatus);
            if (!ownerUser) {
                const error = ERROR.VERIFY.REOPEN_OWNER_NOT_ASSIGNABLE;
                this._logReopenOwnerValidationFailure({ ownerId: inputOwnerID }, error);
                throw new Error(error);
            }
        }

        // Verify reopened SRF owner has create permission
        const passPermissionCheck = hasSubmissionRequestCreatePermission(ownerUser);
        if (!passPermissionCheck) {
            // original owner case error response
            if (maintainOriginalOwner) {
                const error = ERROR.VERIFY.REOPEN_OWNER_ORIGINAL_INELIGIBLE;
                this._logReopenOwnerValidationFailure({ ownerId: originalOwnerID }, error);
                throw new Error(error);
            }
            // new owner case error response
            const error = ERROR.VERIFY.REOPEN_OWNER_SPECIFIED_INELIGIBLE;
            this._logReopenOwnerValidationFailure({ ownerId: inputOwnerID }, error);
            throw new Error(error);
        }

        // Verify the reopened SRF owner is the original owner or has an assignable role
        const passRoleCheck = maintainOriginalOwner || REOPEN_ASSIGNABLE_ROLES.includes(ownerUser?.role);
        if (!passRoleCheck) {
            const error = ERROR.VERIFY.REOPEN_OWNER_ROLE_INELIGIBLE;
            this._logReopenOwnerValidationFailure({ ownerId: inputOwnerID, role: ownerUser?.role }, error);
            throw new Error(error);
        }

        return ownerUser;
    }

    async _getUserScope(userInfo, permission) {
        const validScopes = await this.authorizationService.getPermissionScope(userInfo, permission);
        const userScope = UserScope.create(validScopes);
        // valid scopes; none, all, own
        const isValidUserScope = userScope.isNoneScope() || userScope.isAllScope() || userScope.isOwnScope();
        if (!isValidUserScope) {
            throw new Error(replaceErrorString(ERROR.INVALID_USER_SCOPE));
        }
        return userScope;
    }

    async cancelSubmissionRequest(document, context) {
        verifySession(context)
            .verifyInitialized();
        const userInfo = context?.userInfo;
        const userScope = await this._getUserScope(userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CANCEL);
        if (userScope.isNoneScope() || (!userScope.isOwnScope() && !userScope.isAllScope())) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        const aSubmissionRequest = await this.getSubmissionRequestById(document._id);
        const isSubmissionRequestOwned = userScope.isOwnScope() && userInfo?._id === aSubmissionRequest?.applicant?.applicantID;
        const validSubmissionRequestStatus = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, INQUIRED, IN_REVISION, REOPENED];
        if (!validSubmissionRequestStatus.includes(aSubmissionRequest.status)) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        }
        aSubmissionRequest.version = await this._getSubmissionRequestVersionByStatus(aSubmissionRequest.status, aSubmissionRequest?.version);
        const powerUserCond = [NEW, IN_PROGRESS, INQUIRED, IN_REVISION, SUBMITTED, IN_REVIEW, REOPENED].includes(aSubmissionRequest?.status);
        const isValidCond = [NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED].includes(aSubmissionRequest?.status) && userInfo?._id === aSubmissionRequest?.applicant?.applicantID;
        if ((userScope.isAllScope() && !powerUserCond) || (isSubmissionRequestOwned && !isValidCond)) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const history = HistoryEventBuilder.createEvent(context.userInfo._id, CANCELED, document?.comment);
        // If the submission request is empty, then delete the submission request and return the deleted submission request document.
        let updated = null;
        let deleteSubmissionRequest = false;
        let deletedSubmissionRequestDocument = null;
        const utilityService = new UtilityService();
        if (utilityService.isEmptySubmissionRequest(aSubmissionRequest)) {
            deletedSubmissionRequestDocument = await this.getSubmissionRequestById(document._id);
            updated = await this.submissionRequestDAO.delete(document._id);
            deleteSubmissionRequest = true;
        } else{
            updated = await this.submissionRequestDAO.update({
                _id: aSubmissionRequest._id,
                status: CANCELED,
                updatedAt: history.dateTime,
                version: aSubmissionRequest.version,
                history: [...(aSubmissionRequest?.history || []), history]
            });
        }
        if (updated) {
            await this._sendCancelSubmissionRequestEmail(userInfo, aSubmissionRequest);
        } else {
            console.error(ERROR.FAILED_DELETE_SUBMISSION_REQUEST, `${document._id}`);
            throw new Error(ERROR.FAILED_DELETE_SUBMISSION_REQUEST);
        }
        if (deleteSubmissionRequest) {
            // If submissionRequest is deleted, then return null
            return deletedSubmissionRequestDocument;
        }else
            return await this.getSubmissionRequestById(document._id);
        }

    async restoreSubmissionRequest(document, context) {
        const aSubmissionRequest = await this.getSubmissionRequestById(document._id);
        verifySubmissionRequest(aSubmissionRequest)
            .notEmpty()
            .state([CANCELED, DELETED]);

        const userInfo = context?.userInfo;
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CANCEL);
        if (userScope.isNoneScope() || (!userScope.isOwnScope() && !userScope.isAllScope())) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        const isSubmissionRequestOwned = userInfo?._id === aSubmissionRequest?.applicant?.applicantID;
        if (userScope.isOwnScope() && !isSubmissionRequestOwned) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        if (!this._hasValidRestoreHistory(aSubmissionRequest)) {
            throw new Error(ERROR.INVALID_SUBMISSION_REQUEST_RESTORE_STATE);
        }
        if (!(await this._computeCanBeRestored(aSubmissionRequest))) {
            throw new Error(ERROR.INVALID_SUBMISSION_REQUEST_RESTORE_NEWER_REVISION_EXISTS);
        }
        const prevStatus = aSubmissionRequest?.history?.at(-2)?.status;
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, prevStatus, document?.comment);
        const updated = await this.submissionRequestDAO.update({
            _id: aSubmissionRequest._id,
            status: prevStatus,
            updatedAt: history.dateTime,
            history: [...(aSubmissionRequest.history || []), history]
        });

        if (updated) {
            await this._sendRestoreSubmissionRequestEmail(aSubmissionRequest);
        } else {
            console.error(ERROR.FAILED_RESTORE_SUBMISSION_REQUEST, `${aSubmissionRequest._id}`);
            throw new Error(ERROR.FAILED_RESTORE_SUBMISSION_REQUEST);
        }
        return await this.getSubmissionRequestById(aSubmissionRequest._id);
    }

    async approveSubmissionRequest(document, context) {
        await this.verifyReviewerPermission(context);
        const submissionRequest = await this.getSubmissionRequestById(document._id);
        // In Reviewed -> Approved
        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);

        const questionnaire = getSubmissionRequestQuestionnaire(submissionRequest);
        const sequenceNumber = submissionRequest?.sequenceNumber ?? 1;
        const [predecessor, existingProgram, duplicatePrograms] = await Promise.all([
            this.submissionRequestDAO.findApprovedParentSubmissionRequestByID(submissionRequest._id),
            this.programService.getProgramByID(questionnaire?.program?._id, false),
            this.programService.findOneByProgramName(submissionRequest?.programName),
            (async () => {
                submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest?.version);
            })()
        ]);

        const isRevisionReapproval = Boolean(predecessor && sequenceNumber > 1);
        const duplicates = await this.approvedStudiesService.findByStudyName(submissionRequest?.studyName);
        let existingStudy = null;
        if (isRevisionReapproval) {
            existingStudy = await this.approvedStudiesService.findBySubmissionRequestID(
                predecessor._id ?? predecessor.id
            );
            // Revision re-approval: linked via nextRevisionId from an Approved parent.
            if (!existingStudy && duplicates.length > 0) {
                existingStudy = duplicates[0];
            }
        }

        // Duplicate study-name protection; exempt the existing study on revision re-approval.
        const existingStudyID = existingStudy?._id ?? existingStudy?.id;
        const conflict = duplicates.find((dup) => (dup?._id ?? dup?.id) !== existingStudyID);
        if (conflict) {
            throw new Error(replaceErrorString(ERROR.DUPLICATE_APPROVED_STUDY_NAME, `'${submissionRequest?.studyName}'`));
        }

        // Duplicate program protection on first approval only; revision re-approval does not upsert programs.
        if (!isRevisionReapproval && !(existingProgram?._id) && duplicatePrograms) {
            throw new Error(replaceErrorString(ERROR.DUPLICATE_PROGRAM_NAME, `'${submissionRequest?.programName}'`));
        }

        const history = HistoryEventBuilder.createEvent(context.userInfo._id, APPROVED, document.comment);
        const updated = await this.submissionRequestDAO.update({
            _id: submissionRequest._id,
            reviewComment: document.comment,
            wholeProgram: document.wholeProgram,
            status: APPROVED,
            updatedAt: history.dateTime,
            version: submissionRequest.version,
            history: [...(submissionRequest.history || []), history]
        });
        if (!updated) {
            throw new Error(ERROR.UPDATE_FAILED);
        }
        const isControlledAccess = questionnaire?.accessTypes?.includes("Controlled Access");
        const isDbGapMissing = isControlledAccess && !questionnaire?.study?.dbGaPPPHSNumber;
        const resolvedGPAName = PendingGPA.resolveGPAName(updated?.GPAName, isControlledAccess);
        const isPendingGPA = isControlledAccess && !resolvedGPAName?.trim();
        const isPendingImageDeIdentification = isTrue(document?.pendingImageDeIdentification);
        let promises = [];

        promises.push(this.institutionService.addNewInstitutions(submissionRequest?.newInstitutions));
        promises.push(this.sendEmailAfterApproveSubmissionRequest(context, submissionRequest, document?.comment, isDbGapMissing, isTrue(document?.pendingModelChange), isPendingGPA, isPendingImageDeIdentification));
        if (updated) {
            promises.unshift(this.getSubmissionRequestById(document._id));
            if (questionnaire && !isRevisionReapproval) {
                const [name, abbreviation, description] = [submissionRequest?.programName, submissionRequest?.programAbbreviation, submissionRequest?.programDescription];
                let program = existingProgram;
                if (name?.trim()?.length > 0 && !existingProgram?._id) {
                    // Await program creation before creating approved study to avoid race condition
                    program = await this.programService.upsertByProgramName(name, abbreviation, description);
                }
                const newApprovedStudy = await this.approvedStudiesService.saveApprovedStudyFromSubmissionRequest(
                    updated,
                    questionnaire,
                    document?.pendingModelChange,
                    document?.pendingImageDeIdentification,
                    isPendingGPA,
                    program,
                    null
                );
                // added approved studies into user collection
                const applicants = await this._findUsersByApplicantIDs([submissionRequest]);
                if (applicants?.length > 0) {
                    const applicant = applicants[0];
                    const { _id, ...updateUser } = applicant;
                    const currStudyIDs = applicant?.studies?.map((study)=> study?._id) || [];
                    const approvedStudyId = newApprovedStudy?._id;
                    if (!approvedStudyId) {
                        throw new Error(ERROR.FAILED_APPROVED_STUDY_INSERTION);
                    }
                    const newStudiesIDs = currStudyIDs.includes(approvedStudyId)
                        ? currStudyIDs
                        : [approvedStudyId, ...currStudyIDs];
                    promises.push(this.userService.updateUserInfo(
                        applicant, updateUser, _id, applicant?.userStatus, applicant?.role, newStudiesIDs));
                }
            } else if (isRevisionReapproval && existingStudy && questionnaire) {
                // Revision re-approval: refresh the existing approved study from the current submissionRequest
                // (and relink applicationID to this revision), without touching studyName, studyAbbreviation,
                // or program-related fields.
                promises.push(this.approvedStudiesService.updateReapprovedStudy(
                    existingStudy,
                    updated,
                    questionnaire,
                    document?.pendingModelChange,
                    document?.pendingImageDeIdentification,
                    isPendingGPA
                ));
            }
            promises.push(this.logCollection.insert(
                UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, APPROVED)
            ));
        }
        const results = await Promise.all(promises);
        const submissionRequestResult = results[0];
        if (this._isApprovedSubmissionRequest(submissionRequestResult)) {
            await this._checkConditionalApproval(submissionRequestResult);
        }
        return submissionRequestResult;
    }

    async rejectSubmissionRequest(document, context) {
        await this.verifyReviewerPermission(context);
        const submissionRequest = await this.getSubmissionRequestById(document._id);
        // In Reviewed or Submitted -> Inquired
        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest?.version);
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, REJECTED, document.comment);
        const updated = await this.submissionRequestDAO.update({
            _id: submissionRequest._id,
            reviewComment: document.comment,
            status: REJECTED,
            updatedAt: history.dateTime,
            version: submissionRequest.version,
            history: [...(submissionRequest.history || []), history]
        });

        await sendEmails.rejectSubmissionRequest(this.notificationService, this.userService, this.emailParams, submissionRequest, document.comment);
        if (updated) {
            const log = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, REJECTED);
            const promises = [
                await this.getSubmissionRequestById(document._id),
                this.logCollection.insert(log)
            ];
            return await Promise.all(promises).then(function(results) {
                return results[0];
            });
        }
        return null;
    }

    async inquireSubmissionRequest(document, context) {
        await this.verifyReviewerPermission(context);
        const submissionRequest = await this.getSubmissionRequestById(document._id);
        // In Reviewed or Submitted -> Inquired
        verifySubmissionRequest(submissionRequest)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        // auto upgrade version
        submissionRequest.version = await this._getSubmissionRequestVersionByStatus(submissionRequest.status, submissionRequest.version);
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, INQUIRED, document.comment);
        const updated = await this.submissionRequestDAO.update({
            _id: submissionRequest._id,
            reviewComment: document.comment,
            status: INQUIRED,
            updatedAt: history.dateTime,
            version: submissionRequest.version,
            history: [...(submissionRequest.history || []), history]
        });
        await sendEmails.inquireSubmissionRequest(this.notificationService, this.userService, submissionRequest, document?.comment);
        if (updated) {
            const log = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, submissionRequest._id, submissionRequest.status, INQUIRED);
            const promises = [
                await this.getSubmissionRequestById(document._id),
                this.logCollection.insert(log)
            ];
            return await Promise.all(promises).then(function(results) {
                return results[0];
            });
        }
        return null;
    }

    async deleteInactiveSubmissionRequests() {
        try {
            const utilityService = new UtilityService();
            // default retention window and new short window for blank 'New' SRFs
            const defaultDays = this.emailParams.inactiveDays;
            const shortDays = this.emailParams.inactiveNewApplicationDays || 30;

            // Fetch both sets and merge, preferring entries from the default set
            const [defaultApps, shortApps] = await Promise.all([
                this.submissionRequestDAO.getInactiveSubmissionRequest(defaultDays),
                this.submissionRequestDAO.getInactiveSubmissionRequest(shortDays)
            ]);

            const appsMap = new Map();
            (defaultApps || []).forEach(a => appsMap.set(a._id, a));
            (shortApps || []).forEach(a => {
                // Only consider truly blank SRFs in the 'New' status for the short window
                if (a.status === NEW && utilityService.isEmptySubmissionRequest(a) && !appsMap.has(a._id)) {
                    // mark that this record should use the short window when sending emails
                    a._useShortWindow = true;
                    appsMap.set(a._id, a);
                }
            });

            const submissionRequests = Array.from(appsMap.values());

            // Handle undefined/null/empty submissionRequests gracefully
            if (!submissionRequests?.length) {
                console.log("No inactive submission requests found to delete");
                return;
            }

            console.log(`Found ${submissionRequests.length} inactive submission requests to process`);

            const [applicantUsers, BCCUsers] = await Promise.all([
                this._findUsersByApplicantIDs(submissionRequests),
                this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DELETE],
                    [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN]),
            ]);

            const permittedUserIDs = new Set(
                applicantUsers
                    ?.filter((u) => u?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_DELETE))
                    ?.map((u) => u?._id)
            );
            const history = HistoryEventBuilder.createEvent("", DELETED, this._DELETE_REVIEW_COMMENT);

            // Use Promise.allSettled to handle partial failures gracefully
            const updateResults = await Promise.allSettled(submissionRequests.map(async (app) => {
                if (utilityService.isEmptySubmissionRequest(app) && app.status === NEW) {
                    const deleted = await this.submissionRequestDAO.delete(app._id);
                    return deleted;
                }
                const result = await this.submissionRequestDAO.update({
                    _id: app._id,
                    status: DELETED,
                    updatedAt: history.dateTime,
                    inactiveReminder: true,
                    history: [...(app.history || []), history]
                });
                return result;
            }));

            // Count successful updates
            const successfulUpdates = updateResults.filter(result => result.status === 'fulfilled').length;
            const failedUpdates = updateResults.filter(result => result.status === 'rejected').length;

            if (failedUpdates > 0) {
                console.error(`Failed to update ${failedUpdates} submission requests:`, 
                    updateResults.filter(result => result.status === 'rejected').map(result => result.reason));
            }

            if (successfulUpdates > 0) {
                console.log(`Successfully processed ${successfulUpdates} inactive submission requests`);

                // Filter submissionRequests to only include those that were successfully updated
                const successfullyUpdatedSubmissionRequests = submissionRequests.filter((app, index) => {
                    const updateResult = updateResults[index];
                    return updateResult && updateResult.status === 'fulfilled';
                });

                // Use Promise.allSettled for email notifications - only for successfully updated submissionRequests
                const emailResults = await Promise.allSettled(successfullyUpdatedSubmissionRequests.map(async (app) => {
                    if (permittedUserIDs.has(app?.applicantID)) {
                        const localEmailParams = {
                            ...this.emailParams,
                            inactiveDays: app._useShortWindow ? (this.emailParams.inactiveNewApplicationDays || shortDays) : this.emailParams.inactiveDays
                        };
                        await sendEmails.inactiveSubmissionRequests(this.notificationService, localEmailParams, app?.applicant?.applicantEmail, app?.applicant?.applicantName, app, getUserEmails(BCCUsers));
                    }
                }));

                const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;
                const failedEmails = emailResults.filter(result => result.status === 'rejected').length;

                if (failedEmails > 0) {
                    console.error(`Failed to send ${failedEmails} email notifications:`, 
                        emailResults.filter(result => result.status === 'rejected').map(result => result.reason));
                }

                console.log(`Sent ${successfulEmails} email notifications for inactive submission requests`);

                // Use Promise.allSettled for log insertions - only for successfully updated submission requests
                const logResults = await Promise.allSettled(successfullyUpdatedSubmissionRequests.map(async (app) => {
                    this.logCollection.insert(UpdateApplicationStateEvent.createByApp(app._id, app.status, DELETED));
                }));

                const successfulLogs = logResults.filter(result => result.status === 'fulfilled').length;
                const failedLogs = logResults.filter(result => result.status === 'rejected').length;

                if (failedLogs > 0) {
                    console.error(`Failed to log ${failedLogs} submission request deletions:`, 
                        logResults.filter(result => result.status === 'rejected').map(result => result.reason));
                }

                console.log(`Logged ${successfulLogs} submission request deletions`);
            }
        } catch (error) {
            console.error("Error in deleteInactiveSubmissionRequests task:", error);
            throw error; // Re-throw to be caught by cron job handler
        }
    }

    async remindSubmissionRequestSubmission() {
        // The system sends reminder emails for both the default window and the short-window for blank 'New' SRFs.
        const defaultDays = this.emailParams.inactiveDays;
        const shortDays = this.emailParams.inactiveNewApplicationDays || 30;

        // Final (24 hour) reminders for default and short windows
        const [finalDefault, finalShort] = await Promise.all([
            this.submissionRequestDAO.getInactiveSubmissionRequest(defaultDays - 1, this._FINAL_INACTIVE_REMINDER),
            this.submissionRequestDAO.getInactiveSubmissionRequest(shortDays - 1, this._FINAL_INACTIVE_REMINDER)
        ]);

        // Send final reminders for default window
        if (finalDefault?.length > 0) {
            await Promise.all(finalDefault.map(async (aSubmissionRequest) => {
                await this._sendEmailFinalInactiveSubmissionRequest(aSubmissionRequest, defaultDays);
            }));
            const submissionRequestIDs = finalDefault.map(submissionRequest => submissionRequest._id);
            const query = {_id: {$in: submissionRequestIDs}};
            const everyReminderDays = this._getEveryReminderQuery(this.emailParams.inactiveApplicationNotifyDays, true);
            const updatedReminder = await this.submissionRequestDAO.updateMany(query, everyReminderDays);
            if (!updatedReminder?.matchedCount) {
                console.error("The email reminder flag intended to notify the inactive submission request (FINAL) is not being stored", `submissionRequestIDs: ${submissionRequestIDs.join(', ')}`);
            }
        }

        // Send final reminders for short window, but only for blank 'New' SRFs
        if (finalShort?.length > 0) {
            const utilityService = new UtilityService();
            const shortFinalToSend = finalShort.filter(a => a.status === NEW && utilityService.isEmptySubmissionRequest(a));
            await Promise.all(shortFinalToSend.map(async (aSubmissionRequest) => {
                await this._sendEmailFinalInactiveSubmissionRequest(aSubmissionRequest, shortDays);
            }));
            const submissionRequestIDs = shortFinalToSend.map(submissionRequest => submissionRequest._id);
            if (submissionRequestIDs.length > 0) {
                const query = {_id: {$in: submissionRequestIDs}};
                const everyReminderDays = this._getEveryReminderQuery(this.emailParams.inactiveApplicationNotifyDays, true);
                const updatedReminder = await this.submissionRequestDAO.updateMany(query, everyReminderDays);
                if (!updatedReminder?.matchedCount) {
                    console.error("The email reminder flag intended to notify the inactive submission request (FINAL) is not being stored", `submissionRequestIDs: ${submissionRequestIDs.join(', ')}`);
                }
            }
        }

        // Build list of reminders for notification intervals for default and short windows
        const reminderEntries = [];
        for (const day of this.emailParams.inactiveApplicationNotifyDays) {
            const pastDefault = defaultDays - day;
            const appsDefault = await this.submissionRequestDAO.getInactiveSubmissionRequest(pastDefault, `${this._INACTIVE_REMINDER}_${day}`);
            reminderEntries.push(...(appsDefault || []).map(a => ({ submissionRequest: a, pastDays: pastDefault, baseDays: defaultDays })));

            // Only query short window for intervals strictly less than shortDays to avoid zero/negative pastDays
            if (day < shortDays) {
                const pastShort = shortDays - day;
                const appsShort = await this.submissionRequestDAO.getInactiveSubmissionRequest(pastShort, `${this._INACTIVE_REMINDER}_${day}`);
                if (appsShort && appsShort.length > 0) {
                    const utilityService = new UtilityService();
                    // only include blank New SRFs from short-window
                    reminderEntries.push(...appsShort.filter(a => a.status === NEW && utilityService.isEmptySubmissionRequest(a)).map(a => ({ submissionRequest: a, pastDays: pastShort, baseDays: shortDays })));
                }
            }
        }

        if (reminderEntries.length > 0) {
            // Sort by pastDays descending (older first) and dedupe by submissionRequest id
            reminderEntries.sort((a, b) => b.pastDays - a.pastDays);
            const seen = new Set();
            const toSend = [];
            for (const entry of reminderEntries) {
                if (!seen.has(entry.submissionRequest._id)) {
                    seen.add(entry.submissionRequest._id);
                    toSend.push(entry);
                }
            }

            // Send emails
            await Promise.all(toSend.map(async (entry) => {
                await this._sendEmailInactiveSubmissionRequest(entry.submissionRequest, entry.pastDays, entry.baseDays);
            }));

            // Update reminder flags based on baseDays
            for (const entry of toSend) {
                const submissionRequestID = entry.submissionRequest._id;
                const pastDays = entry.pastDays;
                const expiredDays = entry.baseDays - pastDays;
                const submissionReminderDays = this.emailParams.inactiveApplicationNotifyDays;
                const reminderDays = submissionReminderDays.filter((d) => expiredDays < d || expiredDays === d);
                const reminderFilter = reminderDays.reduce((acc, day) => {
                    acc[`${this._INACTIVE_REMINDER}_${day}`] = true;
                    return acc;
                }, {});
                const updatedReminder = await this.submissionRequestDAO.update({_id: submissionRequestID, ...reminderFilter});
                if (!updatedReminder) {
                    console.error("The email reminder flag intended to notify the inactive submission request is not being stored", submissionRequestID);
                }
            }
        }
    }

    async _findUsersByApplicantIDs(submissionRequests) {
        const applicantIDs = submissionRequests
            ?.map((a) => a?.applicantID) // Extract applicant IDs
            ?.filter(Boolean);

        return await this.userService.findByIDs(applicantIDs);
    }

    async sendEmailAfterApproveSubmissionRequest(context, submissionRequest, comment, isDbGapMissing = false, isPendingModelChange, isPendingGPA = false, isPendingImageDeIdentification = false) {
        const res = await Promise.all([
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]),
            this.userService.findByID(submissionRequest?.applicantID)
        ]);

        const [toBCCUsers, applicantInfo] = res;
        const CCEmails = getCCEmails(submissionRequest?.applicant?.applicantEmail, submissionRequest);
        const toBCCEmails = getUserEmails(toBCCUsers)
            ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const pendingTemplateParams = {
                firstName: submissionRequest?.applicant?.applicantName,
                contactEmail: this.emailParams?.conditionalSubmissionContact,
                reviewComments: comment && comment?.trim()?.length > 0 ? comment?.trim() : "N/A",
                study: setDefaultIfNoName(submissionRequest?.studyName),
                submissionGuideURL: this.emailParams?.submissionGuideURL
            };

            if (!isDbGapMissing && !isPendingModelChange && !isPendingGPA && !isPendingImageDeIdentification) {
                await this.notificationService.approveQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    {
                        firstName: submissionRequest?.applicant?.applicantName,
                        reviewComments: comment && comment?.trim()?.length > 0 ? comment?.trim() : "N/A"
                    },
                    {
                        study: studyLabelForEmailBody(submissionRequest),
                        contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
                    }
                );
                return;
            }

            const pendingCount = [isDbGapMissing, isPendingModelChange, isPendingGPA, isPendingImageDeIdentification].filter(Boolean).length;
            if (pendingCount > 1) {
                await this.notificationService.multipleChangesApproveQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams,
                    isDbGapMissing,
                    isPendingModelChange,
                    isPendingGPA,
                    isPendingImageDeIdentification
                );
                return;
            }

            if (isDbGapMissing) {
                await this.notificationService.dbGapMissingApproveQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingModelChange) {
                await this.notificationService.dataModelChangeApproveQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingGPA) {
                await this.notificationService.pendingGPANotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingImageDeIdentification) {
                await this.notificationService.pendingImageDeIdentificationApproveQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
            }
        }
    }

    async _cancelSubmissionRequestEmailInfo(submissionRequest) {
        const [applicantInfo, BCCUsers] = await Promise.all([
            this.userService.findByID(submissionRequest?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);

        const CCEmails = getCCEmails(submissionRequest?.applicant?.applicantEmail, submissionRequest);
        const toBCCEmails = getUserEmails(BCCUsers)
            ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);

        return [applicantInfo, CCEmails, toBCCEmails];
    }

    async _sendCancelSubmissionRequestEmail(userCanceledBy, submissionRequest) {
        const [applicantInfo, CCEmails, BCCUserEmails] = await this._cancelSubmissionRequestEmailInfo(submissionRequest);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL)) {
            if (!applicantInfo?.email) {
                console.error("Cancel submission request email notification does not have any recipient", `Submission Request ID: ${submissionRequest?._id}`);
                return;
            }
            const canceledByName = [ROLES.ADMIN, ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL].includes(userCanceledBy?.role) ? this._CRDC_TEAM: `${userCanceledBy.firstName} ${userCanceledBy.lastName || ""}`;
            await this.notificationService.cancelSubmissionRequestNotification(applicantInfo?.email, CCEmails, BCCUserEmails, {
                firstName: `${applicantInfo.firstName} ${applicantInfo.lastName || ""}`
            },{
                studyName: `${submissionRequest?.studyName?.trim() || "NA"},`,
                canceledNameBy: canceledByName,
                contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
            });
        }
    }

    async _sendRestoreSubmissionRequestEmail(submissionRequest) {
        const [applicantInfo, CCEmails, BCCUserEmails] = await this._cancelSubmissionRequestEmailInfo(submissionRequest);
        if (!applicantInfo?.email) {
            console.error("Restore submission request email notification does not have any recipient", `Submission Request ID: ${submissionRequest?._id}`);
            return;
        }

        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL)) {
            await this.notificationService.restoreSubmissionRequestNotification(applicantInfo?.email, CCEmails, BCCUserEmails,{
                firstName: `${applicantInfo.firstName} ${applicantInfo.lastName || ""}`
            },{
                studyName: `${submissionRequest?.studyName?.trim() || "NA"},`,
                contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
            });
        }

    }

    /**
     * Sends the reopen notification email to the owner of a reopened submission request.
     * Never throws; failures are logged so they cannot break the reopen workflow.
     * @param {object} submissionRequest Reopened submission request document
     * @param {object} ownerUser Owner of the reopened submissionRequest
     * @param {string} previousOwnerId Owner of the source submissionRequest before reopening
     * @returns {Promise<void>}
     */
    async _sendReopenSubmissionRequestEmail(submissionRequest, ownerUser, previousOwnerId) {
        try {
            const isOwnershipChanged = ownerUser._id !== previousOwnerId && ownerUser.id !== previousOwnerId;
            const [ownerInfo, BCCUsers] = await Promise.all([
                this.userService.findByID(ownerUser._id ?? ownerUser.id),
                this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REOPENED],
                    [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
            ]);
            const applicantInfo = ownerInfo ?? ownerUser;

            if (!applicantInfo?.email) {
                console.error("Reopen submission request email notification does not have any recipient", `Submission Request ID: ${submissionRequest?._id}`);
                return;
            }

            if (!applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REOPENED)) {
                return;
            }

            const CCEmails = getCCEmails(applicantInfo?.email, submissionRequest);
            // Include previous owner in CC if ownership changed
            if (isOwnershipChanged && previousOwnerId) {
                const previousOwner = await this.userService.findByID(previousOwnerId);
                if (previousOwner?.email && EMAIL_REGEX.test(previousOwner.email) && !CCEmails.includes(previousOwner.email) && previousOwner.email !== applicantInfo.email) {
                    CCEmails.push(previousOwner.email);
                }
            }

            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);

            await this.notificationService.reopenSubmissionRequestNotification(applicantInfo.email, CCEmails, toBCCEmails, {
                firstName: `${applicantInfo.firstName} ${applicantInfo.lastName || ""}`,
                isOwnershipChanged
            }, {
                studyName: studyLabelForEmailBody(submissionRequest),
                studyAbbreviation: `${submissionRequest?.studyAbbreviation?.trim() || "NA"}`,
                programName: `${submissionRequest?.programName?.trim() || "NA"}`,
                programAbbreviation: `${submissionRequest?.programAbbreviation?.trim() || "NA"}`,
                contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
            });
        } catch (error) {
            console.error(`Failed to send reopen submissionRequest notification email for submission request ${submissionRequest?._id}:`, error.message);
        }
    }

    async _sendEmailFinalInactiveSubmissionRequest(submissionRequest, baseInactiveDays = this.emailParams.inactiveDays) {
        const [aSubmitter, BCCUsers] = await Promise.all([
            this.userService.getUserByID(submissionRequest?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);

        const filteredBCCUsers = BCCUsers.filter((u) => u?._id !== aSubmitter?._id);
        if (!aSubmitter?.email) {
            console.log("The final inactive submissionRequest reminder was not sent.", `Submission Request ID: ${submissionRequest?._id}`);
            return;
        }

        if (aSubmitter?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING)) {
            const applicant = await this.userDAO.findFirst({_id: submissionRequest?.applicantID});
            const CCEmails = getCCEmails(applicant?.email, submissionRequest);
            const toBCCEmails = getUserEmails(filteredBCCUsers)
                ?.filter((email) => !CCEmails.includes(email));
            await this.notificationService.finalRemindSubmissionRequestsNotification(aSubmitter?.email,
                CCEmails,
                toBCCEmails, {
                    firstName: `${aSubmitter?.firstName} ${aSubmitter?.lastName || ''}`,
                    studyName: studyLabelForEmailBody(submissionRequest)
                },{
                    inactiveDays: baseInactiveDays,
                    url: this.emailParams.url
                });
            logDaysDifference(baseInactiveDays - 1, submissionRequest?.updatedAt, submissionRequest?._id);
        }
    }

    async _sendEmailInactiveSubmissionRequest(submissionRequest, interval, baseInactiveDays = this.emailParams.inactiveDays) {
        const [aSubmitter, BCCUsers] = await Promise.all([
            this.userService.getUserByID(submissionRequest?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);

        if (!aSubmitter?.email) {
            console.log("The inactive submissionRequest reminder was not sent.", `${interval} days Submission Request ID: ${submissionRequest?._id}`);
            return;
        }

        if (aSubmitter?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING)) {
            const applicant = await this.userDAO.findFirst({_id: submissionRequest?.applicantID});
            const CCEmails = getCCEmails(applicant?.email, submissionRequest);
            const filteredBCCUsers = BCCUsers.filter((u) => u?._id !== aSubmitter?._id);
            const toBCCEmails = getUserEmails(filteredBCCUsers)
                ?.filter((email) => !CCEmails.includes(email));
            await this.notificationService.remindSubmissionRequestsNotification(aSubmitter?.email,
                CCEmails,
                toBCCEmails, {
                    firstName: `${aSubmitter?.firstName} ${aSubmitter?.lastName || ''}`,
                    studyName: studyLabelForEmailBody(submissionRequest)
                },{
                    remainDays: baseInactiveDays - interval,
                    inactiveDays: interval,
                    url: this.emailParams.url
                });
            logDaysDifference(interval, submissionRequest?.updatedAt, submissionRequest?._id);
        }
    }

    // Generates a query for the status of all email notification reminder.
    _getEveryReminderQuery(remindSubmissionDay, status) {
        return remindSubmissionDay.reduce((acc, day) => {
            acc[`${this._INACTIVE_REMINDER}_${day}`] = status;
            return acc;
        }, {[`${this._FINAL_INACTIVE_REMINDER}`]: status});
    }

    async _saveApprovedStudies(aSubmissionRequest, questionnaire, pendingModelChange, pendingImageDeIdentification, isPendingGPA, existingProgram) {
        // Only the submission request field (user input); do not substitute study name or questionnaire when missing
        const studyAbbreviation = (aSubmissionRequest?.studyAbbreviation ?? "").trim();
        const controlledAccess = aSubmissionRequest?.controlledAccess;
        if (isUndefined(controlledAccess)) {
            console.error(ERROR.SUBMISSION_REQUEST_CONTROLLED_ACCESS_NOT_FOUND, ` id=${aSubmissionRequest?._id}`);
        }
        const programName = aSubmissionRequest?.programName ?? "NA";
        const resolvedGPAName = PendingGPA.resolveGPAName(aSubmissionRequest?.GPAName, isTrue(controlledAccess));
        const pendingGPA = PendingGPA.create(resolvedGPAName, isPendingGPA);
        
        // Use the existing program ID from the questionnaire lookup
        const programID = existingProgram?._id || null;
      
        // Clean dbGaPPPHSNumber to only store the base "phs######"
        const trimmedDbGaP = String(questionnaire?.study?.dbGaPPPHSNumber ?? "").trim();
        const baseDbGaP = trimmedDbGaP.match(/^phs\d{6}/i)?.[0]?.toLowerCase() ?? null;

        // Upon approval of the submission request, the data concierge is retrieved from the associated program.
        // These two parameters for storeApprovedStudies will be constant here, saved to variables for clarity.
        const useProgramPC = true;
        const primaryContactID = null;
        return await this.approvedStudiesService.storeApprovedStudies(
            aSubmissionRequest?._id, aSubmissionRequest?.studyName, studyAbbreviation, baseDbGaP, aSubmissionRequest?.organization?.name, controlledAccess, aSubmissionRequest?.ORCID,
            aSubmissionRequest?.PI, aSubmissionRequest?.openAccess, useProgramPC, pendingModelChange, primaryContactID, pendingGPA, programID, pendingImageDeIdentification
        );
    }

    async verifyReviewerPermission(context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.REVIEW);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
    }

    async _updateSubmissionRequest(submissionRequest, prevStatus, userID) {
        if (prevStatus !== submissionRequest.status) {
            submissionRequest = {history: [], ...submissionRequest};
            const historyEvent = HistoryEventBuilder.createEvent(userID, submissionRequest.status, null);
            submissionRequest.history.push(historyEvent);
        }
        // Save an email reminder when an inactive submissionRequest is reactivated.
        submissionRequest.inactiveReminder = false;
        submissionRequest.updatedAt = getCurrentTime();
        const {applicant, ...data} = submissionRequest;
        const updateResult = await this.submissionRequestDAO.update({_id: submissionRequest?._id, ...data});
        if (!updateResult) {
            throw new Error(ERROR.SUBMISSION_REQUEST_NOT_FOUND + updateResult?._id);
        }
        return updateResult;
    }
}

async function logStateChange(logCollection, userInfo, submissionRequest, prevStatus) {
    await logCollection.insert(
        UpdateApplicationStateEvent.create(
            userInfo?._id, userInfo?.email, userInfo?.IDP, submissionRequest?._id, prevStatus, submissionRequest?.status
        )
    );
}

const setDefaultIfNoName = (str) => {
    const name = str?.trim() ?? "";
    return (name.length > 0) ? (name) : "NA";
}

/**
 * Label for `$study`-style message variables and notification template `studyName`.
 * Resolves via `setDefaultIfNoName`. This maps empty or whitespace-only results
 * to the literal string `NA`, so callers and templates always get a non-empty value (e.g. blank
 * New submission requests). Inquire/PV Study Abbreviation lines use `defaultStudyAbbreviationToNA` separately.
 * @param {{ studyName?: string }} [submissionRequest]
 * @returns {string} Full study name, or `NA`
 */
function studyLabelForEmailBody(submissionRequest) {
    return setDefaultIfNoName(submissionRequest?.studyName);
}

const getCCEmails = (submitterEmail, submissionRequest) => {
    const questionnaire = getSubmissionRequestQuestionnaire(submissionRequest);
    if (!questionnaire || !submitterEmail) {
        return [];
    }
    const CCEmailsSet = new Set([questionnaire?.primaryContact?.email, questionnaire?.pi?.email]
        .filter((email) => email && email !== submitterEmail && EMAIL_REGEX.test(email)));
    return Array.from(CCEmailsSet);
}

const sendEmails = {
    inactiveSubmissionRequests: async (notificationService, emailParams, email, applicantName, submissionRequest, BCCEmails) => {
        try {
            const studyLabel = studyLabelForEmailBody(submissionRequest);
            const CCEmails = getCCEmails(email, submissionRequest);
            const toBCCEmails = BCCEmails
                ?.filter((BCCEmail) => !CCEmails.includes(BCCEmail) && BCCEmail !== email);
            await notificationService.inactiveSubmissionRequestsNotification(email,
                CCEmails,
                toBCCEmails, {
                firstName: applicantName,
                studyName: studyLabel
            },{
                pi: `${applicantName}`,
                study: studyLabel,
                officialEmail: `${emailParams.officialEmail}.`,
                inactiveDays: emailParams.inactiveDays,
                url: emailParams.url
            });
            logDaysDifference(emailParams.inactiveDays, submissionRequest?.updatedAt, submissionRequest?._id);
        } catch (error) {
            console.error(`Failed to send inactive submission request notification email to ${email} for submission request ${submissionRequest?._id}:`, error.message);
            throw error; // Re-throw to be handled by Promise.allSettled
        }
    },
    submitSubmissionRequest: async (notificationService, userService, emailParams, userInfo, submissionRequest) => {
        const applicantInfo = await userService.findByID(submissionRequest?.applicant?.applicantID);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_SUBMIT)) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_SUBMIT],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN]);
            const CCEmails = getCCEmails(submissionRequest?.applicant?.applicantEmail, submissionRequest);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);

            await notificationService.submitRequestReceivedNotification(submissionRequest?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails,
                {helpDesk: `${emailParams.conditionalSubmissionContact}.`},
                {userName: submissionRequest?.applicant?.applicantName}
            );
        }

        const toUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_READY_REVIEW],
            [ROLES.FEDERAL_LEAD]);

        if (!toUsers || toUsers?.length === 0) {
            console.error("SR for Submit email notification does not have any recipient", `Submission Request ID: ${submissionRequest?._id}`);
            return;
        }
        if (toUsers?.length > 0) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_READY_REVIEW],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN]);
            const toEmails = getUserEmails(toUsers);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !toEmails?.includes(email));
            const programName = submissionRequest?.programName?.trim() || "NA";
            await notificationService.submitQuestionNotification(getUserEmails(toUsers),
                [],
                toBCCEmails, {
                pi: `${setDefaultIfNoName(submissionRequest?.PI)}${programName === "NA" ? "." : `, and associated with the ${programName} program.`}`,
                study: studyLabelForEmailBody(submissionRequest),
                url: emailParams.url
            });
        }
    },
    inquireSubmissionRequest: async (notificationService, userService, submissionRequest, reviewComments) => {
        const res = await Promise.all([
            userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]),
            userService.findByID(submissionRequest?.applicant?.applicantID)
        ]);
        const [toBCCUsers, applicantInfo] = res;
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const CCEmails = getCCEmails(submissionRequest?.applicant?.applicantEmail, submissionRequest);
            const toBCCEmails = getUserEmails(toBCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
            const studyName = setDefaultIfNoName(submissionRequest?.studyName);
            const studyAbbreviation = defaultStudyAbbreviationToNA(submissionRequest?.studyAbbreviation);
            await notificationService.inquireQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails,{
                firstName: submissionRequest?.applicant?.applicantName,
                reviewComments,
                studyName,
                studyAbbreviation,
            }, {});
        }
    },
    rejectSubmissionRequest: async(notificationService, userService, emailParams, submissionRequest, reviewComments) => {
        const applicantInfo = await userService.findByID(submissionRequest?.applicant?.applicantID);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]);
            const CCEmails = getCCEmails(submissionRequest?.applicant?.applicantEmail, submissionRequest);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
            await notificationService.rejectQuestionNotification(submissionRequest?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails, {
                firstName: submissionRequest?.applicant?.applicantName,
                reviewComments
            }, {
                study: `${studyLabelForEmailBody(submissionRequest)},`
            });
        }
    }
}


const getUserEmails = (users) => {
    return users
        ?.filter((aUser) => aUser?.email)
        ?.map((aUser)=> aUser.email);
}

const getSubmissionRequestQuestionnaire = (aSubmissionRequest) => {
    const questionnaire = parseJsonString(aSubmissionRequest?.questionnaireData);
    if (!questionnaire) {
        console.error(ERROR.FAILED_STORE_APPROVED_STUDIES + ` id=${aSubmissionRequest?._id}`);
        return null;
    }
    return questionnaire;
}

function logDaysDifference(inactiveDays, accessedAt, submissionRequestID) {
    const startedDate = accessedAt; // Ensure it's a Date object
    const endDate = getCurrentTime();
    const differenceMs = endDate - startedDate; // Difference in milliseconds
    const days = Math.floor(differenceMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((differenceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((differenceMs % (1000 * 60 * 60)) / (1000 * 60));
    console.log(`Submission Request ID: ${submissionRequestID}, Inactive Days: ${inactiveDays}, Last Accessed: ${startedDate}, Current Time: ${endDate}  Difference: ${days} days, ${hours} hours, ${minutes} minutes`);
}

module.exports = {
    SubmissionRequest,
    VALID_ORDER_BY_LIST_SUBMISSION_REQUESTS
};
