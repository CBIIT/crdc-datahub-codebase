const MongooseGenericDAO = require("./mongoose-generic");
const DataSyncModel = require("../mongoose/models/data-sync");
const { DATA_SYNC_TYPE, DATA_SYNC_STATUS } = require("../constants/data-sync-constants");

/**
 * Mongoose-backed DAO for DataSync task records.
 */
class DataSyncDAO extends MongooseGenericDAO {
    constructor() {
        super(DataSyncModel);
    }

    /**
     * DataSync tasks for a submission, newest startTime first.
     * @param {string} submissionID Submission ID
     * @param {string} [type] DataSync type (metadata or file). Null, undefined, or empty string matches every type.
     * @returns {Promise<object[]>} Matching records
     */
    async listBySubmissionID(submissionID, type) {
        const filter = type == null || type === "" ? { submissionID } : { submissionID, type };
        return this.findMany(filter, { sort: { startTime: -1 } });
    }

    /**
     * Latest DataSync task for a submission and type, by startTime descending.
     * @param {string} submissionID Submission ID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object|null>} The latest record, or null when none match
     */
    async findLatestBySubmissionIDAndType(submissionID, type) {
        return this.findFirst({ submissionID, type }, { sort: { startTime: -1 } });
    }

    /**
     * Submission IDs among the given list that have any DataSync record.
     * An empty list returns immediately and does not query.
     * @param {string[]} submissionIDs Submission IDs to check
     * @returns {Promise<string[]>} Distinct submission IDs that have a record
     */
    async findSubmissionIDsWithRecords(submissionIDs) {
        if (!Array.isArray(submissionIDs) || submissionIDs.length === 0) {
            return [];
        }
        return this.distinct("submissionID", { submissionID: { $in: submissionIDs } });
    }

    /**
     * Submission IDs that have a file DataSync task still In Progress.
     * @returns {Promise<string[]>}
     */
    async findSubmissionIDsWithInProgressFileRecords() {
        return this.distinct("submissionID", {
            type: DATA_SYNC_TYPE.FILE,
            status: DATA_SYNC_STATUS.IN_PROGRESS,
        });
    }
}

module.exports = DataSyncDAO;
