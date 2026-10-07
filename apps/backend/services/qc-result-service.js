const ERROR = require("../constants/error-constants");
const {VALIDATION, VALIDATION_STATUS} = require("../constants/submission-constants");
const {getSortDirection} = require("../crdc-datahub-database-drivers/utility/mongodb-utility");
const {replaceErrorString} = require("../utility/string-util");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const {verifySession} = require("../verifier/user-info-verifier");
const {UserScope} = require("../domain/user-scope");
const QCResultDAO = require("../dao/qcResult");
const SubmissionDAO = require("../dao/submission");

class QcResultService{
    constructor(authorizationService){
        this.authorizationService = authorizationService;
        this.qcResultDAO = new QCResultDAO();
        this.submissionDAO = new SubmissionDAO();
        this.dataRecordService = null;
    }

    setDataRecordService(dataRecordService) {
        this.dataRecordService = dataRecordService;
    }

    /**
     * List QC result rows for a submission, including submission-level orphan file errors.
     * When fileErrors is empty, paging stays in the DAO. Otherwise the full filtered
     * collection is merged with fileErrors, sorted, and paged here.
     * @param {object} params GraphQL arguments, including submission _id and table filters
     * @param {object} context Request context
     * @returns {Promise<{results: object[], total: number}>}
     */
    async submissionQCResultsAPI(params, context){
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        // Check that the specified submissionID exists
        const submission = await this.submissionDAO.findFirst({_id: params._id});
        if(!submission){
            throw new Error(ERROR.INVALID_SUBMISSION_NOT_FOUND);
        }
        const fileErrors = submission.fileErrors;
        if (!fileErrors || fileErrors.length === 0) {
            return await this.qcResultDAO.submissionQCResults(params._id, params.nodeTypes, params.batchIDs, params.severities, params.issueCode, params.first, params.offset, params.orderBy, params.sortDirection);
        }
        const qcResults = await this.qcResultDAO.submissionQCResults(
            params._id, params.nodeTypes, params.batchIDs, params.severities, params.issueCode,
            -1, 0, params.orderBy, params.sortDirection
        );
        const fileRows = this._filterFileErrorRows(
            this.mapSubmissionFileErrorsToQCResults(fileErrors),
            params.nodeTypes,
            params.batchIDs,
            params.severities,
            params.issueCode
        );
        const merged = sortRows([...(qcResults?.results || []), ...fileRows], params.orderBy, params.sortDirection, "type");
        return {
            results: pageRows(merged, params.first, params.offset),
            total: merged.length
        };
    }

    /**
     * Maps submission-level file errors onto QC result rows.
     * @param {object[]} fileErrors Embedded submission.fileErrors
     * @returns {object[]} QC rows including issueCount
     */
    mapSubmissionFileErrorsToQCResults(fileErrors) {
        return (fileErrors || []).map((fileError) => {
            const errors = fileError?.errors || [];
            const warnings = fileError?.warnings || [];
            return {
                submissionID: fileError?.submissionID,
                dataRecordID: fileError?.dataRecordID,
                validationType: fileError?.validationType,
                batchID: fileError?.batchID,
                displayID: fileError?.displayID,
                type: fileError?.type,
                submittedID: fileError?.submittedID,
                severity: fileError?.severity,
                uploadedDate: fileError?.uploadedDate,
                validatedDate: fileError?.validatedDate,
                errors,
                warnings,
                issueCount: errors.length + warnings.length
            };
        });
    }

    /**
     * Applies the same node, batch, severity, and issue-code filters as submissionQCResults.
     * Only the first batch ID is used. Error and Warning filters set issueCount from that array.
     * @param {object[]} rows Mapped file-error QC rows
     * @param {string[]} nodeTypes Node type filter
     * @param {string[]} batchIDs Batch ID filter
     * @param {string} severities Error, Warning, or All
     * @param {string} issueCode Issue code filter
     * @returns {object[]}
     */
    _filterFileErrorRows(rows, nodeTypes, batchIDs, severities, issueCode) {
        const batchID = batchIDs?.length > 0 ? batchIDs[0] : null;
        return (rows || []).filter((row) => {
            const errors = row.errors || [];
            const warnings = row.warnings || [];
            if (severities === VALIDATION_STATUS.ERROR && errors.length === 0) {
                return false;
            }
            if (severities === VALIDATION_STATUS.WARNING && warnings.length === 0) {
                return false;
            }
            if (nodeTypes?.length > 0 && !nodeTypes.includes(row.type)) {
                return false;
            }
            if (batchID && row.batchID !== batchID) {
                return false;
            }
            if (issueCode) {
                const matchesCode = errors.some((error) => error?.code === issueCode)
                    || warnings.some((warning) => warning?.code === issueCode);
                if (!matchesCode) {
                    return false;
                }
            }
            if (severities === VALIDATION_STATUS.ERROR) {
                row.issueCount = errors.length;
            } else if (severities === VALIDATION_STATUS.WARNING) {
                row.issueCount = warnings.length;
            }
            return true;
        });
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
                ? [VALIDATION.TYPES.DATA_FILE, VALIDATION.TYPES.FILE]
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
                query.submittedID = submittedIDs;
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

    /**
     * Find QC results for a submission that include a specific error code.
     * @param {string} submissionID Submission ID
     * @param {string} errorCode Error code to match
     * @returns {Promise<object[]>}
     */
    async findBySubmissionErrorCodes(submissionID, errorCode) {
        return this.qcResultDAO.findBySubmissionErrorCodes(submissionID, errorCode);
    }

    /**
     * Return submittedID and dataRecordID for QC results of a given type in a submission.
     * @param {string} submissionID Submission ID
     * @param {string} errorType Node/error type to match
     * @returns {Promise<object[]>}
     */
    async getQCResultsErrors(submissionID, errorType) {
        return this.qcResultDAO.getQCResultsErrors(submissionID, errorType);
    }

    async resetQCResultData(submissionID) {
        return await this.qcResultDAO.deleteMany({submissionID});
    }

    /**
     * Aggregate QC issues for a submission, including orphan file errors on the submission.
     * When fileErrors is empty, paging stays in the DAO.
     * @param {object} params GraphQL arguments, including submissionID and severity
     * @param {object} context Request context
     * @returns {Promise<{results: object[], total: number}>}
     */
    async aggregatedSubmissionQCResultsAPI(params, context) {
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        // Check that the specified submissionID exists
        const submission = await this.submissionDAO.findFirst({_id: params.submissionID});
        if(!submission){
            throw new Error(ERROR.INVALID_SUBMISSION_NOT_FOUND);
        }
        const fileErrors = submission.fileErrors;
        if (!fileErrors || fileErrors.length === 0) {
            return await this.qcResultDAO.aggregatedSubmissionQCResults(params.submissionID, params.severity, params.first, params.offset, params.orderBy, params.sortDirection);
        }
        const aggregated = await this.qcResultDAO.aggregatedSubmissionQCResults(
            params.submissionID, params.severity, -1, 0, params.orderBy, params.sortDirection
        );
        const merged = mergeAggregatedGroups(aggregated?.results || [], fileErrors, params.severity);
        const sorted = sortRows(
            merged,
            params.orderBy,
            params.sortDirection,
            ["title", "severity", "code", "property", "value"]
        );
        return {
            results: pageRows(sorted, params.first, params.offset),
            total: sorted.length
        };
    }

    async retrieveSubmissionQCComparisonsAPI(params, context) {
        verifySession(context)
            .verifyInitialized();
        const createScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE);
        const viewScope = await this._getUserScope(context?.userInfo, USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.VIEW);
        if (createScope.isNoneScope() && viewScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const submission = await this.submissionDAO.findFirst({_id: params.submissionID});
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

/**
 * Compare two sort values. Nulls sort first.
 * @param {*} left Left value
 * @param {*} right Right value
 * @returns {number}
 */
function compareValues(left, right) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return -1;
    }
    if (right == null) {
        return 1;
    }
    if (left > right) {
        return 1;
    }
    if (left < right) {
        return -1;
    }
    return 0;
}

/**
 * Sort rows by orderBy, then by secondary fields ascending.
 * @param {object[]} rows Rows to sort
 * @param {string} orderBy Primary sort field
 * @param {string} sortDirection asc or desc
 * @param {string|string[]} [secondaryField] Tie-break field or fields, each sorted ascending
 * @returns {object[]}
 */
function sortRows(rows, orderBy, sortDirection, secondaryField) {
    const direction = getSortDirection(sortDirection);
    const primary = orderBy || "uploadedDate";
    const secondaryFields = Array.isArray(secondaryField)
        ? secondaryField
        : (secondaryField ? [secondaryField] : []);
    return [...(rows || [])].sort((left, right) => {
        const primaryCompare = compareValues(left?.[primary], right?.[primary]) * direction;
        if (primaryCompare !== 0) {
            return primaryCompare;
        }
        for (const field of secondaryFields) {
            if (field === primary) {
                continue;
            }
            const secondaryCompare = compareValues(left?.[field], right?.[field]);
            if (secondaryCompare !== 0) {
                return secondaryCompare;
            }
        }
        return 0;
    });
}

/**
 * Apply offset and limit. A first value below 1 returns the remainder of the list.
 * @param {object[]} rows Sorted rows
 * @param {number} first Page size
 * @param {number} offset Page offset
 * @returns {object[]}
 */
function pageRows(rows, first, offset) {
    const start = offset > 0 ? offset : 0;
    if (first > 0) {
        return rows.slice(start, start + first);
    }
    return rows.slice(start);
}

/**
 * Identity for an aggregated QC issue group.
 * @param {object} group Aggregated issue
 * @returns {string}
 */
function aggregatedGroupKey(group) {
    return JSON.stringify({
        title: group?.title,
        severity: group?.severity,
        code: group?.code,
        property: group?.property ?? "N/A",
        value: group?.value ?? "N/A"
    });
}

/**
 * Count orphan file-error issues using the same group key as aggregated QC results.
 * Identical issues on one file-error row count once.
 * @param {object[]} fileErrors Embedded submission.fileErrors
 * @param {string} severity error, warning, or all
 * @returns {object[]} Aggregated groups
 */
function aggregatedGroupsFromFileErrors(fileErrors, severity) {
    const normalized = typeof severity === "string" ? severity.toLowerCase() : "";
    const includeErrors = normalized !== VALIDATION_STATUS.WARNING.toLowerCase();
    const includeWarnings = normalized !== VALIDATION_STATUS.ERROR.toLowerCase();
    const counts = new Map();
    for (const fileError of fileErrors || []) {
        const seen = new Set();
        const issues = [];
        if (includeErrors) {
            for (const error of fileError?.errors || []) {
                issues.push([error, VALIDATION_STATUS.ERROR]);
            }
        }
        if (includeWarnings) {
            for (const warning of fileError?.warnings || []) {
                issues.push([warning, VALIDATION_STATUS.WARNING]);
            }
        }
        for (const [issue, issueSeverity] of issues) {
            const group = {
                title: issue?.title,
                severity: issueSeverity,
                code: issue?.code,
                property: issue?.offendingProperty ?? "N/A",
                value: issue?.offendingValue ?? "N/A",
                count: 0
            };
            const key = aggregatedGroupKey(group);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const current = counts.get(key) || group;
            current.count += 1;
            counts.set(key, current);
        }
    }
    return [...counts.values()];
}

/**
 * Add file-error issue counts onto aggregated QC groups.
 * DAO rows that share a displayed key stay separate. A matching file-error count is added to the first of them.
 * @param {object[]} daoGroups Groups from the QC results collection
 * @param {object[]} fileErrors Embedded submission.fileErrors
 * @param {string} severity error, warning, or all
 * @returns {object[]}
 */
function mergeAggregatedGroups(daoGroups, fileErrors, severity) {
    const mergedGroups = [];
    for (const daoGroup of daoGroups || []) {
        mergedGroups.push({ ...daoGroup });
    }
    for (const fileErrorGroup of aggregatedGroupsFromFileErrors(fileErrors, severity)) {
        const key = aggregatedGroupKey(fileErrorGroup);
        const matchingGroup = mergedGroups.find((group) => aggregatedGroupKey(group) === key);
        if (matchingGroup) {
            matchingGroup.count += fileErrorGroup.count;
        } else {
            mergedGroups.push({ ...fileErrorGroup });
        }
    }
    return mergedGroups;
}

module.exports = {
    QcResultService
};
