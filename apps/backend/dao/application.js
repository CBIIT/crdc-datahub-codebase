const MongooseGenericDAO = require("./mongoose-generic");
const ApplicationModel = require("../mongoose/models/application");
const {USER_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {getCurrentTime, subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED, APPROVED} = require("../constants/application-constants");
const ERROR = require("../constants/error-constants");
const {escapeRegexLiteral} = require("../utility/string-util");

const ALL_FILTER = "All";
const FINAL_INACTIVE_REMINDER = "finalInactiveReminder";
const INACTIVE_REMINDER_7 = "inactiveReminder_7";
const INACTIVE_REMINDER_15 = "inactiveReminder_15";
const INACTIVE_REMINDER_30 = "inactiveReminder_30";
/** Known interval reminder fields by day offset (schema-defined names). */
const INACTIVE_REMINDER_BY_DAY = {
    7: INACTIVE_REMINDER_7,
    15: INACTIVE_REMINDER_15,
    30: INACTIVE_REMINDER_30,
};

/**
 * Mongoose-backed DAO for application (submission request) documents.
 */
class ApplicationDAO extends MongooseGenericDAO {
    constructor() {
        super(ApplicationModel);
    }

    /**
     * Strips hydrated/computed API fields before persisting an application update.
     * @param {object} data Application update payload
     * @returns {object}
     */
    _sanitizeApplicationUpdateData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }
        const {
            _id,
            id,
            applicant,
            canBeReopened,
            canBeRestored,
            conditional,
            pendingConditions,
            institution,
            ...updateData
        } = data;
        return updateData;
    }

    /**
     * Builds reminder-flag update fields for inactive SRF notifications.
     * Uses schema-defined field names only (not derived from day offsets).
     * @param {boolean} status Flag value to set
     * @returns {object}
     */
    _getEveryReminderUpdate(status) {
        return {
            [INACTIVE_REMINDER_7]: status,
            [INACTIVE_REMINDER_15]: status,
            [INACTIVE_REMINDER_30]: status,
            [FINAL_INACTIVE_REMINDER]: status,
        };
    }

    /**
     * Applicant $lookup stages shared by list and single-document applicant loads.
     * @returns {object[]}
     */
    _applicantLookupPipeline() {
        return [
            {
                $lookup: {
                    from: USER_COLLECTION,
                    localField: "applicantID",
                    foreignField: "_id",
                    as: "applicant",
                },
            },
            {
                $addFields: {
                    applicant: {
                        $let: {
                            vars: {
                                user: {$arrayElemAt: ["$applicant", 0]},
                            },
                            in: {
                                $cond: [
                                    {$ifNull: ["$$user", false]},
                                    {
                                        id: "$$user._id",
                                        _id: "$$user._id",
                                        firstName: "$$user.firstName",
                                        lastName: "$$user.lastName",
                                        fullName: "$$user.fullName",
                                        email: "$$user.email",
                                    },
                                    null,
                                ],
                            },
                        },
                    },
                },
            },
        ];
    }

    /**
     * Bulk-update organization.name when the embedded org id matches and the name differs.
     * @param {string} orgID Organization _id
     * @param {object} updatedOrg Organization document with name
     * @returns {Promise<{matchedCount: number, modifiedCount: number}>}
     */
    async updateApplicationOrg(orgID, updatedOrg) {
        return await this.updateMany(
            {
                "organization._id": orgID,
                "organization.name": {$ne: updatedOrg.name},
            },
            {
                "organization.name": updatedOrg.name,
                updatedAt: getCurrentTime(),
            }
        );
    }

    /**
     * Insert an application document.
     * @param {object} application Application document (may include _id)
     * @returns {Promise<{acknowledged: boolean, insertedId: string}>}
     */
    async insert(application) {
        const created = await this.create(application);
        return {acknowledged: !!created, insertedId: created?.id ?? created?._id};
    }

    /**
     * Update an application by document payload containing _id or id.
     * @param {object} application Application fields to update
     * @returns {Promise<object>}
     */
    async update(application) {
        if (!application?._id && !application?.id) {
            throw new Error('Application must have an _id or id');
        }
        const updateData = this._sanitizeApplicationUpdateData(application);
        return await super.update(application._id ?? application.id, updateData);
    }

    /**
     * Bulk update applications matching the filter.
     * @param {object} filter Mongo filter
     * @param {object|object[]} data Fields to `$set`, or an array of objects to merge
     * @returns {Promise<{matchedCount: number, modifiedCount: number}>}
     */
    async updateMany(filter, data) {
        const updateDoc = Array.isArray(data)
            ? Object.assign({}, ...data)
            : data;
        const normalizedFilter = this._requireFilter(filter, 'updateMany');
        try {
            const result = await this.model.updateMany(normalizedFilter, {$set: updateDoc});
            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
            };
        } catch (error) {
            console.error(`ApplicationDAO.updateMany failed:`, {
                error: error.message,
                filterKeys: filter && typeof filter === 'object' ? Object.keys(filter) : null,
                dataKeys: updateDoc && typeof updateDoc === 'object' ? Object.keys(updateDoc) : null,
                stack: error.stack,
            });
            throw new Error(`Failed to update many ${this._modelName}`);
        }
    }

    /**
     * Find the Approved parent SRF that links to this application via nextRevisionId.
     * @param {string} id Successor application _id
     * @returns {Promise<object|null>}
     */
    async findApprovedParentSubmissionRequestByID(id) {
        if (!id) {
            return null;
        }
        return await this.findFirst({nextRevisionId: id, status: APPROVED});
    }

    /**
     * Load status for a single application by id.
     * @param {string} id Application _id
     * @returns {Promise<{status: string}|null>}
     */
    async findApplicationStatusById(id) {
        if (!id) {
            return null;
        }
        const row = await this.findFirst({_id: id}, {projection: {status: 1}});
        return row ? {status: row.status} : null;
    }

    /**
     * Load id and status for applications matching the given ids.
     * @param {string[]} ids Application _ids
     * @returns {Promise<object[]>}
     */
    async findApplicationStatusesByIds(ids) {
        if (!ids?.length) {
            return [];
        }
        return await this.findMany(
            {_id: ids},
            {projection: {_id: 1, status: 1}}
        );
    }

    /**
     * Find Approved applications whose nextRevisionId matches any of the given ids.
     * @param {string[]} nextRevisionIds Application _ids referenced by nextRevisionId
     * @returns {Promise<object[]>}
     */
    async findApprovedApplicationsByNextRevisionIds(nextRevisionIds) {
        if (!nextRevisionIds?.length) {
            return [];
        }
        return await this.findMany(
            {nextRevisionId: nextRevisionIds, status: APPROVED},
            {projection: {nextRevisionId: 1}}
        );
    }

    /**
     * Load an application with applicant fields for API responses.
     * @param {string} id Application _id
     * @returns {Promise<object|null>}
     */
    async findApplicationWithApplicantById(id) {
        if (!id) {
            return null;
        }
        const rows = await this.aggregate([
            {$match: {_id: id}},
            ...this._applicantLookupPipeline(),
            {$limit: 1},
        ]);
        return rows?.[0] ?? null;
    }

    /**
     * Most recent Approved application for an applicant.
     * @param {string} applicantID Applicant user _id
     * @returns {Promise<object|null>}
     */
    async findLatestApprovedByApplicantID(applicantID) {
        if (!applicantID) {
            return null;
        }
        return await this.findFirst(
            {applicantID, status: APPROVED},
            {sort: {createdAt: -1}}
        );
    }

    /**
     * Load applicant ownership fields for the given application ids.
     * @param {string[]} applicationIDs Application _ids
     * @returns {Promise<object[]>} Rows with id/_id and applicantID
     */
    async findApplicantIDsByApplicationIDs(applicationIDs) {
        if (!applicationIDs?.length) {
            return [];
        }
        return await this.findMany(
            {_id: applicationIDs},
            {projection: {_id: 1, applicantID: 1}}
        );
    }

    /**
     * Clear nextRevisionId on any application pointing at the given successor.
     * @param {string} applicationId Successor application _id
     * @returns {Promise<{matchedCount: number, modifiedCount: number}>}
     */
    async clearNextRevisionIdPointingTo(applicationId) {
        if (!applicationId) {
            return {matchedCount: 0, modifiedCount: 0};
        }
        return await this.updateMany(
            {nextRevisionId: applicationId},
            {nextRevisionId: null, updatedAt: getCurrentTime()}
        );
    }

    /**
     * Insert a new reopened application and update the approved predecessor; roll back the link if insert fails.
     * @param {string} sourceId Approved application _id
     * @param {object} newApp Full successor document (must include _id)
     * @param {boolean} [replaceExistingLink=false] When true, overwrite an existing nextRevisionId on the source
     * @returns {Promise<object>} The inserted application document
     */
    async reopenApprovedRevision(sourceId, newApp, replaceExistingLink = false) {
        const timestamp = newApp.updatedAt ?? getCurrentTime();

        let previousNextRevisionID = null;
        if (replaceExistingLink) {
            const source = await this.findFirst(
                {_id: sourceId},
                {projection: {nextRevisionId: 1}}
            );
            previousNextRevisionID = source?.nextRevisionId ?? null;
        }

        const linkFilter = replaceExistingLink
            ? {_id: sourceId, status: APPROVED}
            : {
                _id: sourceId,
                status: APPROVED,
                $or: [
                    {nextRevisionId: null},
                    {nextRevisionId: {$exists: false}},
                ],
            };

        const linkResult = await this.updateMany(linkFilter, {
            nextRevisionId: newApp._id,
            updatedAt: timestamp,
        });

        if (linkResult?.matchedCount !== 1) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        }

        try {
            const insertResult = await this.insert(newApp);
            if (!insertResult?.acknowledged) {
                throw new Error(ERROR.UPDATE_FAILED);
            }
            return {...newApp};
        } catch (error) {
            try {
                await this.updateMany(
                    {_id: sourceId},
                    {
                        nextRevisionId: replaceExistingLink ? previousNextRevisionID : null,
                        updatedAt: getCurrentTime(),
                    }
                );
            } catch (compensateError) {
                console.error('Failed to compensate nextRevisionId after reopen insert failure:', compensateError);
            }
            throw error;
        }
    }

    /**
     * Find stale in-progress SRFs for reminder/delete jobs, with applicant fields hydrated.
     * @param {number} inactiveDays Inactivity threshold in days
     * @param {string} [inactiveFlagField] Reminder flag that must not already be true
     * @returns {Promise<object[]>}
     */
    async getInactiveApplication(inactiveDays, inactiveFlagField) {
        try {
            const match = {
                updatedAt: {$lt: subtractDaysFromNow(inactiveDays)},
                status: {$in: [NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED]},
            };
            if (inactiveFlagField) {
                match[inactiveFlagField] = {$ne: true};
            }
            const applications = await this.aggregate([
                {$match: match},
                ...this._applicantLookupPipeline(),
            ]);
            return (applications || []).map((item) => ({
                ...item,
                ...(item?.applicant ? {
                    applicant: {
                        ...item.applicant,
                        applicantID: item.applicant?.id || item.applicant?._id || "",
                        applicantName: item.applicant?.fullName || "",
                        applicantEmail: item.applicant?.email || "",
                    },
                } : {}),
            }));
        } catch (error) {
            console.error('Error getting getInactiveApplication:', error);
            return [];
        }
    }

    /**
     * Mark final (and interval) reminder flags for the given application ids.
     * @param {string[]} applicationIDs Application _ids
     * @returns {Promise<{matchedCount: number, modifiedCount: number}>}
     */
    async markFinalRemindersSent(applicationIDs) {
        if (!applicationIDs?.length) {
            return {matchedCount: 0, modifiedCount: 0};
        }
        return await this.updateMany(
            {_id: {$in: applicationIDs}},
            this._getEveryReminderUpdate(true)
        );
    }

    /**
     * Mark interval reminder flags for a single application.
     * Only schema-defined day fields (7, 15, 30) are updated.
     * @param {string} applicationID Application _id
     * @param {number[]} reminderDays Reminder day offsets to set true
     * @returns {Promise<object>}
     */
    async markIntervalReminderSent(applicationID, reminderDays) {
        const reminderFilter = (reminderDays || []).reduce((acc, day) => {
            const field = INACTIVE_REMINDER_BY_DAY[day];
            if (field) {
                acc[field] = true;
            }
            return acc;
        }, {});
        return await this.update({_id: applicationID, ...reminderFilter});
    }

    /**
     * Builds the Mongo match for listApplications from API inputs.
     * Submitter-name matching is applied after applicant $lookup (see listApplicationsWithFacets).
     * @param {object} params
     * @param {string[]} [params.statuses] Canonical status values (empty = no status filter)
     * @param {string|null} [params.programName]
     * @param {string|null} [params.studyName]
     * @param {string|null} [params.applicantID] Own-scope applicant filter
     * @returns {{match: object, submitterName: string|null, hasStudyFilter: boolean}}
     */
    _buildListApplicationsMatch({statuses, programName, studyName, applicantID} = {}) {
        const match = {};
        if (statuses?.length) {
            match.status = {$in: statuses};
        }
        if (programName != null && programName !== ALL_FILTER) {
            match.programName = programName;
        }
        const studySearchTerm = studyName?.trim();
        const hasStudyFilter = studySearchTerm?.length > 0 && studyName !== ALL_FILTER;
        if (hasStudyFilter) {
            const studySearchTermSanitized = escapeRegexLiteral(studySearchTerm);
            const containsOption = {$regex: studySearchTermSanitized, $options: 'i'};
            match.$or = [
                {studyName: containsOption},
                {studyAbbreviation: containsOption},
            ];
        }
        if (applicantID) {
            match.applicantID = applicantID;
        }
        return {match, hasStudyFilter};
    }

    /**
     * Lists applications with applicant enrichment, pagination, and facet values.
     * Uses separate count/facet queries (DocumentDB does not support $facet).
     * @param {object} params
     * @param {string[]} [params.statuses]
     * @param {string|null} [params.programName]
     * @param {string|null} [params.studyName]
     * @param {string|null} [params.submitterName]
     * @param {string|null} [params.applicantID]
     * @param {number} [params.first]
     * @param {number} [params.offset]
     * @param {string} [params.orderBy]
     * @param {string} [params.sortDirection]
     * @returns {Promise<{applications: object[], total: number, programs: string[], studies: string[], studyAbbreviations: string[], status: string[], submitterNames: string[]}>}
     */
    async listApplicationsWithFacets({
        statuses,
        programName,
        studyName,
        submitterName,
        applicantID,
        first,
        offset,
        orderBy,
        sortDirection,
    } = {}) {
        const {match, hasStudyFilter} = this._buildListApplicationsMatch({
            statuses,
            programName,
            studyName,
            applicantID,
        });

        const submitterFilter =
            submitterName != null && submitterName !== ALL_FILTER
                ? {
                    "applicant.fullName": {
                        $regex: escapeRegexLiteral(submitterName.trim()),
                        $options: 'i',
                    },
                }
                : null;

        let sortField = orderBy || "createdAt";
        if (sortField === "applicant.applicantName" || sortField === "applicant.fullName") {
            sortField = "applicant.fullName";
        }

        const basePipeline = [
            {$match: match},
            ...this._applicantLookupPipeline(),
            ...(submitterFilter ? [{$match: submitterFilter}] : []),
        ];

        const pagination = new MongoPagination(
            first,
            offset,
            sortField,
            sortDirection,
            sortField === "applicant.fullName" || sortField === "programName" || sortField === "studyName"
        );

        const [applications, total, programs, studies, studyAbbreviations, statusList, submitterNames] =
            await Promise.all([
                this.aggregate(basePipeline.concat(pagination.getPaginationPipeline())),
                this._countListApplications(basePipeline),
                this._distinctListField(basePipeline, match, submitterFilter, "programName", "programName"),
                this._distinctListField(basePipeline, match, submitterFilter, "studyName", "studyName", hasStudyFilter),
                this._distinctListField(basePipeline, match, submitterFilter, "studyAbbreviation", null, hasStudyFilter),
                this._distinctListField(basePipeline, match, submitterFilter, "status", "status"),
                this._distinctSubmitterNames(match),
            ]);

        return {
            applications: applications || [],
            total,
            programs: programs || [],
            studies: studies || [],
            studyAbbreviations: studyAbbreviations || [],
            status: statusList || [],
            submitterNames: submitterNames || [],
        };
    }

    /**
     * @param {object[]} basePipeline Match + applicant lookup (+ optional submitter match)
     * @returns {Promise<number>}
     */
    async _countListApplications(basePipeline) {
        const rows = await this.aggregate([
            ...basePipeline,
            {$count: "count"},
        ]);
        return rows?.[0]?.count ?? 0;
    }

    /**
     * Distinct facet values for a field, omitting that field's filter when excludeMatchKey is set.
     * When reuseBasePipeline is true (study filter active), distinct from the already-filtered pipeline.
     * @param {object[]} basePipeline
     * @param {object} match
     * @param {object|null} submitterFilter
     * @param {string} field
     * @param {string|null} excludeMatchKey Match key to omit for this facet
     * @param {boolean} [reuseBasePipeline=false]
     * @returns {Promise<string[]>}
     */
    /**
     * Distinct facet values for a field, omitting that field's filter when excludeMatchKey is set.
     * When reuseBasePipeline is true (study filter active), distinct from the already-filtered pipeline.
     * @param {object[]} basePipeline
     * @param {object} match
     * @param {object|null} submitterFilter
     * @param {string} field
     * @param {string|null} excludeMatchKey Match key to omit for this facet
     * @param {boolean} [reuseBasePipeline=false]
     * @returns {Promise<string[]>}
     */
    async _distinctListField(basePipeline, match, submitterFilter, field, excludeMatchKey, reuseBasePipeline = false) {
        let pipeline;
        if (reuseBasePipeline) {
            pipeline = [...basePipeline];
        } else {
            const facetMatch = {...match};
            if (excludeMatchKey) {
                delete facetMatch[excludeMatchKey];
            }
            pipeline = [
                {$match: facetMatch},
                ...this._applicantLookupPipeline(),
                ...(submitterFilter ? [{$match: submitterFilter}] : []),
            ];
        }

        const rows = await this.aggregate([
            ...pipeline,
            {$group: {_id: `$${field}`}},
            {$match: {_id: {$nin: [null, ""]}}},
            {$sort: {_id: 1}},
        ]);
        return (rows || []).map((row) => row._id).filter(Boolean);
    }

    /**
     * Distinct submitter full names for the listApplications facet (omits submitter name filter).
     * @param {object} match Application match without submitter filter
     * @returns {Promise<string[]>}
     */
    async _distinctSubmitterNames(match) {
        const pipeline = [
            {$match: match},
            ...this._applicantLookupPipeline(),
            {$group: {_id: "$applicantID", fullName: {$first: "$applicant.fullName"}}},
            {$match: {fullName: {$nin: [null, ""]}}},
            {$sort: {fullName: 1}},
        ];
        const rows = await this.aggregate(pipeline);
        const names = (rows || []).map((row) => row.fullName).filter(Boolean);
        return Array.from(new Set(names));
    }
}

module.exports = ApplicationDAO;
