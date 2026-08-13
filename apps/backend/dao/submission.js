const MongooseGenericDAO = require("./mongoose-generic");
const SubmissionModel = require("../mongoose/models/submission");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {SUBMISSION_ORDER_BY_MAP} = require("../constants/submission-constants");
const {DELETED, CANCELED, NEW, IN_PROGRESS, SUBMITTED, WITHDRAWN, RELEASED, REJECTED, COMPLETED, ARCHIVED,
    COLLABORATOR_PERMISSIONS
} = require("../constants/submission-constants");
const ERROR = require("../constants/error-constants");
const {replaceErrorString, escapeRegexLiteral} = require("../utility/string-util");
const {formatNestedOrganization, formatNestedOrganizations} = require("../utility/organization-transformer");
const { isAllStudy } = require("../utility/study-utility");
const {subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {PROGRAM} = require("../crdc-datahub-database-drivers/constants/organization-constants");
const USER_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-constants");
const {
    APPROVED_STUDIES_COLLECTION,
    ORGANIZATION_COLLECTION,
    USER_COLLECTION,
} = require("../crdc-datahub-database-drivers/database-constants");
const ProgramDAO = require("./program");
const ApprovedStudyDAO = require("./approvedStudy");
const UserDAO = require("./user");
const ALL_FILTER = "All";
const NA = "NA";
const ROLES = USER_CONSTANTS.USER.ROLES;
// Sort fields sourced from a $lookup, mapped to the flat sort key they are remapped onto.
// Ordering by any of these forces the joins to run before pagination.
const JOINED_SORT_KEYS = {
    "organization.name": "organizationSort",
    "submitter.fullName": "submitterSort",
    "concierge.fullName": "conciergeSort",
    "study.studyAbbreviation": "studyAbbreviationSort",
};

/**
 * Mongoose-backed DAO for submission documents.
 */
class SubmissionDAO extends MongooseGenericDAO {
    constructor() {
        super(SubmissionModel);
        this.programDAO = new ProgramDAO();
        this.approvedStudyDAO = new ApprovedStudyDAO();
        this.userDAO = new UserDAO();
    }

    /**
     * Returns submission IDs for studies that use the program-level primary contact.
     * @param {string[]} studyIDs Approved study IDs
     * @returns {Promise<Array<{_id: string}>>}
     */
    async programLevelSubmissions(studyIDs) {
        try {
            if (!studyIDs || studyIDs.length === 0) {
                return [];
            }

            const programLevelStudies = await this.approvedStudyDAO.findMany({
                _id: { $in: studyIDs },
                useProgramPC: true,
            }, { projection: { _id: 1 } });
            const programLevelStudyIDs = programLevelStudies.map((study) => study._id);
            if (programLevelStudyIDs.length === 0) {
                return [];
            }

            const submissions = await this.findMany({
                studyID: { $in: programLevelStudyIDs },
            }, { projection: { _id: 1 } });
            return submissions.map((submission) => ({ _id: submission._id }));
        } catch (error) {
            console.error('Error in programLevelSubmissions:', error);
            return [];
        }
    }

    /**
     * Lists submissions with pagination, filtering, and aggregation support.
     * Uses separate count and results queries
     *
     * Two-stage filtering:
     * 1. Base filtering by user scope and permissions (access control)
     * 2. Additional filtering by search parameters (name, status, organization, etc.)
     *
     * @param {Object} userInfo User information object containing user details
     * @param {string} userInfo._id User's unique identifier
     * @param {Array<string>} userInfo.dataCommons Array of data commons the user has access to
     * @param {Object} userScope User scope object defining access permissions
     * @param {Object} params Query parameters for filtering and pagination
     * @param {string} [params.organization] Organization ID to filter by
     * @param {Array<string>} [params.status] Array of submission statuses to filter by
     * @param {string} [params.name] Submission name to search for (case-insensitive)
     * @param {string} [params.dbGaPID] Free-text search over study name, study abbreviation, or dbGaPID
     * @param {string} [params.dataCommons] Data commons identifier to filter by
     * @param {string} [params.submitterName] Submitter name to filter by
     * @param {string} [params.orderBy] Field to order results by
     * @param {number} [params.first] Number of results to return (pagination)
     * @param {number} [params.offset] Number of results to skip (pagination)
     * @param {string} [params.sortDirection] Sort direction ('asc' or 'desc')
     * @param {Array<string>} dataCommonsList Array of all non-hidden data commons from configuration
     * @returns {Promise<Object>} Object containing submissions, total count, and aggregation data
     * @throws {Error} When database query fails or validation errors occur
     */
    async listSubmissions(userInfo, userScope, params, dataCommonsList = []) {
        validateListSubmissionsParams(params);

        const baseConditions = this._generateListSubmissionConditions(userInfo, userScope);

        if (baseConditions === null) {
            return {
                submissions: [],
                total: 0,
                dataCommons: [],
                submitterNames: [],
                organizations: [],
                statuses: []
            };
        }

        // Resolved once and shared by both filter builds; each build would otherwise re-run
        // the same regex query against approved studies.
        const studySearchStudyIDs = await this._findStudyIDsForSearchTerm(params.dbGaPID);

        const filterConditions = await this._addFiltersToBaseConditions(
            userInfo,
            { ...baseConditions },
            params.organization,
            params.status,
            params.name,
            studySearchStudyIDs,
            params.dataCommons,
            params?.submitterName
        );
        if (filterConditions === null) {
            return {
                submissions: [],
                total: 0,
                dataCommons: dataCommonsList || [],
                submitterNames: [],
                organizations: [],
                statuses: []
            };
        }

        const submitterNamesFilterConditions = await this._addFiltersToBaseConditions(
            userInfo,
            { ...baseConditions },
            params.organization,
            params.status,
            params.name,
            studySearchStudyIDs,
            params.dataCommons,
            undefined
        );

        const mappedOrderBy = params?.orderBy
            ? SUBMISSION_ORDER_BY_MAP[params.orderBy] || params.orderBy
            : undefined;

        const normalizedFilterConditions = this._normalizeFilter(filterConditions);
        const normalizedSubmitterNamesFilterConditions = submitterNamesFilterConditions == null
            ? null
            : this._normalizeFilter(submitterNamesFilterConditions);

        try {
            const resultsPipeline = this._buildListSubmissionsPipeline(
                normalizedFilterConditions,
                mappedOrderBy,
                params
            );
            const [submissions, total, submitterNames, organizations] = await Promise.all([
                this.aggregate(resultsPipeline),
                this.count(normalizedFilterConditions),
                this._getDistinctSubmitterNames(normalizedSubmitterNamesFilterConditions),
                this._getDistinctOrganizations(),
            ]);
            const statuses = this._getDistinctStatuses();

            const transformedSubmissions = submissions.map((submission) =>
                this._transformListSubmission(submission, userInfo)
            );

            return {
                submissions: transformedSubmissions,
                total: total,
                dataCommons: dataCommonsList || [],
                submitterNames: submitterNames,
                organizations: organizations,
                statuses: () => statuses
            };
        } catch (error) {
            console.error('Error in listSubmissions:', error);
            throw new Error(`Failed to list submissions: ${error.message}`);
        }
    }

    /**
     * Builds the DocumentDB-safe aggregation pipeline for listSubmissions results.
     *
     * When the sort field comes from a joined collection the joins must run first, so the
     * whole matched set is joined before paginating. Otherwise the page is selected first
     * and only those documents are joined.
     *
     * @param {object} filterConditions $match filter conditions
     * @param {string} [mappedOrderBy] Mapped sort field path
     * @param {object} params Pagination params
     * @returns {object[]}
     */
    _buildListSubmissionsPipeline(filterConditions, mappedOrderBy, params) {
        const joinStages = [
            {
                $lookup: {
                    from: APPROVED_STUDIES_COLLECTION,
                    localField: "studyID",
                    foreignField: "_id",
                    as: "study",
                },
            },
            {
                $lookup: {
                    from: ORGANIZATION_COLLECTION,
                    localField: "programID",
                    foreignField: "_id",
                    as: "organization",
                },
            },
            {
                $lookup: {
                    from: USER_COLLECTION,
                    localField: "submitterID",
                    foreignField: "_id",
                    as: "submitter",
                },
            },
            {
                $lookup: {
                    from: USER_COLLECTION,
                    localField: "conciergeID",
                    foreignField: "_id",
                    as: "concierge",
                },
            },
            {
                $addFields: {
                    study: { $arrayElemAt: ["$study", 0] },
                    organization: { $arrayElemAt: ["$organization", 0] },
                    submitter: { $arrayElemAt: ["$submitter", 0] },
                    concierge: { $arrayElemAt: ["$concierge", 0] },
                },
            },
        ];

        // Defaults to -1 ("no limit") so MongoPagination never emits { $limit: undefined }
        const first = params?.first ?? -1;
        const offset = params?.offset;
        const joinedSortKey = JOINED_SORT_KEYS[mappedOrderBy];

        if (!joinedSortKey) {
            const pagination = new MongoPagination(first, offset, mappedOrderBy, params?.sortDirection);
            return [
                { $match: filterConditions },
                ...pagination.getPaginationPipeline(),
                ...joinStages,
            ];
        }

        // Sorting on a nested path is remapped to a flat, lowercased key; see
        // documentation/documentdb-literal-dotted-keys.md
        const pagination = new MongoPagination(first, offset, joinedSortKey, params?.sortDirection);
        return [
            { $match: filterConditions },
            ...joinStages,
            { $set: { [joinedSortKey]: { $toLower: { $ifNull: [`$${mappedOrderBy}`, ""] } } } },
            ...pagination.getPaginationPipeline(),
        ];
    }

    /**
     * Maps a listSubmissions aggregation row to the GraphQL response shape.
     * @param {object} submission Aggregated submission document
     * @param {object} userInfo Current user context
     * @returns {object}
     */
    _transformListSubmission(submission, userInfo) {
        const study = submission?.study
            ? {
                _id: submission.study._id || submission.study.id,
                studyName: submission.study.studyName,
                studyAbbreviation: submission.study.studyAbbreviation,
                dbGaPID: submission.study.dbGaPID
            }
            : null;
        return {
            ...submission,
            _id: submission._id || submission.id,
            study,
            studyName: submission?.study?.studyName,
            studyAbbreviation: submission?.study?.studyAbbreviation,
            dbGaPID: submission?.study?.dbGaPID ?? submission?.dbGaPID,
            dataFileSize: this._transformDataFileSize(submission.status, submission.dataFileSize),
            organization: formatNestedOrganization(submission.organization),
            submitterName: submission?.submitter?.fullName || "",
            conciergeName: submission?.concierge?.fullName || "",
            conciergeEmail: submission?.concierge?.email || "",
            adminSubmitComment: this._isInternalUser(userInfo)
                ? this._getLatestAdminSubmitComment(submission?.history)
                : null,
        };
    }

    /**
     * Determines whether a user is an internal role eligible to view admin submit comments.
     *
     * @param {Object} userInfo - Current user context
     * @param {string} userInfo.role - User role
     * @returns {boolean} True when the role is Admin, Data Commons Personnel, or Federal Lead
     */
    _isInternalUser(userInfo) {
        return [ROLES.ADMIN, ROLES.DATA_COMMONS_PERSONNEL, ROLES.FEDERAL_LEAD].includes(
            userInfo?.role
        );
    }

    /**
     * Extracts the latest admin submit review comment from submission history.
     *
     * Rules:
     * - Only history entries with status `Submitted` and `isAdminSubmit === true` are considered
     * - Returns the most recent matching entry's `reviewComment`
     * - Returns null when no matching event exists
     *
     * @param {Array<Object>} history - Submission history events
     * @returns {string|null} Latest admin submit comment, otherwise null
     */
    _getLatestAdminSubmitComment(history = []) {
        if (!Array.isArray(history) || history.length === 0) {
            return null;
        }

        const validAdminSubmitEvents = history.filter(
            ({ status, isAdminSubmit }) => status === SUBMITTED && isAdminSubmit === true
        );
        return validAdminSubmitEvents.at(-1)?.reviewComment || null;
    }

    /**
     * Generates base filter conditions based on user scope and permissions.
     *
     * @param {Object} userInfo - User information object containing user details
     * @param {string} userInfo._id - User's unique identifier
     * @param {Array<string>} userInfo.dataCommons - Array of data commons the user has access to
     * @param {Object} userScope - User scope object defining access permissions
     * @returns {Object|null} Base filter for submissions by user scope, or null when no access
     * @throws {Error} When user scope is invalid or permission verification fails
     */
    _generateListSubmissionConditions(userInfo, userScope) {
        const baseConditions = {};
        if (userScope.isAllScope()) {
            // No filtering required for all scope
        }
        else if (userScope.isStudyScope()) {
            const studyScope = userScope.getStudyScope();
            if (!isAllStudy(studyScope?.scopeValues)) {
                const studyIDs = studyScope?.scopeValues || [];
                baseConditions.studyID = { $in: studyIDs };
            }
        }
        else if (userScope.isDCScope()) {
            baseConditions.dataCommons = { $in: userInfo?.dataCommons || [] };
        }
        else if (userScope.isOwnScope()) {
            const userStudies = userInfo?.studies || [];

            if (!isAllStudy(userStudies)) {
                const userStudyIDs = userStudies.map(study => study._id);
                if (userStudyIDs && userStudyIDs.length > 0) {
                    baseConditions.studyID = { $in: userStudyIDs };
                }
                else {
                    return null;
                }
            }

            baseConditions.$or = [
                { submitterID: userInfo._id },
                {
                    collaborators: {
                        $elemMatch: {
                            collaboratorID: userInfo._id,
                            permission: { $in: [COLLABORATOR_PERMISSIONS.CAN_EDIT] }
                        }
                    }
                }
            ];
        }
        else {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        return baseConditions;
    }

    /**
     * Resolves the free-text study search to the IDs of the approved studies it matches.
     * @param {string} [dbGaPID] Free-text search over study name, study abbreviation, or dbGaPID
     * @returns {Promise<string[]|null>} Matching study IDs, or null when no search term was given
     */
    async _findStudyIDsForSearchTerm(dbGaPID) {
        const dbGaPIDRaw = (dbGaPID || '').trim().replace(/\\/g, '');
        const sanitizedStudySearchTerm = dbGaPIDRaw ? escapeRegexLiteral(dbGaPIDRaw) : '';
        if (!sanitizedStudySearchTerm) {
            return null;
        }
        const matchingStudies = await this.approvedStudyDAO.findMany({
            $or: [
                { studyName: { $regex: sanitizedStudySearchTerm, $options: 'i' } },
                { studyAbbreviation: { $regex: sanitizedStudySearchTerm, $options: 'i' } },
                { dbGaPID: { $regex: sanitizedStudySearchTerm, $options: 'i' } },
            ],
        }, { projection: { _id: 1 } });
        return matchingStudies.map((study) => study._id);
    }

    /**
     * Adds search and filter conditions to base user scope conditions.
     * The submitterName filter is resolved via the user collection so the main $match
     * stays DocumentDB-friendly (no relation filters).
     *
     * @param {Object} userInfo - User information object containing user details
     * @param {Array<string>} userInfo.dataCommons - Array of data commons the user has access to
     * @param {Object} baseConditions - Base filter from user scope filtering
     * @param {string} organization - Organization ID to filter by (maps to programID field)
     * @param {Array<string>|null} status - Array of submission statuses to filter by, or null for no filter
     * @param {string} submissionName - Submission name to search for (case-insensitive)
     * @param {Array<string>|null} studySearchStudyIDs - Study IDs matching the free-text study
     * search, from `_findStudyIDsForSearchTerm`, or null when no study search was requested
     * @param {string} dataCommonsFilter - Data commons identifier to filter by
     * @param {string} submitterName - Submitter name to filter by
     * @returns {Promise<Object|null>} Combined filter including both user scope and search filters,
     * or null when a study text search matches no studies (caller should return empty results)
     */
    async _addFiltersToBaseConditions(userInfo, baseConditions, organization, status, submissionName, studySearchStudyIDs, dataCommonsFilter, submitterName) {
        const validSubmissionStatus = [NEW, IN_PROGRESS, SUBMITTED, RELEASED, COMPLETED, ARCHIVED, CANCELED,
            REJECTED, WITHDRAWN, DELETED];

        // If no baseConditions, return null to indicate no results without needing to execute queries
        if (baseConditions === null) {
            return null;
        }

        // Add organization filter if specified
        // Note: organization parameter expects organization ID to filter by programID field
        if (organization && organization !== ALL_FILTER) {
            baseConditions.programID = organization.trim();
        }
        if (status && !status?.includes(ALL_FILTER)) {
            if (status.length > 0) {
                baseConditions.status = { $in: status };
            }
        } else if (status !== null) {
            baseConditions.status = { $in: validSubmissionStatus };
        }
        if (submissionName) {
            const submissionNameRaw = submissionName.trim().replace(/\\/g, '');
            if (submissionNameRaw) {
                baseConditions.name = {
                    $regex: escapeRegexLiteral(submissionNameRaw),
                    $options: 'i'
                };
            }
        }
        if (studySearchStudyIDs !== null && studySearchStudyIDs !== undefined) {
            if (studySearchStudyIDs.length === 0) {
                return null;
            }
            this._intersectStudyIDFilter(baseConditions, studySearchStudyIDs);
            if (baseConditions.studyID?.$in?.length === 0) {
                return null;
            }
        }
        if (dataCommonsFilter && dataCommonsFilter !== ALL_FILTER) {
            if (baseConditions.dataCommons) {
                const existingValues = baseConditions.dataCommons.$in || [];
                const newValue = dataCommonsFilter.trim();
                const intersection = existingValues.filter(value => value === newValue);
                if (intersection.length > 0) {
                    baseConditions.dataCommons = { $in: intersection };
                }
            } else {
                baseConditions.dataCommons = dataCommonsFilter.trim();
            }
        }
        if (submitterName && submitterName !== ALL_FILTER) {
            const submitters = await this.userDAO.findMany({
                fullName: submitterName.trim(),
            }, { projection: { _id: 1 } });
            const submitterIDs = submitters.map((user) => user._id);
            baseConditions.submitterID = { $in: submitterIDs };
        }
        return baseConditions;
    }

    /**
     * Intersects an existing studyID $in filter with matching study IDs, or sets a new $in filter.
     * @param {object} baseConditions Mutable filter conditions
     * @param {string[]} matchingStudyIDs Study IDs matching the free-text study search
     */
    _intersectStudyIDFilter(baseConditions, matchingStudyIDs) {
        if (baseConditions.studyID?.$in) {
            const existing = new Set(baseConditions.studyID.$in);
            baseConditions.studyID = {
                $in: matchingStudyIDs.filter((id) => existing.has(id)),
            };
        } else {
            baseConditions.studyID = { $in: matchingStudyIDs };
        }
    }

    /**
     * Retrieves distinct submitter names from submissions based on filter conditions.
     * Excludes the submitterName self-filter so dropdown options stay based on other criteria.
     *
     * @param {Object} filterConditions - Filter conditions for submissions
     * @returns {Promise<Array<string>>} Array of distinct submitter names
     */
    async _getDistinctSubmitterNames(filterConditions) {
        try {
            if (filterConditions === null) {
                return [];
            }
            const pipeline = [
                { $match: filterConditions },
                { $group: { _id: "$submitterID" } },
                {
                    $lookup: {
                        from: USER_COLLECTION,
                        localField: "_id",
                        foreignField: "_id",
                        as: "submitter",
                    },
                },
                { $unwind: { path: "$submitter", preserveNullAndEmptyArrays: false } },
                { $project: { fullName: "$submitter.fullName" } },
            ];
            const submissions = await this.aggregate(pipeline);
            const submitterNames = submissions
                .map((sub) => sub?.fullName)
                .filter(Boolean);

            // Sorted in JS: a pipeline $sort is binary ("Zoe" before "alice") and DocumentDB
            // collation support is limited to 8.0 non-elastic instances.
            return Array.from(new Set(submitterNames)).sort((a, b) => a.localeCompare(b));
        } catch (error) {
            console.error('Error getting distinct submitterNames:', error);
            return [];
        }
    }

    /**
     * Retrieves all organizations (programs) from the database via Mongoose ProgramDAO.
     *
     * @returns {Promise<Array<Object>>} Array of organization objects with _id, name, and abbreviation
     */
    async _getDistinctOrganizations() {
        try {
            const organizations = await this.programDAO.findMany({
                status: {
                    $in: [PROGRAM.STATUSES.ACTIVE, PROGRAM.STATUSES.INACTIVE]
                }
            });

            return formatNestedOrganizations(organizations);
        } catch (error) {
            console.error('Error getting distinct organizations:', error);
            return [];
        }
    }

    /**
     * Returns all possible submission statuses as a predefined list.
     * This ensures filter options remain constant regardless of applied filters.
     *
     * @returns {Array<string>} Array of all submission statuses in display order
     */
    _getDistinctStatuses() {
        return [NEW, IN_PROGRESS, SUBMITTED, WITHDRAWN, RELEASED, REJECTED, COMPLETED, CANCELED, DELETED];
    }

    /**
     * Transforms data file size based on submission status.
     * Returns zero size for deleted or canceled submissions, otherwise returns the original size.
     *
     * @param {string} status - Submission status
     * @param {Object} dataFileSize - Original data file size object
     * @returns {Object} Transformed data file size object
     */
    _transformDataFileSize(status, dataFileSize) {
        if ([DELETED, CANCELED].includes(status)) {
            return { size: 0, formatted: NA };
        }
        return dataFileSize;
    }

    /**
     * Finds submissions inactive longer than the given day threshold that have not yet
     * been flagged for the given reminder field.
     * @param {number} inactiveDays Days of inactivity
     * @param {string} inactiveFlagField Reminder flag field name on the submission
     * @returns {Promise<object[]>}
     */
    async getInactiveSubmission(inactiveDays, inactiveFlagField) {
        try {
            return await this.findMany({
                accessedAt: {
                    $lt: subtractDaysFromNow(inactiveDays),
                },
                status: {
                    $in: [NEW, IN_PROGRESS, REJECTED, WITHDRAWN]
                },
                [inactiveFlagField]: { $ne: true }
            });
        } catch (error) {
            console.error('Error getting getInactiveSubmission:', error);
            return [];
        }
    }

    /**
     * Finds submissions eligible for deletion based on inactivity days.
     * @param {number} inactiveSubmissionDays Days of inactivity before deletion
     * @returns {Promise<object[]>}
     */
    async getToBeDeletedSubmissions(inactiveSubmissionDays) {
        try {
            return await this.findMany({
                status: {
                    $in: [IN_PROGRESS, NEW, REJECTED, WITHDRAWN]
                },
                accessedAt: {
                    $ne: null,
                    $lt: subtractDaysFromNow(inactiveSubmissionDays)
                }
            });
        }  catch (error) {
            console.error('Error getting getToBeDeletedSubmissions:', error);
            return [];
        }
    }

    /**
     * Finds completed submissions past the retention window for archival.
     * @param {number} completedSubmissionDays Retention days after completion
     * @returns {Promise<object[]>}
     */
    async getToBeArchivedSubmissions(completedSubmissionDays) {
        try {
            const targetRetentionDate = new Date();
            targetRetentionDate.setDate(targetRetentionDate.getDate() - completedSubmissionDays);
            return await this.findMany({
                status: COMPLETED,
                updatedAt: {
                    $lte: targetRetentionDate
                }
            });
        } catch (error) {
            console.error('Error getting archiveCompletedSubmissions:', error);
            return [];
        }
    }
}

/**
 * Validates parameters for the listSubmissions method.
 * Checks that all provided status values are valid submission statuses.
 *
 * @param {Object} params - Query parameters object
 * @param {Array<string>} [params.status] - Array of status values to validate
 * @throws {Error} When invalid status values are provided
 */
function validateListSubmissionsParams (params) {
    const validStatus = new Set([NEW, IN_PROGRESS, SUBMITTED, RELEASED, COMPLETED, ARCHIVED, REJECTED, WITHDRAWN, CANCELED, DELETED, ALL_FILTER]);
    const invalidStatuses = (params?.status || [])
        .filter((i) => !validStatus.has(i));
    if (invalidStatuses?.length > 0) {
        throw new Error(replaceErrorString(ERROR.LIST_SUBMISSION_INVALID_STATUS_FILTER, `'${invalidStatuses.join(",")}'`));
    }
}

module.exports = SubmissionDAO;
