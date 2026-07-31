const ERROR = require("../constants/error-constants");
const {VALIDATION, VALIDATION_STATUS} = require("../constants/submission-constants");
const {replaceErrorString} = require("../utility/string-util");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const {verifySession} = require("../verifier/user-info-verifier");
const {UserScope} = require("../domain/user-scope");
const QCResultDAO = require("../dao/qcResult");
const SubmissionDAO = require("../dao/submission");

class QcResultService{
    constructor(qcResultCollection, submissionCollection, authorizationService){
        this.qcResultCollection = qcResultCollection;
        this.submissionCollection = submissionCollection;
        this.authorizationService = authorizationService;
        this.qcResultDAO = new QCResultDAO(this.qcResultCollection);
        this.submissionDAO = new SubmissionDAO();
        this.dataRecordService = null;
    }

    setDataRecordService(dataRecordService) {
        this.dataRecordService = dataRecordService;
    }

    async submissionQCResultsAPI(params, context){
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        // Check that the specified submissionID exists
        const submission = await this.submissionDAO.findFirst({id: params._id});
        if(!submission){
            throw new Error(ERROR.INVALID_SUBMISSION_NOT_FOUND);
        }
        return await this.qcResultDAO.submissionQCResults(params._id, params.nodeTypes, params.batchIDs, params.severities, params.issueCode, params.first, params.offset, params.orderBy, params.sortDirection);
    }

    /**
     * Delete QC results by submission ID
     * @param {string} submissionID - The submission ID
     * @param {string} dataType - The validation type (e.g., "file", "metadata")
     * @param {string[]} submittedIDs - Array of submitted identifiers. Can be file names (for file validation) or node IDs (for metadata validation)
     * @param {boolean} deleteAll - If true, delete all QC results for the submission and type
     * @param {string[]} exclusiveIDs - IDs to exclude from deletion when deleteAll is true
     */
    async deleteQCResultBySubmissionID(submissionID, dataType, submittedIDs, deleteAll = false, exclusiveIDs = []) {
        const isFileValidationQC =
            dataType === VALIDATION.TYPES.DATA_FILE || dataType === VALIDATION.TYPES.FILE;
        let query = {
            submissionID: submissionID,
            validationType: isFileValidationQC
                ? {in: [VALIDATION.TYPES.DATA_FILE, VALIDATION.TYPES.FILE]}
                : dataType
        };
        
        if (deleteAll) {
            // When deleteAll is true, delete all QC results for submissionID and type
            // If exclusiveIDs are provided, exclude them from deletion
            if (exclusiveIDs && exclusiveIDs.length > 0) {
                query.submittedID = {
                    notIn: exclusiveIDs
                };
            }
            // If no exclusiveIDs, query will delete all (no submittedID filter)
        } else {
            // Normal deletion: delete specific submittedIDs
            if (submittedIDs && submittedIDs.length > 0) {
                query.submittedID = {
                    in: submittedIDs
                };
            } else {
                // No submittedIDs provided, nothing to delete
                return;
            }
        }
        
        const res = await this.qcResultDAO.deleteMany(query);

        // Only validate count for non-deleteAll operations. File QC deletes may remove multiple rows per
        // submittedID (both validation types), so res.count > submittedIDs.length is expected — log under-delete only.
        if (!deleteAll && submittedIDs && submittedIDs.length > 0 &&
            (res.count === 0 || res.count < submittedIDs.length)) {
            console.error("An error occurred while deleting the qcResult records", `submissionID: ${submissionID}`);
        }
    }

    async findBySubmissionErrorCodes(submissionID, errorCode) {
        return this.qcResultDAO.findMany({
            submissionID: submissionID, errors: {some: {code: errorCode}}},
            {
                select: {
                    submittedID: true,
                    submissionID: true
            }
        });
    }

    async getQCResultsErrors(submissionID, errorType) {
        const result = await this.qcResultCollection.aggregate([
            {"$match": { submissionID: submissionID, type: errorType}},
            {"$project": {submittedID: 1, dataRecordID: 1}}
        ]);
        return result || [];
    }

    async resetQCResultData(submissionID) {
        return await this.qcResultDAO.deleteMany({submissionID});
    }

    async aggregatedSubmissionQCResultsAPI(params, context) {
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        // Check that the specified submissionID exists
        const submission = await this.submissionDAO.findFirst({id: params.submissionID});
        if(!submission){
            throw new Error(ERROR.INVALID_SUBMISSION_NOT_FOUND);
        }
        return await this.qcResultDAO.aggregatedSubmissionQCResults(params.submissionID, params.severity, params.first, params.offset, params.orderBy, params.sortDirection);
    }

    async retrieveSubmissionQCComparisonsAPI(params, context) {
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const submission = await this.submissionDAO.findFirst({id: params.submissionID});
        if (!submission) {
            throw new Error(ERROR.INVALID_SUBMISSION_NOT_FOUND);
        }
        if (!this.dataRecordService) {
            throw new Error("DataRecordService is not initialized.");
        }

        const normalizedIssueCode = typeof params.issueCode === "string"
            ? params.issueCode.trim()
            : null;
        const isAllIssueCode = !normalizedIssueCode || normalizedIssueCode.toLowerCase() === "all";
        if (!isAllIssueCode && normalizedIssueCode !== VALIDATION.CODES.UPDATE_EXISTING_DATA) {
            return {
                total: 0,
                skipped: 0,
                comparisons: []
            };
        }

        const qcResults = await this.qcResultDAO.submissionQCResults(
            params.submissionID,
            params.nodeTypes,
            params.batchIDs,
            params.severities,
            VALIDATION.CODES.UPDATE_EXISTING_DATA,
            -1,
            0,
            "uploadedDate",
            "DESC"
        );

        const filteredResults = this._filterUnpackedValidationResults(
            qcResults?.results || [],
            params.severities,
            VALIDATION.CODES.UPDATE_EXISTING_DATA
        );

        const comparisonCandidates = filteredResults
            .filter((row) => row?.warnings?.[0]?.code === VALIDATION.CODES.UPDATE_EXISTING_DATA || row?.errors?.[0]?.code === VALIDATION.CODES.UPDATE_EXISTING_DATA)
            .map((row) => ({
                submittedID: row?.submittedID,
                nodeType: row?.type
            }));

        if (comparisonCandidates.length === 0) {
            return {
                total: 0,
                skipped: 0,
                comparisons: []
            };
        }

        const {comparisons, skipped} = await this.dataRecordService.getReleasedAndNewNodesByList(
            params.submissionID,
            submission?.dataCommons,
            params.status,
            comparisonCandidates
        );

        return {
            total: comparisons.length,
            skipped,
            comparisons: comparisons.map((item) => ({
                submittedID: item.submittedID,
                nodeType: item.nodeType,
                existingProps: JSON.stringify(item.existing || {}),
                incomingProps: JSON.stringify(item.incoming || {})
            }))
        };
    }

    _unpackValidationSeverities(results) {
        const unpacked = [];
        (results || []).forEach(({errors = [], warnings = [], ...rest}) => {
            errors.forEach((error) => {
                unpacked.push({
                    ...rest,
                    severity: VALIDATION_STATUS.ERROR,
                    errors: [error],
                    warnings: []
                });
            });
            warnings.forEach((warning) => {
                unpacked.push({
                    ...rest,
                    severity: VALIDATION_STATUS.WARNING,
                    errors: [],
                    warnings: [warning]
                });
            });
        });
        return unpacked;
    }

    _filterUnpackedValidationResults(results, severity, issueCode) {
        const severityFilter = typeof severity === "string" ? severity.toLowerCase() : null;
        const targetIssueCode = typeof issueCode === "string" ? issueCode.trim() : null;
        const normalizedIssueCode = typeof issueCode === "string" ? issueCode.trim().toLowerCase() : null;
        return this._unpackValidationSeverities(results).filter((row) => {
            const rowSeverity = row?.severity?.toLowerCase?.();
            const severityMatch = !severityFilter || severityFilter === "all"
                ? true
                : rowSeverity === severityFilter;
            const issueCodeMatch = !normalizedIssueCode || normalizedIssueCode === "all"
                ? true
                : row?.errors?.[0]?.code === targetIssueCode || row?.warnings?.[0]?.code === targetIssueCode;
            return severityMatch && issueCodeMatch;
        });
    }


    async _getUserScope(userInfo, permission) {
        const validScopes = await this.authorizationService.getPermissionScope(userInfo, permission);
        const userScope = UserScope.create(validScopes);
        // valid scopes; none, all, role/role:RoleScope
        const isValidUserScope = userScope.isNoneScope() || userScope.isAllScope() || userScope.isStudyScope() || userScope.isDCScope() || userScope.isOwnScope();
        if (!isValidUserScope) {
            console.warn(ERROR.INVALID_USER_SCOPE, permission);
            throw new Error(replaceErrorString(ERROR.INVALID_USER_SCOPE));
        }
        return userScope;
    }
}

class QCResult {
    constructor(type, validationType, submittedID, batchID, displayID, severity, uploadedDate, validatedDate, errors, warnings, dataRecordID, origin) {
        this.type = type;
        this.validationType = validationType;
        this.submittedID = submittedID;
        this.batchID = batchID;
        this.displayID = displayID;
        this.severity = severity;
        this.uploadedDate = uploadedDate;
        this.validatedDate = validatedDate;
        this.errors = errors || [];
        this.warnings = warnings || [];
        this.dataRecordID = dataRecordID;
        if (origin) {
            this.origin = origin;
        }
    }

    static create(type, validationType, submittedID, batchID, displayID, severity, uploadedDate, validatedDate, errors, warnings, dataRecordID, origin) {
        return new QCResult(type, validationType, submittedID, batchID, displayID, severity, uploadedDate, validatedDate, errors, warnings, dataRecordID, origin);
    }

}

class QCResultError {
    constructor(title, description, severity, code) {
        this.title = title;
        this.description = description;
        this.severity = severity;
        this.code = code;
    }

    static create(title, description, severity, code) {
        return new QCResultError(title, description, severity, code);
    }
}

module.exports = {
    QcResultService
};
