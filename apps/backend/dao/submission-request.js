const MongooseGenericDAO = require("./mongoose-generic");
const SubmissionRequestModel = require("../mongoose/models/submission-request");
const { USER_COLLECTION } = require("../crdc-datahub-database-drivers/database-constants");
const { getCurrentTime, subtractDaysFromNow } = require("../crdc-datahub-database-drivers/utility/time-utility");
const { getSortDirection } = require("../crdc-datahub-database-drivers/utility/mongodb-utility");
const { NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED, APPROVED } = require("../constants/submission-request-constants");
const ERROR = require("../constants/error-constants");

/**
 * Strip API-hydrated / computed fields before an SRF update.
 * @param {object} data Update payload
 * @returns {object}
 */
function toSubmissionRequestUpdateData(data) {
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
 * True when nextRevisionId is null or missing.
 * @param {string} fieldName Field name
 * @returns {object}
 */
function nullOrMissingMongoCondition(fieldName) {
    return {
        $or: [
            { [fieldName]: null },
            { [fieldName]: { $exists: false } },
        ],
    };
}

/**
 * Data access for submission request (SRF) documents via Mongoose.
 */
class SubmissionRequestDAO extends MongooseGenericDAO {
    constructor() {
        super(SubmissionRequestModel);
    }

    /**
     * $lookup users on applicantID and expose as `applicant`.
     * @returns {object[]}
     */
    _applicantLookupStages() {
        return [
            {
                $lookup: {
                    from: USER_COLLECTION,
                    localField: 'applicantID',
                    foreignField: '_id',
                    as: '_applicantDocs',
                },
            },
            {
                $addFields: {
                    applicant: { $arrayElemAt: ['$_applicantDocs', 0] },
                },
            },
            {
                $project: { _applicantDocs: 0 },
            },
        ];
    }

    /**
     * Updates embedded organization name on SRFs linked to a program/org.
     * @param {string} orgID Organization / program ID
     * @param {object} updatedOrg Updated organization fields (name)
     * @returns {Promise<{count: number, matchedCount: number, modifiedCount: number, acknowledged: boolean}>}
     */
    async updateSubmissionRequestOrg(orgID, updatedOrg) {
        return await this.updateMany(
            { 'organization._id': orgID, 'organization.name': { $ne: updatedOrg.name } },
            { 'organization.name': updatedOrg.name, updatedAt: getCurrentTime() }
        );
    }

    /**
     * Insert an SRF document.
     * @param {object} submissionRequest SRF document (may use _id)
     * @returns {Promise<{acknowledged: boolean, insertedId: string}>}
     */
    async insert(submissionRequest) {
        const data = { ...submissionRequest };
        if (data.id && !data._id) {
            data._id = data.id;
        }
        delete data.id;
        const created = await this.create(data);
        return { acknowledged: !!created, insertedId: created?.id ?? created?._id };
    }

    /**
     * Update an SRF by id, stripping hydrated/computed fields.
     * @param {object} submissionRequest Update payload with _id or id
     * @returns {Promise<object>}
     */
    async update(submissionRequest) {
        // check if _id or id is present
        if (!submissionRequest._id && !submissionRequest.id) {
            throw new Error('Submission request must have an _id or id');
        }
        const updateData = toSubmissionRequestUpdateData(submissionRequest);
        return await super.update(submissionRequest._id ?? submissionRequest.id, updateData);
    }

    /**
     * Update many SRFs; returns Mongo-shaped counts for callers.
     * @param {object} filter Mongo filter
     * @param {object|object[]} data Fields to $set (array of objects is merged)
     * @returns {Promise<{matchedCount: number, modifiedCount: number, count: number, acknowledged: boolean}>}
     */
    async updateMany(filter, data) {
        const updateDoc = Array.isArray(data)
            ? Object.assign({}, ...data)
            : data;
        const requiredFilter = this._requireFilter(filter, 'updateMany');
        try {
            const result = await this.model.updateMany(requiredFilter, { $set: updateDoc });
            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                count: result.modifiedCount,
                acknowledged: true,
            };
        } catch (error) {
            console.error(`SubmissionRequestDAO.updateMany failed:`, {
                error: error.message,
                filter: JSON.stringify(filter),
                stack: error.stack,
            });
            throw new Error(`Failed to update many ${this._modelName}`);
        }
    }

    /**
     * Find the Approved parent SRF that links to this SRF via nextRevisionId.
     * Only Approved rows receive nextRevisionId (set on reopen); this is the revision-chain parent lookup.
     * @param {string} id Successor SRF _id
     * @returns {Promise<object|null>} Approved parent, or null when id is falsy or no match
     */
    async findApprovedParentSubmissionRequestByID(id) {
        if (!id) {
            return null;
        }
        return await this.findFirst({ nextRevisionId: id, status: APPROVED });
    }

    /**
     * Load status for a single SRF by id.
     * @param {string} id SRF _id
     * @returns {Promise<{status: string}|null>}
     */
    async findSubmissionRequestStatusByID(id) {
        if (!id) {
            return null;
        }
        const row = await this.model.findOne({ _id: id }).select({ status: 1 }).lean();
        if (!row) {
            return null;
        }
        return { status: row.status };
    }

    /**
     * Load id and status for SRFs matching the given ids.
     * @param {string[]} ids SRF _ids
     * @returns {Promise<object[]>}
     */
    async findSubmissionRequestStatusesByIDs(ids) {
        if (!ids?.length) {
            return [];
        }
        const rows = await this.model
            .find({ _id: { $in: ids } })
            .select({ status: 1 })
            .lean();
        return rows.map((row) => this._mapDoc(row));
    }

    /**
     * Find Approved SRFs whose nextRevisionId matches any of the given ids.
     * @param {string[]} nextRevisionIds SRF _ids referenced by nextRevisionId
     * @returns {Promise<object[]>}
     */
    async findApprovedSubmissionRequestsByNextRevisionIDs(nextRevisionIds) {
        if (!nextRevisionIds?.length) {
            return [];
        }
        const rows = await this.model
            .find({ nextRevisionId: { $in: nextRevisionIds }, status: APPROVED })
            .select({ nextRevisionId: 1 })
            .lean();
        return rows.map((row) => this._mapDoc(row));
    }

    /**
     * Load an SRF with applicant user fields for API responses.
     * @param {string} id SRF _id
     * @returns {Promise<object|null>}
     */
    async findSubmissionRequestWithApplicantByID(id) {
        if (!id) {
            return null;
        }
        const rows = await this.aggregate([
            { $match: { _id: id } },
            ...this._applicantLookupStages(),
            { $limit: 1 },
        ]);
        return rows[0] ?? null;
    }

    /**
     * Most recent Approved SRF for an applicant.
     * @param {string} applicantID Applicant user _id
     * @returns {Promise<object|null>}
     */
    async findLatestApprovedByApplicantID(applicantID) {
        if (!applicantID) {
            return null;
        }
        return await this.findFirst(
            { applicantID, status: APPROVED },
            { sort: { createdAt: -1 } }
        );
    }

    /**
     * Clear nextRevisionId on any SRF pointing at the given successor (revision chain link removal).
     * @param {string} submissionRequestID Successor SRF _id whose inbound nextRevisionId link should be cleared
     * @returns {Promise<{matchedCount: number, modifiedCount: number, count: number, acknowledged: boolean}>}
     */
    async clearNextRevisionIdPointingTo(submissionRequestID) {
        if (!submissionRequestID) {
            return { matchedCount: 0, modifiedCount: 0, count: 0, acknowledged: true };
        }
        return await this.updateMany(
            { nextRevisionId: submissionRequestID },
            { nextRevisionId: null, updatedAt: getCurrentTime() }
        );
    }

    /**
     * Insert a reopened SRF and link the approved predecessor; compensate if insert fails.
     * @param {string} sourceId Approved SRF _id
     * @param {object} newSubmissionRequest Full successor document (must include _id)
     * @param {boolean} [replaceExistingLink=false] When true, overwrite an existing nextRevisionId on the source
     * @returns {Promise<object>} The inserted SRF document
     */
    async reopenApprovedRevision(sourceId, newSubmissionRequest, replaceExistingLink = false) {
        const timestamp = newSubmissionRequest.updatedAt ?? getCurrentTime();

        let previousNextRevisionID = null;
        if (replaceExistingLink) {
            const source = await this.findFirst(
                { _id: sourceId },
                {}
            );
            previousNextRevisionID = source?.nextRevisionId ?? null;
        }

        const linkWhere = replaceExistingLink
            ? { _id: sourceId, status: APPROVED }
            : { _id: sourceId, status: APPROVED, ...nullOrMissingMongoCondition('nextRevisionId') };

        const linkResult = await this.updateMany(linkWhere, {
            nextRevisionId: newSubmissionRequest._id,
            updatedAt: timestamp,
        });

        if (linkResult?.matchedCount !== 1) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        }

        try {
            const insertResult = await this.insert(newSubmissionRequest);
            if (!insertResult?.acknowledged) {
                throw new Error(ERROR.UPDATE_FAILED);
            }
            return { ...newSubmissionRequest };
        } catch (error) {
            try {
                await this.updateMany(
                    { _id: sourceId },
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
     * Inactive SRFs for reminder / cleanup jobs, with applicant hydration.
     * @param {number} inactiveDays Days since last update
     * @param {string} [inactiveFlagField] Reminder flag that must not already be true
     * @returns {Promise<object[]>}
     */
    async getInactiveSubmissionRequest(inactiveDays, inactiveFlagField) {
        try {
            const match = {
                updatedAt: { $lt: subtractDaysFromNow(inactiveDays) },
                status: { $in: [NEW, IN_PROGRESS, INQUIRED, IN_REVISION, REOPENED] },
                // Tracks whether the notification has already been sent
                ...(inactiveFlagField ? { [inactiveFlagField]: { $ne: true } } : {}),
            };
            const rows = await this.aggregate([
                { $match: match },
                ...this._applicantLookupStages(),
            ]);
            return rows.map((item) => ({
                ...item,
                ...(item?.applicant
                    ? {
                        applicant: {
                            ...item.applicant,
                            applicantID: item.applicant?.id || item.applicant?._id || '',
                            applicantName: item.applicant?.fullName || '',
                            applicantEmail: item.applicant?.email || '',
                        },
                    }
                    : {}),
            }));
        } catch (error) {
            console.error('Error getting getInactiveSubmissionRequest:', error);
            return [];
        }
    }

    /**
     * List SRFs with applicant $lookup, optional applicant fullName match, sort, and pagination.
     * @param {object} matchFilter Mongo filter on SRF fields (no applicant relation)
     * @param {object} [options]
     * @param {RegExp|object} [options.applicantFullNameMatch] Match on applicant.fullName after lookup
     * @param {string} [options.orderBy] Sort field (supports applicant.fullName)
     * @param {string} [options.sortDirection] ASC or DESC
     * @param {number} [options.skip]
     * @param {number} [options.limit] Omit or -1 for no limit
     * @returns {Promise<object[]>}
     */
    async findManyWithApplicant(matchFilter, options = {}) {
        const filter = this._requireFilter(matchFilter, 'findManyWithApplicant');
        const pipeline = [{ $match: filter }, ...this._applicantLookupStages()];

        if (options.applicantFullNameMatch) {
            pipeline.push({ $match: { 'applicant.fullName': options.applicantFullNameMatch } });
        }

        if (options.orderBy) {
            const sortField = options.orderBy === 'applicant.applicantName'
                ? 'applicant.fullName'
                : options.orderBy;
            pipeline.push({
                $sort: { [sortField]: getSortDirection(options.sortDirection) },
            });
        }

        if (options.skip) {
            pipeline.push({ $skip: options.skip });
        }

        const limit = options.limit;
        if (!(Number.isInteger(limit) && limit === -1) && limit !== undefined && limit !== null) {
            if (limit === 0) {
                return [];
            }
            pipeline.push({ $limit: limit });
        }

        return await this.aggregate(pipeline);
    }

    /**
     * Count SRFs with the same applicant join/filter rules as findManyWithApplicant.
     * @param {object} matchFilter Mongo filter on SRF fields
     * @param {object} [options]
     * @param {RegExp|object} [options.applicantFullNameMatch]
     * @returns {Promise<number>}
     */
    async countWithApplicant(matchFilter, options = {}) {
        const filter = this._requireFilter(matchFilter, 'countWithApplicant');
        if (!options.applicantFullNameMatch) {
            return await this.count(filter);
        }
        const pipeline = [
            { $match: filter },
            ...this._applicantLookupStages(),
            { $match: { 'applicant.fullName': options.applicantFullNameMatch } },
            { $count: 'count' },
        ];
        const rows = await this.model.aggregate(pipeline);
        return rows[0]?.count ?? 0;
    }

    /**
     * Distinct applicant full names for list facet filters.
     * @param {object} matchFilter Mongo filter on SRF fields (should omit applicant name filter)
     * @returns {Promise<string[]>}
     */
    async distinctApplicantFullNames(matchFilter) {
        const filter = this._requireFilter(matchFilter, 'distinctApplicantFullNames');
        const pipeline = [
            { $match: filter },
            ...this._applicantLookupStages(),
            { $group: { _id: '$applicant.fullName' } },
            { $match: { _id: { $nin: [null, ''] } } },
            { $sort: { _id: 1 } },
        ];
        const rows = await this.model.aggregate(pipeline);
        return rows.map((row) => row._id).filter(Boolean);
    }
}

module.exports = SubmissionRequestDAO;
module.exports.toSubmissionRequestUpdateData = toSubmissionRequestUpdateData;
