const {SUBMITTED, APPROVED, REJECTED, IN_PROGRESS, IN_REVIEW, DELETED, CANCELED, NEW, INQUIRED, REOPENED} = require("../constants/application-constants");
const {v4} = require('uuid')
const {getCurrentTime, subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {HistoryEventBuilder} = require("../domain/history-event");
const {verifyApplication} = require("../verifier/application-verifier");
const {verifySession} = require("../verifier/user-info-verifier");
const ERROR = require("../constants/error-constants");
const USER_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-constants");
const {CreateApplicationEvent, UpdateApplicationStateEvent} = require("../crdc-datahub-database-drivers/domain/log-events");
const ROLES = USER_CONSTANTS.USER.ROLES;
const {parseJsonString, isTrue} = require("../crdc-datahub-database-drivers/utility/string-utility");
const {replaceErrorString} = require("../utility/string-util");
const {defaultStudyAbbreviationToStudyName, defaultStudyAbbreviationToNA} = require("../utility/study-abbrev-helpers");
const {EMAIL_NOTIFICATIONS} = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const {UserScope} = require("../domain/user-scope");
const {UtilityService} = require("../services/utility");
const InstitutionDAO = require("../dao/institution");
const ApplicationDAO = require("../dao/application");
const {PrismaPagination} = require("../crdc-datahub-database-drivers/domain/prisma-pagination");
const UserDAO = require("../dao/user");
const {formatName} = require("../utility/format-name");
const {
    REOPEN_ASSIGNABLE_ROLES,
    hasSubmissionRequestCreatePermission,
} = require("../utility/reopen-owner-utility");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INSTITUTION_NAME_LENGTH = 100;
// Valid orderBy values for listApplications (Prisma field names). "applicant.applicantName" is accepted and mapped to "applicant.fullName".
const VALID_ORDER_BY_LIST_APPLICATIONS = [
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

class Application {
    _DELETE_REVIEW_COMMENT="This Submission Request has been deleted by the system due to inactivity.";
    _ALL_FILTER="All";
    _FINAL_INACTIVE_REMINDER = "finalInactiveReminder";
    _INACTIVE_REMINDER = "inactiveReminder";
    _CRDC_TEAM = "the CRDC team";
    constructor(logCollection, applicationCollection, approvedStudiesService, userService, dbService, notificationsService, emailParams, organizationService, institutionService, configurationService, authorizationService) {
        this.logCollection = logCollection;
        this.approvedStudiesService = approvedStudiesService;
        this.userService = userService;
        this.notificationService = notificationsService;
        this.emailParams = emailParams;
        this.organizationService = organizationService;
        this.institutionService = institutionService;
        this.configurationService = configurationService;
        this.authorizationService = authorizationService;
        this.institionDAO = new InstitutionDAO()
        this.applicationDAO = new ApplicationDAO(applicationCollection);
        this.userDAO = new UserDAO();
        this._VALID_LIST_APPLICATION_STATUSES = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, APPROVED, INQUIRED, REOPENED, REJECTED, CANCELED, DELETED, this._ALL_FILTER];
    }

    _normalizeApplicationStatus(status) {
        return String(status ?? "").trim().toLowerCase();
    }

    _isApprovedApplication(application) {
        return this._normalizeApplicationStatus(application?.status) === this._normalizeApplicationStatus(APPROVED);
    }

    _isTerminalRevisionStatus(status) {
        const normalized = this._normalizeApplicationStatus(status);
        return TERMINAL_REVISION_STATUSES.some(
            (terminalStatus) => this._normalizeApplicationStatus(terminalStatus) === normalized
        );
    }

    /**
     * Loads status for the immediate revision successor (minimal DB read).
     * @param {string} revisionID Successor application _id
     * @returns {Promise<{ status: string }|null>}
     */
    async _loadRevisionChainSuccessor(revisionID) {
        try {
            return await this.applicationDAO.findApplicationStatusById(revisionID);
        } catch (err) {
            console.error('Failed to load revision successor while checking active later revisions:', revisionID, err);
            throw new Error(ERROR.INTERNAL_ERROR);
        }
    }

    /**
     * Returns true when the immediate revision successor has a non-terminal status.
     * @param {object} application Application document that may have nextRevisionId
     * @param {string|undefined|null} successorStatus Status of the direct successor, when known
     * @returns {boolean}
     */
    _hasSuccessorWithNonTerminalStatus(application, successorStatus) {
        const nextRevisionID = application?.nextRevisionId;
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
     * @param {object} application Application document that may have nextRevisionId
     * @returns {Promise<boolean>}
     */
    async _hasActiveLaterRevisions(application) {
        const nextRevisionID = application?.nextRevisionId;
        if (!nextRevisionID) {
            return false;
        }
        const successor = await this._loadRevisionChainSuccessor(nextRevisionID);
        return this._hasSuccessorWithNonTerminalStatus(application, successor?.status);
    }

    /**
     * True when an Approved parent SRF links to this application via nextRevisionId.
     * @param {object} application Candidate application
     * @returns {Promise<boolean>}
     */
    async _hasApprovedParentSRF(application) {
        const applicationID = application?._id ?? application?.id;
        if (!applicationID) {
            return false;
        }
        const parent = await this.applicationDAO.findApprovedParentSubmissionRequestByID(applicationID);
        return Boolean(parent);
    }

    /**
     * True when Approved and the immediate successor (if linked) is absent or terminal.
     * Returns the existing boolean when already set on the application (response-only field).
     * @param {object} application Application document
     * @returns {Promise<boolean>}
     */
    async _computeCanBeReopened(application) {
        if (typeof application?.canBeReopened === 'boolean') {
            return application.canBeReopened;
        }
        if (!this._isApprovedApplication(application)) {
            return false;
        }
        return !(await this._hasActiveLaterRevisions(application));
    }

    /**
     * True when history supports restore (prior state exists and latest entry is Canceled/Deleted).
     * @param {object} application Application document
     * @returns {boolean}
     */
    _hasValidRestoreHistory(application) {
        const history = application?.history;
        if ((history?.length ?? 0) < 2) {
            return false;
        }
        return [CANCELED, DELETED].includes(history.at(-1)?.status);
    }

    /**
     * True when status is Canceled or Deleted and history supports restore.
     * @param {object} application Application document
     * @returns {boolean}
     */
    _isRestoreCandidate(application) {
        const status = this._normalizeApplicationStatus(application?.status);
        const isCanceledOrDeleted = [CANCELED, DELETED].some(
            (terminalStatus) => this._normalizeApplicationStatus(terminalStatus) === status
        );
        return isCanceledOrDeleted && this._hasValidRestoreHistory(application);
    }

    /**
     * True when restoreApplication would succeed for this application.
     * @param {object} application Application document
     * @param {boolean} hasApprovedParent Whether an Approved parent links to this application
     * @returns {boolean}
     */
    _computeCanBeRestoredFromParentCheck(application, hasApprovedParent) {
        if (typeof application?.canBeRestored === 'boolean') {
            return application.canBeRestored;
        }
        if (!this._isRestoreCandidate(application)) {
            return false;
        }
        const sequenceNumber = application?.sequenceNumber ?? 1;
        if (sequenceNumber === 1) {
            return true;
        }
        return hasApprovedParent;
    }

    /**
     * True when Approved and the immediate successor (if linked) is absent or terminal.
     * @param {object} application Application document
     * @param {Map<string, string>} successorStatusById Prefetched successor id → status map
     * @returns {boolean}
     */
    _computeCanBeReopenedFromSuccessorStatus(application, successorStatusById) {
        if (typeof application?.canBeReopened === 'boolean') {
            return application.canBeReopened;
        }
        if (!this._isApprovedApplication(application)) {
            return false;
        }
        const nextRevisionID = application?.nextRevisionId;
        const successorStatus = nextRevisionID ? successorStatusById.get(nextRevisionID) : undefined;
        return !this._hasSuccessorWithNonTerminalStatus(application, successorStatus);
    }

    /**
     * True when restoreApplication would succeed for this application.
     * Returns the existing boolean when already set on the application (response-only field).
     * @param {object} application Application document
     * @returns {Promise<boolean>}
     */
    async _computeCanBeRestored(application) {
        if (typeof application?.canBeRestored === 'boolean') {
            return application.canBeRestored;
        }
        if (!this._isRestoreCandidate(application)) {
            return false;
        }
        if ((application?.sequenceNumber ?? 1) === 1) {
            return true;
        }
        const hasApprovedParent = await this._hasApprovedParentSRF(application);
        return this._computeCanBeRestoredFromParentCheck(application, hasApprovedParent);
    }

    /**
     * Computes SRF state fields for an application API response (e.g. canBeReopened, canBeRestored).
     * @param {object} application Application document
     * @returns {Promise<object|null>}
     */
    async _computeSRFStateFields(application) {
        if (!application) {
            return application;
        }
        const [canBeReopened, canBeRestored] = await Promise.all([
            this._computeCanBeReopened(application),
            this._computeCanBeRestored(application),
        ]);
        application.canBeReopened = canBeReopened;
        application.canBeRestored = canBeRestored;
        return application;
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
     * canBeReopened / canBeRestored on each application in memory.
     * @param {object[]} applications Paginated application rows from listApplications
     * @returns {Promise<{ studyByLowerName: Map<string, object> }>}
     */
    async _batchComputeListApplicationFields(applications) {
        const studyByLowerName = new Map();
        if (!applications?.length) {
            return { studyByLowerName };
        }

        const successorIds = [...new Set(
            applications
                .filter((app) => this._isApprovedApplication(app) && app.nextRevisionId)
                .map((app) => app.nextRevisionId)
        )];

        const restoreCandidateIds = applications
            .filter((app) => this._isRestoreCandidate(app) && (app?.sequenceNumber ?? 1) > 1)
            .map((app) => app._id ?? app.id)
            .filter(Boolean);

        const studyNamesByLower = new Map();
        for (const app of applications) {
            if (!this._isApprovedApplication(app)) {
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
                ? this.applicationDAO.findApplicationStatusesByIds(successorIds)
                : [],
            restoreCandidateIds.length
                ? this.applicationDAO.findApprovedApplicationsByNextRevisionIds(restoreCandidateIds)
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

        for (const app of applications) {
            if (typeof app?.canBeReopened !== 'boolean') {
                app.canBeReopened = this._computeCanBeReopenedFromSuccessorStatus(app, successorStatusById);
            }
            if (typeof app?.canBeRestored !== 'boolean') {
                const applicationID = app._id ?? app.id;
                const hasApprovedParent = applicationID
                    ? approvedParentSuccessorIds.has(applicationID)
                    : false;
                app.canBeRestored = this._computeCanBeRestoredFromParentCheck(app, hasApprovedParent);
            }
        }

        return { studyByLowerName };
    }

    /**
     * Clears inbound nextRevisionId links (revision chain link removal).
     * @param {string} applicationId Successor application _id whose inbound links should be cleared
     */
    async _pruneRevisionChainOnTerminal(applicationId) {
        if (!applicationId) {
            return;
        }
        try {
            await this.applicationDAO.clearNextRevisionIdPointingTo(applicationId);
        } catch (err) {
            console.error('Failed to clear revision chain link for successor application:', applicationId, err);
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

    async getApplication(params, context) {
        verifySession(context)
            .verifyInitialized()
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        let application = await this.getApplicationById(params._id);
        // add logics to check if conditional approval
        if (this._isApprovedApplication(application)) {
            await this._checkConditionalApproval(application);
        }
        // populate the version with auto upgrade based on configuration
        application.version  = await this._getApplicationVersionByStatus(application.status, application.version);
        return application;
    }

    async _getApplicationVersionByStatus(status, version = null ) {
        const config = await this.configurationService.findByType("APPLICATION_FORM_VERSIONS"); //get version config dynamically
        const currentVersion = config?.current || "2.0";
        const newStatusVersion = config?.new || "3.0";
        // auto upgrade version based on configuration if status is NEW, IN_PROGRESS, INQUIRED
        // for status other than NEW, IN_PROGRESS, INQUIRED, keep original version if exists, else set current version.
        return [NEW, IN_PROGRESS, INQUIRED, REOPENED].includes(status) ? newStatusVersion : (!version)? currentVersion : version;
    }

    /**
     * Computes conditional / pendingConditions from the approved study for this application study name.
     * @returns {Promise<{ conditional: boolean, pendingConditions: string[] }>}
     */
    async _computeConditionalApprovalFields(studyName) {
        const studyArr = await this.approvedStudiesService.findByStudyName(studyName);
        if (!studyArr || studyArr.length < 1) {
            return { conditional: false, pendingConditions: [] };
        }
        return this._resolveConditionalApprovalFields(studyArr[0]);
    }

    async _checkConditionalApproval(application) {
        const { conditional, pendingConditions } = await this._computeConditionalApprovalFields(application.studyName);
        application.conditional = conditional;
        application.pendingConditions = pendingConditions;
    }

    /**
     * Reformats a DB record into an application API response shape and computes response fields.
     * @param {object} record Application document from the database
     * @param {object} [ownerUser] Optional owner user for applicant fields
     * @returns {Promise<object|null>}
     */
    async _reformatRecordForApplicationResponse(record, ownerUser) {
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

    async getApplicationById(id) {
        const result = await this.applicationDAO.findApplicationWithApplicantById(id);
        if (!result) {
            throw new Error(ERROR.APPLICATION_NOT_FOUND+id);
        }

        return await this._reformatRecordForApplicationResponse(result);
    }
    
    async reviewApplication(params, context) {
        await this.verifyReviewerPermission(context);
        const application = await this.getApplication(params, context);
        verifyApplication(application)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        if (application && application.status && application.status === SUBMITTED) {
            // If Submitted status, change it to In Review
            const history = HistoryEventBuilder.createEvent(context.userInfo._id, IN_REVIEW, null);
            const updated = await this.applicationDAO.update({
                _id: application._id,
                status: IN_REVIEW,
                updatedAt: history.dateTime,
                history: [...(application.history || []), history]
            });
            if (updated) {
                const promises = [
                    await this.getApplicationById(params._id),
                    this.logCollection.insert(
                        UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, IN_REVIEW)
                    )
                ];
                return await Promise.all(promises).then(function(results) {
                    return results[0];
                });
            }
        }
        // populate the version with auto upgrade based on configuration
        application.version  = await this._getApplicationVersionByStatus(application.status, application.version);
        return await this._computeSRFStateFields(application) || null;
    }

    async createApplication(application, userInfo, status = NEW) {
        const timestamp = getCurrentTime();

        const history = [HistoryEventBuilder.createEvent(userInfo._id, NEW, null, timestamp)];
        if (status === IN_PROGRESS) {
            // Add an additional 1s to the timestamp to ensure the events can be correctly sorted
            const eventTime = new Date(timestamp.getTime() + 1000);
            history.push(HistoryEventBuilder.createEvent(userInfo._id, IN_PROGRESS, null, eventTime));
        }

        let newApplicationProperties = {
            _id: v4(undefined, undefined, undefined),
            status,
            controlledAccess: application?.controlledAccess,
            applicantID: userInfo._id,
            history,
            createdAt: timestamp,
            updatedAt: timestamp,
            programAbbreviation: application?.programAbbreviation,
            programDescription: application?.programDescription,
            version: (application?.version)? application.version : await this._getApplicationVersionByStatus(status),
            inactiveReminder: false, // If deleted, it will set true
            inactiveReminder_7: false,
            inactiveReminder_15: false,
            inactiveReminder_30: false,
            finalInactiveReminder: false,
            sequenceNumber: 1,
        };

        if (userInfo?.organization?.orgID) {
            newApplicationProperties.organization = {
                _id: userInfo?.organization?.orgID,
                name: userInfo?.organization?.orgName || ""
            }
        }

        application = {
            ...application,
            ...newApplicationProperties
        };
        const res = await this.applicationDAO.insert(application);
        if (res?.acknowledged) await this.logCollection.insert(CreateApplicationEvent.create(userInfo._id, userInfo.email, userInfo.IDP, application._id));
        return await this._computeSRFStateFields(application);
    }

    /**
     * Provides API functionality to create or save an application.
     * 
     * @note If no ID is provided in the application object, a new application will be created.
     * @param {{ application: object, status: typeof NEW | typeof IN_PROGRESS }} params The request parameters containing the application input object
     * @param {object} context The request context containing user information
     * @returns {Promise<object>} The created or updated application object
     */
    async saveApplication(params, context) {
        verifySession(context)
            .verifyInitialized()
        let inputApplication = params.application;
        const id = inputApplication?._id;
        if (!id) {
            const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE);
            if (userScope.isNoneScope()) {
                throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
            }
            const requestedStatus = params?.status ?? NEW;
            if (![NEW, IN_PROGRESS].includes(requestedStatus)) {
                throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
            }
            return await this.createApplication(inputApplication, context.userInfo, requestedStatus);
        }

        const storedApplication = await this.getApplicationById(id);
        if (storedApplication?.applicant.applicantID !== context?.userInfo?._id) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const prevStatus = storedApplication?.status;
        let targetStatus = params?.status;
        if (prevStatus === REOPENED) {
            targetStatus = IN_PROGRESS;
        } else if (!targetStatus || ![NEW, IN_PROGRESS].includes(targetStatus)) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        }

        let application = {...storedApplication, ...inputApplication, status: targetStatus };
        // auto upgrade version based on configuration
        application.version = await this._getApplicationVersionByStatus(application.status);

        if (inputApplication?.newInstitutions?.length > 0) {
            await this._validateNewInstitution(inputApplication?.newInstitutions);
        }

        application = await this._updateApplication(application, prevStatus, context?.userInfo?._id);
        if (prevStatus !== application.status){
            await logStateChange(this.logCollection, context.userInfo, application, prevStatus);
        }
        return this.getApplicationById(application?._id);
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
                name: { in: newInstitutionNames },
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
     * @returns {Promise<object|null>} Hydrated application or null when none exist
     */
    async getMyLastApplication(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const userID = context.userInfo._id;
        const application = await this.applicationDAO.findLatestApprovedByApplicantID(userID);
        if (!application) {
            return null;
        }
        const res = await this.getApplicationById(application._id);
        if (this._isApprovedApplication(res)) {
            await this._checkConditionalApproval(res);
        }
        res.version = await this._getApplicationVersionByStatus(IN_PROGRESS);
        return res;
    }

    _getApplicantNameQuery(submitterName) {
        if (submitterName != null && submitterName !== this._ALL_FILTER) {
            return {applicant: {
                is: {
                    fullName: {contains: submitterName.trim().replace(/\\/g, "\\\\"), mode: "insensitive"}
                }
            }}
        }
        return {};
    }

    _validateListApplicationsParams(params) {
        // Validate statuses, case insensitive
        const validStatusesLower = new Set(this._VALID_LIST_APPLICATION_STATUSES.map(s => String(s).toLowerCase()));
        const statusesParameter = params?.statuses;
        if (statusesParameter != null) {
            if (!Array.isArray(statusesParameter)) {
                console.error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS, { statuses: statusesParameter });
                throw new Error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            }
            if (statusesParameter.length > 0) {
                statusesParameter.forEach(status => {
                    const statusLower = (status != null ? String(status) : '').toLowerCase();
                    if (!validStatusesLower.has(statusLower)) {
                        throw new Error(replaceErrorString(ERROR.APPLICATION_INVALID_STATUSES, `'${status}'`));
                    }
                });
            }
        }
        // Validate orderBy parameter, case insensitive. Map legacy "applicant.applicantName" to Prisma field "applicant.fullName".
        const validOrderByValues = VALID_ORDER_BY_LIST_APPLICATIONS;
        const orderByInput = (params?.orderBy ?? "").toString().trim();
        let orderByPrisma = "createdAt";
        if (orderByInput) {
            const matchingKey = validOrderByValues.find((k) => k.toLowerCase() === orderByInput.toLowerCase());
            if (!matchingKey) {
                const validOrderByValuesString = [...validOrderByValues].sort().join(", ");
                console.error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS, { orderBy: orderByInput, validOrderByValues: validOrderByValuesString });
                throw new Error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS + " Valid orderBy values: " + validOrderByValuesString);
            }
            orderByPrisma = matchingKey === "applicant.applicantName" ? "applicant.fullName" : matchingKey;
        }
        // Validate sortDirection parameter, case insensitive
        const sortDirection = (params?.sortDirection || "DESC").toString().toUpperCase();
        if (sortDirection !== "ASC" && sortDirection !== "DESC") {
            console.error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS, { sortDirection: params?.sortDirection });
            throw new Error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
        }
        // Validate first parameter when provided: must be a positive integer or -1
        const first = params?.first;
        if (first !== undefined && first !== null) {
            const firstNum = Number(first);
            if (!Number.isInteger(firstNum) || (firstNum !== -1 && firstNum < 1)) {
                console.error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS, { first: params?.first });
                throw new Error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            }
        }
        // Validate offset parameter when provided: must be a non-negative integer
        const offset = params?.offset;
        if (offset !== undefined && offset !== null) {
            const offsetNum = Number(offset);
            if (!Number.isInteger(offsetNum) || offsetNum < 0) {
                console.error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS, { offset: params?.offset });
                throw new Error(ERROR.LIST_APPLICATIONS_INVALID_PARAMS);
            }
        }
        // Return orderBy and sortDirection for pagination
        return { orderByPrisma, sortDirection };
    }

    /**
     * Lists submission requests with filters, pagination, and facet values.
     * Computes canBeReopened and canBeRestored per row from revision-chain rules.
     * @param {object} params Filter, pagination, and sort parameters
     * @param {object} context Request context with userInfo
     * @returns {Promise<object>} applications, total, programs, studies, and filter facets
     */
    async listApplications(params, context) {
        // Verify that the user is authenticated and has the necessary permissions to list applications
        verifySession(context)
            .verifyInitialized()

        // Get the user information from the context
        const userInfo = context?.userInfo;

        // Only the all and own scopes are currently required for listing applications (per PBACDefaults_config: submission_request:view...).
        // All other scopes will return an empty list.
        const userScopesList = await this.authorizationService.getPermissionScope(userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.VIEW);
        const userScope = UserScope.create(userScopesList);
        if (!userScope.isAllScope() && !userScope.isOwnScope()) {
            console.warn(ERROR.VERIFY.INVALID_PERMISSION + ": list submission requests");
            console.warn("Triggered by user: " + userInfo?._id);
            return {
                applications: [],
                total: 0,
                programs: [],
                studies: [],
                studyAbbreviations: [],
                status: [],
                submitterNames: []
            };
        }

        // Validate list applications parameters and map the orderBy parameter to the Prisma field name
        const { orderByPrisma, sortDirection } = this._validateListApplicationsParams(params);

        // Build filter conditions:
        // Statuses filter: ignored if input is falsy, empty array, or contains "All" (case-insensitive).
        // Normalize statuses to proper case (e.g. "New", "In Progress") for Prisma, since DB stores title case.
        const statusesParam = params?.statuses;
        const applyStatusesFilter = statusesParam != null && Array.isArray(statusesParam) && statusesParam.length > 0
            && !statusesParam.some((s) => typeof s === 'string' && s.toLowerCase() === 'all');
        // Map statuses to proper case (e.g. "New", "In Progress") for Prisma, since DB stores title case.
        const statusLowerToCanonical = new Map(this._VALID_LIST_APPLICATION_STATUSES.map(s => [String(s).toLowerCase(), s]));
        const statusesForQuery = applyStatusesFilter
            ? (statusesParam || []).map(s => statusLowerToCanonical.get((s != null ? String(s) : '').toLowerCase())).filter(Boolean).filter(s => s !== this._ALL_FILTER)
            : [];
        const statusCondition = statusesForQuery.length > 0 ? { status: { in: statusesForQuery } } : {};
        // Submitter name filter
        const submitterNameCondition = this._getApplicantNameQuery(params?.submitterName);
        // Program name filter
        const programNameCondition = (params.programName != null && params.programName !== this._ALL_FILTER) 
            ? { programName: params.programName } 
            : {};
        // Study filter: search both studyName and studyAbbreviation (OR), case-insensitive partial match
        const studySearchTerm = params.studyName?.trim();
        const hasStudyFilter = studySearchTerm?.length > 0 && params.studyName !== this._ALL_FILTER;
        let studyCondition = {};
        if (hasStudyFilter) {
            const studySearchTermSanitized = studySearchTerm.replace(/\\/g, "\\\\");
            const containsOption = { contains: studySearchTermSanitized, mode: "insensitive" };
            studyCondition = {
                OR: [
                    { studyName: containsOption },
                    { studyAbbreviation: containsOption }
                ]
            };
        }
        // Assemble generic filter conditions, if scope is own, add applicantID filter
        const baseConditions = { ...statusCondition, ...programNameCondition, ...studyCondition, ...submitterNameCondition };
        const genericFilterConditions = userScope.isOwnScope()
            ? { ...baseConditions, applicantID: userInfo?._id }
            : baseConditions;
        // Create pagination object
        const pagination = new PrismaPagination(params?.first, params?.offset, orderByPrisma, sortDirection);
        // Include query for applicant information
        const includeQuery = {
            include: {
                applicant: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        fullName: true,
                        email: true
                    }
                },
            }
        };

        // Query filtered and paginated application list
        let applications;
        try {
            const filterConditions = { ...genericFilterConditions };
            applications = await this.applicationDAO.findMany(filterConditions, { ...pagination.getPagination(), ...includeQuery });
            applications = applications ?? [];
        } catch (err) {
            console.error("List applications fetch error: application list", err);
            throw new Error(ERROR.LIST_APPLICATIONS_FETCH_FAILED + " Failed step: fetching application list.");
        }

        // Query total application count
        let totalCount;
        try {
            totalCount = await this.applicationDAO.count(genericFilterConditions);
        } catch (err) {
            console.error("List applications fetch error: application count", err);
            throw new Error(ERROR.LIST_APPLICATIONS_FETCH_FAILED + " Failed step: fetching application count.");
        }

        // When study filter uses OR, fetch studyName + studyAbbreviation once and derive both distinct lists in memory
        let studyFilterDistinctRows = null;
        if (hasStudyFilter) {
            try {
                studyFilterDistinctRows = await this.applicationDAO.findMany(genericFilterConditions, {
                    select: { studyName: true, studyAbbreviation: true }
                });
            } catch (err) {
                console.error("List applications fetch error: gathering distinct study values", err);
                throw new Error(ERROR.LIST_APPLICATIONS_FETCH_FAILED + " Failed step: gathering distinct study values.");
            }
        }

        // Query distinct filter options in parallel (programs, studies, studyAbbreviations, statuses, submitter names)
        const runQuery = async (queryName, fn) => {
            try {
                return await fn();
            } catch (err) {
                console.error("List applications fetch error:", queryName, err);
                throw new Error(ERROR.LIST_APPLICATIONS_FETCH_FAILED);
            }
        };
        let programs, studies, studyAbbreviations, statusesList, submitterNames;
        try {
            [programs, studies, studyAbbreviations, statusesList, submitterNames] = await Promise.all([
                runQuery("programs", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.programName;
                    const rows = await this.applicationDAO.findMany(filterConditions, { select: { programName: true }, distinct: ['programName'] });
                    return (rows ?? []).map(item => item.programName).filter(Boolean);
                }),
                runQuery("studies", async () => {
                    if (studyFilterDistinctRows !== null) {
                        const names = (studyFilterDistinctRows ?? []).map(item => item.studyName).filter(Boolean);
                        return Array.from(new Set(names));
                    }
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.studyName;
                    const rows = await this.applicationDAO.findMany(filterConditions, { select: { studyName: true }, distinct: ['studyName'] });
                    return (rows ?? []).map(item => item.studyName).filter(Boolean);
                }),
                runQuery("study abbreviations", async () => {
                    if (studyFilterDistinctRows !== null) {
                        const abbreviations = (studyFilterDistinctRows ?? []).map(item => item.studyAbbreviation).filter(Boolean);
                        return Array.from(new Set(abbreviations));
                    }
                    const filterConditions = { ...genericFilterConditions };
                    const rows = await this.applicationDAO.findMany(filterConditions, { select: { studyAbbreviation: true }, distinct: ['studyAbbreviation'] });
                    return (rows ?? []).map(item => item.studyAbbreviation).filter(Boolean);
                }),
                runQuery("statuses", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.status;
                    const rows = await this.applicationDAO.findMany(filterConditions, { select: { status: true }, distinct: ['status'] });
                    return (rows ?? []).map(item => item.status).filter(Boolean);
                }),
                runQuery("submitter names", async () => {
                    const filterConditions = { ...genericFilterConditions };
                    delete filterConditions.applicant;
                    const rows = await this.applicationDAO.findMany(filterConditions, { include: { applicant: { select: { fullName: true } } }, distinct: ['applicantID'] });
                    const names = (rows ?? []).map(sub => sub?.applicant?.fullName).filter(Boolean).sort((a, b) => a.localeCompare(b));
                    return Array.from(new Set(names));
                }),
            ]);
        } catch (err) {
            // If the error message includes the expected error message, it has already been logged and formatted and can be rethrown
            if (err.message?.includes(ERROR.LIST_APPLICATIONS_FETCH_FAILED)) {
                throw err;
            }
            // Log the error, format it and rethrow
            console.error(ERROR.LIST_APPLICATIONS_FETCH_FAILED, err);
            throw new Error(ERROR.LIST_APPLICATIONS_FETCH_FAILED + " Please see logs for more information.");
        }

        // Batch-prefetch SRF state and approved-study data, then map to plain objects so GraphQL
        // always receives conditional / pendingConditions (Prisma entities may drop ad-hoc properties).
        const { studyByLowerName } = await this._batchComputeListApplicationFields(applications);
        const mappedApplications = [];
        for (const app of applications) {
            const applicant = {
                applicantID: app?.applicant?.id || "",
                applicantName: this._getUserDisplayName(app.applicant) || "",
                applicantEmail: app?.applicant?.email || "",
            };
            if (!this._isApprovedApplication(app)) {
                mappedApplications.push({
                    ...app,
                    applicant,
                    studyAbbreviation: defaultStudyAbbreviationToStudyName(app.studyAbbreviation, app.studyName),
                });
                continue;
            }
            const study = studyByLowerName.get(app.studyName?.trim().toLowerCase());
            const { conditional, pendingConditions } = this._resolveConditionalApprovalFields(study);
            mappedApplications.push({
                ...app,
                applicant,
                conditional,
                pendingConditions,
                studyAbbreviation: defaultStudyAbbreviationToStudyName(app.studyAbbreviation, app.studyName),
            });
        }
        applications = mappedApplications;

        // Sort statuses in display order
        const statusOrder = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, INQUIRED, REOPENED, APPROVED, REJECTED, CANCELED, DELETED];
        const statuses = (statusesList || []).sort((a, b) => statusOrder.indexOf(a) - statusOrder.indexOf(b));
        // Return the results
        return {
            applications,
            total: totalCount,
            programs: programs || [],
            studies: studies || [],
            studyAbbreviations: studyAbbreviations || [],
            status: statuses,
            submitterNames: submitterNames || []
        };
    }

    async submitApplication(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.SUBMIT);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const application = await this.getApplicationById(params._id);
        const validStatus = [IN_PROGRESS, INQUIRED]; //updated based on new requirement.
        verifyApplication(application)
            .notEmpty()
            .state(validStatus);
        // In Progress -> In Submitted
        const history = application.history || [];
        const historyEvent = HistoryEventBuilder.createEvent(context.userInfo._id, SUBMITTED, null);
        history.push(historyEvent)
        const aApplication = {
            _id: application._id,
            history: history,
            status: SUBMITTED,
            updatedAt: historyEvent.dateTime,
            submittedDate: historyEvent.dateTime
        };
        const updated = await this.applicationDAO.update(aApplication);
        if (!updated) throw new Error(ERROR.UPDATE_FAILED);
        const logEvent = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, SUBMITTED);
        await Promise.all([
            await this.logCollection.insert(logEvent),
            await sendEmails.submitApplication(this.notificationService, this.userService, this.emailParams, context.userInfo, application)
        ]);
        return await this.getApplicationById(application._id);
    }


    _getInProgressComment(history) {
        const isValidComment = history?.length > 1 &&
            ([CANCELED, DELETED].includes(history?.at(-2)?.status) // Restored Reason
            || INQUIRED === history?.at(-1)?.status);
        return isValidComment ? history?.at(-1)?.reviewComment : null;
    }

    async resumeInquiredApplication(params, context) {
        verifySession(context)
            .verifyInitialized();
        const applicationId = params?._id ?? params?.id;
        const application = await this.getApplicationById(applicationId);
        if (context?.userInfo?._id !== application?.applicant?.applicantID) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        application.version = await this._getApplicationVersionByStatus(application.status, application?.version);
        if (application && application.status) {
            const reviewComment = this._getInProgressComment(application?.history);
            const history = HistoryEventBuilder.createEvent(context.userInfo._id, IN_PROGRESS, reviewComment);
            const updated = await this.applicationDAO.update({
                _id: application._id,
                status: IN_PROGRESS,
                updatedAt: history.dateTime,
                version: application.version,
                history: [...(application.history || []), history]
            });
            if (updated) {
                const promises = [
                    await this.getApplicationById(applicationId),
                    await this.logCollection.insert(UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, IN_PROGRESS))
                ];
                return await Promise.all(promises).then(function(results) {
                    return results[0];
                });
            }
        }
        return await this._computeSRFStateFields(application);
    }

    async reopenApplication(params, context) {
        return this.resumeInquiredApplication(params, context);
    }

    async reopenApprovedSubmissionRequest(params, context) {
        // Verifications
        verifySession(context)
            .verifyInitialized();

        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.REOPEN);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const source = await this.getApplicationById(params._id);
        verifyApplication(source)
            .notEmpty()
            .state([APPROVED]);

        if (!(await this._computeCanBeReopened(source))) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
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

        // Clone the application for reopen
        const timestamp = getCurrentTime();
        const historyEvent = HistoryEventBuilder.createEvent(context.userInfo._id, REOPENED, null, timestamp);
        const version = await this._getApplicationVersionByStatus(REOPENED);
        const sourceSequence = source?.sequenceNumber ?? 1;
        const reopenedApplication = {
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
        const insertedApp = await this.applicationDAO.reopenApprovedRevision(
            source._id,
            reopenedApplication,
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

        // Compile API response
        insertedApp.version = await this._getApplicationVersionByStatus(insertedApp.status, insertedApp.version);
        return await this._reformatRecordForApplicationResponse(insertedApp, ownerUser);
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
                this._logReopenOwnerValidationFailure({ applicationID: source._id }, error);
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

    async cancelApplication(document, context) {
        verifySession(context)
            .verifyInitialized();
        const userInfo = context?.userInfo;
        const userScope = await this._getUserScope(userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CANCEL);
        if (userScope.isNoneScope() || (!userScope.isOwnScope() && !userScope.isAllScope())) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        const aApplication = await this.getApplicationById(document._id);
        const isApplicationOwned = userScope.isOwnScope() && userInfo?._id === aApplication?.applicant?.applicantID;
        const validApplicationStatus = [NEW, IN_PROGRESS, SUBMITTED, IN_REVIEW, INQUIRED, REOPENED];
        if (!validApplicationStatus.includes(aApplication.status)) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        }
        aApplication.version = await this._getApplicationVersionByStatus(aApplication.status, aApplication?.version);
        const powerUserCond = [NEW, IN_PROGRESS, INQUIRED, SUBMITTED, IN_REVIEW, REOPENED].includes(aApplication?.status);
        const isValidCond = [NEW, IN_PROGRESS, INQUIRED, REOPENED].includes(aApplication?.status) && userInfo?._id === aApplication?.applicant?.applicantID;
        if ((userScope.isAllScope() && !powerUserCond) || (isApplicationOwned && !isValidCond)) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const history = HistoryEventBuilder.createEvent(context.userInfo._id, CANCELED, document?.comment);
        // If the application is empty, then delete the application and return the deleted application document.
        let updated = null;
        let deleteApplication = false;
        let deletedApplicationDocument = null;
        const utilityService = new UtilityService();
        if (utilityService.isEmptyApplication(aApplication)) {
            deletedApplicationDocument = await this.getApplicationById(document._id);
            updated = await this.applicationDAO.delete(document._id);
            deleteApplication = true;
        } else{
            updated = await this.applicationDAO.update({
                _id: aApplication._id,
                status: CANCELED,
                updatedAt: history.dateTime,
                version: aApplication.version,
                history: [...(aApplication?.history || []), history]
            });
        }
        if (updated) {
            await this._sendCancelApplicationEmail(userInfo, aApplication);
        } else {
            console.error(ERROR.FAILED_DELETE_APPLICATION, `${document._id}`);
            throw new Error(ERROR.FAILED_DELETE_APPLICATION);
        }
        if (deleteApplication) {
            // If application is deleted, then return null
            return deletedApplicationDocument;
        }else
            return await this.getApplicationById(document._id);
        }

    async restoreApplication(document, context) {
        const aApplication = await this.getApplicationById(document._id);
        verifyApplication(aApplication)
            .notEmpty()
            .state([CANCELED, DELETED]);

        const userInfo = context?.userInfo;
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CANCEL);
        if (userScope.isNoneScope() || (!userScope.isOwnScope() && !userScope.isAllScope())) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        const isApplicationOwned = userInfo?._id === aApplication?.applicant?.applicantID;
        if (userScope.isOwnScope() && !isApplicationOwned) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        if (!this._hasValidRestoreHistory(aApplication)) {
            throw new Error(ERROR.INVALID_APPLICATION_RESTORE_STATE);
        }
        if (!(await this._computeCanBeRestored(aApplication))) {
            throw new Error(ERROR.INVALID_APPLICATION_RESTORE_NEWER_REVISION_EXISTS);
        }
        const prevStatus = aApplication?.history?.at(-2)?.status;
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, prevStatus, document?.comment);
        const updated = await this.applicationDAO.update({
            _id: aApplication._id,
            status: prevStatus,
            updatedAt: history.dateTime,
            history: [...(aApplication.history || []), history]
        });

        if (updated) {
            await this._sendRestoreApplicationEmail(aApplication);
        } else {
            console.error(ERROR.FAILED_RESTORE_APPLICATION, `${aApplication._id}`);
            throw new Error(ERROR.FAILED_RESTORE_APPLICATION);
        }
        return await this.getApplicationById(aApplication._id);
    }

    async approveApplication(document, context) {
        await this.verifyReviewerPermission(context);
        const application = await this.getApplicationById(document._id);
        // In Reviewed -> Approved
        verifyApplication(application)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);

        const questionnaire = getApplicationQuestionnaire(application);
        const sequenceNumber = application?.sequenceNumber ?? 1;
        const [predecessor, existingProgram, duplicatePrograms] = await Promise.all([
            this.applicationDAO.findApprovedParentSubmissionRequestByID(application._id),
            this.organizationService.getOrganizationByID(questionnaire?.program?._id, false),
            this.organizationService.findOneByProgramName(application?.programName),
            (async () => {
                application.version = await this._getApplicationVersionByStatus(application.status, application?.version);
            })()
        ]);

        const isRevisionReapproval = Boolean(predecessor && sequenceNumber > 1);
        const duplicates = await this.approvedStudiesService.findByStudyName(application?.studyName);
        let existingStudy = null;
        if (isRevisionReapproval) {
            existingStudy = await this.approvedStudiesService.findByApplicationID(
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
            throw new Error(replaceErrorString(ERROR.DUPLICATE_APPROVED_STUDY_NAME, `'${application?.studyName}'`));
        }

        // Duplicate program protection on first approval only; revision re-approval does not upsert programs.
        if (!isRevisionReapproval && !(existingProgram?._id) && duplicatePrograms) {
            throw new Error(replaceErrorString(ERROR.DUPLICATE_PROGRAM_NAME, `'${application?.programName}'`));
        }

        const history = HistoryEventBuilder.createEvent(context.userInfo._id, APPROVED, document.comment);
        const updated = await this.applicationDAO.update({
            _id: application._id,
            reviewComment: document.comment,
            wholeProgram: document.wholeProgram,
            status: APPROVED,
            updatedAt: history.dateTime,
            version: application.version,
            history: [...(application.history || []), history]
        });
        if (!updated) {
            throw new Error(ERROR.UPDATE_FAILED);
        }
        const isDbGapMissing = (questionnaire?.accessTypes?.includes("Controlled Access") && !questionnaire?.study?.dbGaPPPHSNumber);
        const isPendingGPA = (questionnaire?.accessTypes?.includes("Controlled Access") && Boolean(!updated?.GPAName?.trim()));
        const isPendingImageDeIdentification = isTrue(document?.pendingImageDeIdentification);
        let promises = [];

        promises.push(this.institutionService.addNewInstitutions(application?.newInstitutions));
        promises.push(this.sendEmailAfterApproveApplication(context, application, document?.comment, isDbGapMissing, isTrue(document?.pendingModelChange), isPendingGPA, isPendingImageDeIdentification));
        if (updated) {
            promises.unshift(this.getApplicationById(document._id));
            if (questionnaire && !isRevisionReapproval) {
                const [name, abbreviation, description] = [application?.programName, application?.programAbbreviation, application?.programDescription];
                let program = existingProgram;
                if (name?.trim()?.length > 0 && !existingProgram?._id) {
                    // Await program creation before creating approved study to avoid race condition
                    program = await this.organizationService.upsertByProgramName(name, abbreviation, description);
                }
                const newApprovedStudy = await this.approvedStudiesService.saveApprovedStudyFromApplication(
                    updated,
                    questionnaire,
                    document?.pendingModelChange,
                    document?.pendingImageDeIdentification,
                    isPendingGPA,
                    program,
                    null
                );
                // added approved studies into user collection
                const applicants = await this._findUsersByApplicantIDs([application]);
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
            }
            promises.push(this.logCollection.insert(
                UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, APPROVED)
            ));
        }
        const results = await Promise.all(promises);
        const applicationResult = results[0];
        if (this._isApprovedApplication(applicationResult)) {
            await this._checkConditionalApproval(applicationResult);
        }
        return applicationResult;
    }

    async rejectApplication(document, context) {
        await this.verifyReviewerPermission(context);
        const application = await this.getApplicationById(document._id);
        // In Reviewed or Submitted -> Inquired
        verifyApplication(application)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        application.version = await this._getApplicationVersionByStatus(application.status, application?.version);
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, REJECTED, document.comment);
        const updated = await this.applicationDAO.update({
            _id: application._id,
            reviewComment: document.comment,
            status: REJECTED,
            updatedAt: history.dateTime,
            version: application.version,
            history: [...(application.history || []), history]
        });

        await sendEmails.rejectApplication(this.notificationService, this.userService, this.emailParams, application, document.comment);
        if (updated) {
            const log = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, REJECTED);
            const promises = [
                await this.getApplicationById(document._id),
                this.logCollection.insert(log)
            ];
            return await Promise.all(promises).then(function(results) {
                return results[0];
            });
        }
        return null;
    }

    async inquireApplication(document, context) {
        await this.verifyReviewerPermission(context);
        const application = await this.getApplicationById(document._id);
        // In Reviewed or Submitted -> Inquired
        verifyApplication(application)
            .notEmpty()
            .state([IN_REVIEW, SUBMITTED]);
        // auto upgrade version
        application.version = await this._getApplicationVersionByStatus(application.status);
        const history = HistoryEventBuilder.createEvent(context.userInfo._id, INQUIRED, document.comment);
        const updated = await this.applicationDAO.update({
            _id: application._id,
            reviewComment: document.comment,
            status: INQUIRED,
            updatedAt: history.dateTime,
            version: application.version,
            history: [...(application.history || []), history]
        });
        await sendEmails.inquireApplication(this.notificationService, this.userService, application, document?.comment);
        if (updated) {
            const log = UpdateApplicationStateEvent.create(context.userInfo._id, context.userInfo.email, context.userInfo.IDP, application._id, application.status, INQUIRED);
            const promises = [
                await this.getApplicationById(document._id),
                this.logCollection.insert(log)
            ];
            return await Promise.all(promises).then(function(results) {
                return results[0];
            });
        }
        return null;
    }

    async deleteInactiveApplications() {
        try {
            const utilityService = new UtilityService();
            // default retention window and new short window for blank 'New' SRFs
            const defaultDays = this.emailParams.inactiveDays;
            const shortDays = this.emailParams.inactiveNewApplicationDays || 30;

            // Fetch both sets and merge, preferring entries from the default set
            const [defaultApps, shortApps] = await Promise.all([
                this.applicationDAO.getInactiveApplication(defaultDays),
                this.applicationDAO.getInactiveApplication(shortDays)
            ]);

            const appsMap = new Map();
            (defaultApps || []).forEach(a => appsMap.set(a._id, a));
            (shortApps || []).forEach(a => {
                // Only consider truly blank SRFs in the 'New' status for the short window
                if (a.status === NEW && utilityService.isEmptyApplication(a) && !appsMap.has(a._id)) {
                    // mark that this record should use the short window when sending emails
                    a._useShortWindow = true;
                    appsMap.set(a._id, a);
                }
            });

            const applications = Array.from(appsMap.values());

            // Handle undefined/null/empty applications gracefully
            if (!applications?.length) {
                console.log("No inactive applications found to delete");
                return;
            }

            console.log(`Found ${applications.length} inactive applications to process`);

            const [applicantUsers, BCCUsers] = await Promise.all([
                this._findUsersByApplicantIDs(applications),
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
            const updateResults = await Promise.allSettled(applications.map(async (app) => {
                if (utilityService.isEmptyApplication(app) && app.status === NEW) {
                    const deleted = await this.applicationDAO.delete(app._id);
                    return deleted;
                }
                const result = await this.applicationDAO.update({
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
                console.error(`Failed to update ${failedUpdates} applications:`, 
                    updateResults.filter(result => result.status === 'rejected').map(result => result.reason));
            }

            if (successfulUpdates > 0) {
                console.log(`Successfully processed ${successfulUpdates} inactive applications`);

                // Filter applications to only include those that were successfully updated
                const successfullyUpdatedApplications = applications.filter((app, index) => {
                    const updateResult = updateResults[index];
                    return updateResult && updateResult.status === 'fulfilled';
                });

                // Use Promise.allSettled for email notifications - only for successfully updated applications
                const emailResults = await Promise.allSettled(successfullyUpdatedApplications.map(async (app) => {
                    if (permittedUserIDs.has(app?.applicantID)) {
                        const localEmailParams = {
                            ...this.emailParams,
                            inactiveDays: app._useShortWindow ? (this.emailParams.inactiveNewApplicationDays || shortDays) : this.emailParams.inactiveDays
                        };
                        await sendEmails.inactiveApplications(this.notificationService, localEmailParams, app?.applicant?.applicantEmail, app?.applicant?.applicantName, app, getUserEmails(BCCUsers));
                    }
                }));

                const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;
                const failedEmails = emailResults.filter(result => result.status === 'rejected').length;

                if (failedEmails > 0) {
                    console.error(`Failed to send ${failedEmails} email notifications:`, 
                        emailResults.filter(result => result.status === 'rejected').map(result => result.reason));
                }

                console.log(`Sent ${successfulEmails} email notifications for inactive applications`);

                // Use Promise.allSettled for log insertions - only for successfully updated applications
                const logResults = await Promise.allSettled(successfullyUpdatedApplications.map(async (app) => {
                    this.logCollection.insert(UpdateApplicationStateEvent.createByApp(app._id, app.status, DELETED));
                }));

                const successfulLogs = logResults.filter(result => result.status === 'fulfilled').length;
                const failedLogs = logResults.filter(result => result.status === 'rejected').length;

                if (failedLogs > 0) {
                    console.error(`Failed to log ${failedLogs} application deletions:`, 
                        logResults.filter(result => result.status === 'rejected').map(result => result.reason));
                }

                console.log(`Logged ${successfulLogs} application deletions`);
            }
        } catch (error) {
            console.error("Error in deleteInactiveApplications task:", error);
            throw error; // Re-throw to be caught by cron job handler
        }
    }

    async remindApplicationSubmission() {
        // The system sends reminder emails for both the default window and the short-window for blank 'New' SRFs.
        const defaultDays = this.emailParams.inactiveDays;
        const shortDays = this.emailParams.inactiveNewApplicationDays || 30;

        // Final (24 hour) reminders for default and short windows
        const [finalDefault, finalShort] = await Promise.all([
            this.applicationDAO.getInactiveApplication(defaultDays - 1, this._FINAL_INACTIVE_REMINDER),
            this.applicationDAO.getInactiveApplication(shortDays - 1, this._FINAL_INACTIVE_REMINDER)
        ]);

        // Send final reminders for default window
        if (finalDefault?.length > 0) {
            await Promise.all(finalDefault.map(async (aApplication) => {
                await this._sendEmailFinalInactiveApplication(aApplication, defaultDays);
            }));
            const applicationIDs = finalDefault.map(application => application._id);
            const query = {_id: {$in: applicationIDs}};
            const everyReminderDays = this._getEveryReminderQuery(this.emailParams.inactiveApplicationNotifyDays, true);
            const updatedReminder = await this.applicationDAO.updateMany(query, everyReminderDays);
            if (!updatedReminder?.matchedCount) {
                console.error("The email reminder flag intended to notify the inactive submission request (FINAL) is not being stored", `applicationIDs: ${applicationIDs.join(', ')}`);
            }
        }

        // Send final reminders for short window, but only for blank 'New' SRFs
        if (finalShort?.length > 0) {
            const utilityService = new UtilityService();
            const shortFinalToSend = finalShort.filter(a => a.status === NEW && utilityService.isEmptyApplication(a));
            await Promise.all(shortFinalToSend.map(async (aApplication) => {
                await this._sendEmailFinalInactiveApplication(aApplication, shortDays);
            }));
            const applicationIDs = shortFinalToSend.map(application => application._id);
            if (applicationIDs.length > 0) {
                const query = {_id: {$in: applicationIDs}};
                const everyReminderDays = this._getEveryReminderQuery(this.emailParams.inactiveApplicationNotifyDays, true);
                const updatedReminder = await this.applicationDAO.updateMany(query, everyReminderDays);
                if (!updatedReminder?.matchedCount) {
                    console.error("The email reminder flag intended to notify the inactive submission request (FINAL) is not being stored", `applicationIDs: ${applicationIDs.join(', ')}`);
                }
            }
        }

        // Build list of reminders for notification intervals for default and short windows
        const reminderEntries = [];
        for (const day of this.emailParams.inactiveApplicationNotifyDays) {
            const pastDefault = defaultDays - day;
            const appsDefault = await this.applicationDAO.getInactiveApplication(pastDefault, `${this._INACTIVE_REMINDER}_${day}`);
            reminderEntries.push(...(appsDefault || []).map(a => ({ application: a, pastDays: pastDefault, baseDays: defaultDays })));

            // Only query short window for intervals strictly less than shortDays to avoid zero/negative pastDays
            if (day < shortDays) {
                const pastShort = shortDays - day;
                const appsShort = await this.applicationDAO.getInactiveApplication(pastShort, `${this._INACTIVE_REMINDER}_${day}`);
                if (appsShort && appsShort.length > 0) {
                    const utilityService = new UtilityService();
                    // only include blank New SRFs from short-window
                    reminderEntries.push(...appsShort.filter(a => a.status === NEW && utilityService.isEmptyApplication(a)).map(a => ({ application: a, pastDays: pastShort, baseDays: shortDays })));
                }
            }
        }

        if (reminderEntries.length > 0) {
            // Sort by pastDays descending (older first) and dedupe by application id
            reminderEntries.sort((a, b) => b.pastDays - a.pastDays);
            const seen = new Set();
            const toSend = [];
            for (const entry of reminderEntries) {
                if (!seen.has(entry.application._id)) {
                    seen.add(entry.application._id);
                    toSend.push(entry);
                }
            }

            // Send emails
            await Promise.all(toSend.map(async (entry) => {
                await this._sendEmailInactiveApplication(entry.application, entry.pastDays, entry.baseDays);
            }));

            // Update reminder flags based on baseDays
            for (const entry of toSend) {
                const applicationID = entry.application._id;
                const pastDays = entry.pastDays;
                const expiredDays = entry.baseDays - pastDays;
                const submissionReminderDays = this.emailParams.inactiveApplicationNotifyDays;
                const reminderDays = submissionReminderDays.filter((d) => expiredDays < d || expiredDays === d);
                const reminderFilter = reminderDays.reduce((acc, day) => {
                    acc[`${this._INACTIVE_REMINDER}_${day}`] = true;
                    return acc;
                }, {});
                const updatedReminder = await this.applicationDAO.update({_id: applicationID, ...reminderFilter});
                if (!updatedReminder) {
                    console.error("The email reminder flag intended to notify the inactive submission request is not being stored", applicationID);
                }
            }
        }
    }

    async _findUsersByApplicantIDs(applications) {
        const applicantIDs = applications
            ?.map((a) => a?.applicantID) // Extract applicant IDs
            ?.filter(Boolean);

        return await this.userService.userCollection.aggregate([{
            "$match": {"_id": { "$in": applicantIDs }
            }}]);
    }

    async sendEmailAfterApproveApplication(context, application, comment, isDbGapMissing = false, isPendingModelChange, isPendingGPA = false, isPendingImageDeIdentification = false) {
        const res = await Promise.all([
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]),
            this.userService.userCollection.find(application?.applicantID)
        ]);

        const [toBCCUsers, applicant] = res;
        const applicantInfo = applicant?.pop();
        const CCEmails = getCCEmails(application?.applicant?.applicantEmail, application);
        const toBCCEmails = getUserEmails(toBCCUsers)
            ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const pendingTemplateParams = {
                firstName: application?.applicant?.applicantName,
                contactEmail: this.emailParams?.conditionalSubmissionContact,
                reviewComments: comment && comment?.trim()?.length > 0 ? comment?.trim() : "N/A",
                study: setDefaultIfNoName(application?.studyName),
                submissionGuideURL: this.emailParams?.submissionGuideURL
            };

            if (!isDbGapMissing && !isPendingModelChange && !isPendingGPA && !isPendingImageDeIdentification) {
                await this.notificationService.approveQuestionNotification(application?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    {
                        firstName: application?.applicant?.applicantName,
                        reviewComments: comment && comment?.trim()?.length > 0 ? comment?.trim() : "N/A"
                    },
                    {
                        study: studyLabelForEmailBody(application),
                        contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
                    }
                );
                return;
            }

            const pendingCount = [isDbGapMissing, isPendingModelChange, isPendingGPA, isPendingImageDeIdentification].filter(Boolean).length;
            if (pendingCount > 1) {
                await this.notificationService.multipleChangesApproveQuestionNotification(application?.applicant?.applicantEmail,
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
                await this.notificationService.dbGapMissingApproveQuestionNotification(application?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingModelChange) {
                await this.notificationService.dataModelChangeApproveQuestionNotification(application?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingGPA) {
                await this.notificationService.pendingGPANotification(application?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
                return;
            }

            if (isPendingImageDeIdentification) {
                await this.notificationService.pendingImageDeIdentificationApproveQuestionNotification(application?.applicant?.applicantEmail,
                    CCEmails,
                    toBCCEmails,
                    pendingTemplateParams
                );
            }
        }
    }

    async _cancelApplicationEmailInfo(application) {
        const [applicant, BCCUsers] = await Promise.all([
            this.userService.userCollection.find(application?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);
        const applicantInfo = applicant?.pop();

        const CCEmails = getCCEmails(application?.applicant?.applicantEmail, application);
        const toBCCEmails = getUserEmails(BCCUsers)
            ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);

        return [applicantInfo, CCEmails, toBCCEmails];
    }

    async _sendCancelApplicationEmail(userCanceledBy, application) {
        const [applicantInfo, CCEmails, BCCUserEmails] = await this._cancelApplicationEmailInfo(application);
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL)) {
            if (!applicantInfo?.email) {
                console.error("Cancel submission request email notification does not have any recipient", `Application ID: ${application?._id}`);
                return;
            }
            const canceledByName = [ROLES.ADMIN, ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL].includes(userCanceledBy?.role) ? this._CRDC_TEAM: `${userCanceledBy.firstName} ${userCanceledBy.lastName || ""}`;
            await this.notificationService.cancelApplicationNotification(applicantInfo?.email, CCEmails, BCCUserEmails, {
                firstName: `${applicantInfo.firstName} ${applicantInfo.lastName || ""}`
            },{
                studyName: `${application?.studyName?.trim() || "NA"},`,
                canceledNameBy: canceledByName,
                contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
            });
        }
    }

    async _sendRestoreApplicationEmail(application) {
        const [applicantInfo, CCEmails, BCCUserEmails] = await this._cancelApplicationEmailInfo(application);
        if (!applicantInfo?.email) {
            console.error("Restore submission request email notification does not have any recipient", `Application ID: ${application?._id}`);
            return;
        }

        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_CANCEL)) {
            await this.notificationService.restoreApplicationNotification(applicantInfo?.email, CCEmails, BCCUserEmails,{
                firstName: `${applicantInfo.firstName} ${applicantInfo.lastName || ""}`
            },{
                studyName: `${application?.studyName?.trim() || "NA"},`,
                contactEmail: `${this.emailParams.conditionalSubmissionContact}.`
            });
        }

    }

    async _sendEmailFinalInactiveApplication(application, baseInactiveDays = this.emailParams.inactiveDays) {
        const [aSubmitter, BCCUsers] = await Promise.all([
            this.userService.getUserByID(application?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);

        const filteredBCCUsers = BCCUsers.filter((u) => u?._id !== aSubmitter?._id);
        if (!aSubmitter?.email) {
            console.log("The final inactive application reminder was not sent.", `Submission Request ID: ${application?._id}`);
            return;
        }

        if (aSubmitter?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING)) {
            const applicant = await this.userDAO.findFirst({id: application?.applicantID});
            const CCEmails = getCCEmails(applicant?.email, application);
            const toBCCEmails = getUserEmails(filteredBCCUsers)
                ?.filter((email) => !CCEmails.includes(email));
            await this.notificationService.finalRemindApplicationsNotification(aSubmitter?.email,
                CCEmails,
                toBCCEmails, {
                    firstName: `${aSubmitter?.firstName} ${aSubmitter?.lastName || ''}`,
                    studyName: studyLabelForEmailBody(application)
                },{
                    inactiveDays: baseInactiveDays,
                    url: this.emailParams.url
                });
            logDaysDifference(baseInactiveDays - 1, application?.updatedAt, application?._id);
        }
    }

    async _sendEmailInactiveApplication(application, interval, baseInactiveDays = this.emailParams.inactiveDays) {
        const [aSubmitter, BCCUsers] = await Promise.all([
            this.userService.getUserByID(application?.applicantID),
            this.userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN])
        ]);

        if (!aSubmitter?.email) {
            console.log("The inactive application reminder was not sent.", `${interval} days Submission Request ID: ${application?._id}`);
            return;
        }

        if (aSubmitter?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_EXPIRING)) {
            const applicant = await this.userDAO.findFirst({id: application?.applicantID});
            const CCEmails = getCCEmails(applicant?.email, application);
            const filteredBCCUsers = BCCUsers.filter((u) => u?._id !== aSubmitter?._id);
            const toBCCEmails = getUserEmails(filteredBCCUsers)
                ?.filter((email) => !CCEmails.includes(email));
            await this.notificationService.remindApplicationsNotification(aSubmitter?.email,
                CCEmails,
                toBCCEmails, {
                    firstName: `${aSubmitter?.firstName} ${aSubmitter?.lastName || ''}`,
                    studyName: studyLabelForEmailBody(application)
                },{
                    remainDays: baseInactiveDays - interval,
                    inactiveDays: interval,
                    url: this.emailParams.url
                });
            logDaysDifference(interval, application?.updatedAt, application?._id);
        }
    }

    // Generates a query for the status of all email notification reminder.
    _getEveryReminderQuery(remindSubmissionDay, status) {
        return remindSubmissionDay.reduce((acc, day) => {
            acc[`${this._INACTIVE_REMINDER}_${day}`] = status;
            return acc;
        }, {[`${this._FINAL_INACTIVE_REMINDER}`]: status});
    }

    async verifyReviewerPermission(context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.REVIEW);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
    }

    async _updateApplication(application, prevStatus, userID) {
        if (prevStatus !== application.status) {
            application = {history: [], ...application};
            const historyEvent = HistoryEventBuilder.createEvent(userID, application.status, null);
            application.history.push(historyEvent);
        }
        // Save an email reminder when an inactive application is reactivated.
        application.inactiveReminder = false;
        application.updatedAt = getCurrentTime();
        const {applicant, ...data} = application;
        const updateResult = await this.applicationDAO.update({_id: application?._id, ...data});
        if (!updateResult) {
            throw new Error(ERROR.APPLICATION_NOT_FOUND + updateResult?._id);
        }
        return updateResult;
    }
}

async function logStateChange(logCollection, userInfo, application, prevStatus) {
    await logCollection.insert(
        UpdateApplicationStateEvent.create(
            userInfo?._id, userInfo?.email, userInfo?.IDP, application?._id, prevStatus, application?.status
        )
    );
}

const setDefaultIfNoName = (str) => {
    const name = str?.trim() ?? "";
    return (name.length > 0) ? (name) : "NA";
}

/** Abbreviation for $study-style email slots; falls back to application study name. (Inquire/PV abbrev lines use defaultStudyAbbreviationToNA separately.) */
function studyLabelForEmailBody(application) {
    return defaultStudyAbbreviationToStudyName(application?.studyAbbreviation, application?.studyName);
}

const getCCEmails = (submitterEmail, application) => {
    const questionnaire = getApplicationQuestionnaire(application);
    if (!questionnaire || !submitterEmail) {
        return [];
    }
    const CCEmailsSet = new Set([questionnaire?.primaryContact?.email, questionnaire?.pi?.email]
        .filter((email) => email && email !== submitterEmail && EMAIL_REGEX.test(email)));
    return Array.from(CCEmailsSet);
}

const sendEmails = {
    inactiveApplications: async (notificationService, emailParams, email, applicantName, application, BCCEmails) => {
        try {
            const CCEmails = getCCEmails(email, application);
            const toBCCEmails = BCCEmails
                ?.filter((BCCEmail) => !CCEmails.includes(BCCEmail) && BCCEmail !== email);
            await notificationService.inactiveApplicationsNotification(email,
                CCEmails,
                toBCCEmails, {
                firstName: applicantName},{
                pi: `${applicantName}`,
                study: studyLabelForEmailBody(application),
                officialEmail: `${emailParams.officialEmail}.`,
                inactiveDays: emailParams.inactiveDays,
                url: emailParams.url
            });
            logDaysDifference(emailParams.inactiveDays, application?.updatedAt, application?._id);
        } catch (error) {
            console.error(`Failed to send inactive application notification email to ${email} for application ${application?._id}:`, error.message);
            throw error; // Re-throw to be handled by Promise.allSettled
        }
    },
    submitApplication: async (notificationService, userService, emailParams, userInfo, application) => {
        const applicantInfo = (await userService.userCollection.find(application?.applicant?.applicantID))?.pop();
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_SUBMIT)) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_SUBMIT],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN]);
            const CCEmails = getCCEmails(application?.applicant?.applicantEmail, application);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);

            await notificationService.submitRequestReceivedNotification(application?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails,
                {helpDesk: `${emailParams.conditionalSubmissionContact}.`},
                {userName: application?.applicant?.applicantName}
            );
        }

        const toUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_READY_REVIEW],
            [ROLES.FEDERAL_LEAD]);

        if (!toUsers || toUsers?.length === 0) {
            console.error("SR for Submit email notification does not have any recipient", `Application ID: ${application?._id}`);
            return;
        }
        if (toUsers?.length > 0) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_READY_REVIEW],
                [ROLES.FEDERAL_LEAD, ROLES.DATA_COMMONS_PERSONNEL, ROLES.ADMIN]);
            const toEmails = getUserEmails(toUsers);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !toEmails?.includes(email));
            const programName = application?.programName?.trim() || "NA";
            await notificationService.submitQuestionNotification(getUserEmails(toUsers),
                [],
                toBCCEmails, {
                pi: `${userInfo.firstName} ${userInfo.lastName}${programName === "NA" ? "." : `, and associated with the ${programName} program.`}`,
                study: studyLabelForEmailBody(application),
                url: emailParams.url
            });
        }
    },
    inquireApplication: async (notificationService, userService, application, reviewComments) => {
        const res = await Promise.all([
            userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]),
            userService.userCollection.find(application?.applicant?.applicantID)
        ]);
        const [toBCCUsers, applicant] = res;
        const applicantInfo = (applicant)?.pop();
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const CCEmails = getCCEmails(application?.applicant?.applicantEmail, application);
            const toBCCEmails = getUserEmails(toBCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
            const studyName = setDefaultIfNoName(application?.studyName);
            const studyAbbreviation = defaultStudyAbbreviationToNA(application?.studyAbbreviation);
            await notificationService.inquireQuestionNotification(application?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails,{
                firstName: application?.applicant?.applicantName,
                reviewComments,
                studyName,
                studyAbbreviation,
            }, {});
        }
    },
    rejectApplication: async(notificationService, userService, emailParams, application, reviewComments) => {
        const applicantInfo = (await userService.userCollection.find(application?.applicant?.applicantID))?.pop();
        if (applicantInfo?.notifications?.includes(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW)) {
            const BCCUsers = await userService.getUsersByNotifications([EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_REVIEW],
                [ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD, ROLES.ADMIN]);
            const CCEmails = getCCEmails(application?.applicant?.applicantEmail, application);
            const toBCCEmails = getUserEmails(BCCUsers)
                ?.filter((email) => !CCEmails.includes(email) && applicantInfo?.email !== email);
            await notificationService.rejectQuestionNotification(application?.applicant?.applicantEmail,
                CCEmails,
                toBCCEmails, {
                firstName: application?.applicant?.applicantName,
                reviewComments
            }, {
                study: `${studyLabelForEmailBody(application)},`
            });
        }
    }
}


const getUserEmails = (users) => {
    return users
        ?.filter((aUser) => aUser?.email)
        ?.map((aUser)=> aUser.email);
}

const getApplicationQuestionnaire = (aApplication) => {
    const questionnaire = parseJsonString(aApplication?.questionnaireData);
    if (!questionnaire) {
        console.error(ERROR.FAILED_STORE_APPROVED_STUDIES + ` id=${aApplication?._id}`);
        return null;
    }
    return questionnaire;
}

function logDaysDifference(inactiveDays, accessedAt, applicationID) {
    const startedDate = accessedAt; // Ensure it's a Date object
    const endDate = getCurrentTime();
    const differenceMs = endDate - startedDate; // Difference in milliseconds
    const days = Math.floor(differenceMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((differenceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((differenceMs % (1000 * 60 * 60)) / (1000 * 60));
    console.log(`Application ID: ${applicationID}, Inactive Days: ${inactiveDays}, Last Accessed: ${startedDate}, Current Time: ${endDate}  Difference: ${days} days, ${hours} hours, ${minutes} minutes`);
}

module.exports = {
    Application,
    VALID_ORDER_BY_LIST_APPLICATIONS
};
