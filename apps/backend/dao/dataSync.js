const MongooseGenericDAO = require("./mongoose-generic");
const DataSyncModel = require("../mongoose/models/data-sync");
const { DATA_SYNC_STATUS } = require("../constants/data-sync-constants");

/**
 * Mongoose-backed DAO for DataSync task records.
 */
class DataSyncDAO extends MongooseGenericDAO {
    constructor() {
        super(DataSyncModel);
    }

    /**
     * Latest DataSync task for a submission and type, by startTime descending.
     * @param {string} submissionID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object|null>} The latest record, or null when none match
     */
    async findLatestBySubmissionIDAndType(submissionID, type) {
        return this.findFirst(
            { submissionID, type },
            { sort: { startTime: -1 } }
        );
    }

    /**
     * In-progress DataSync tasks for a submission and type.
     * @param {string} submissionID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object[]>} Matching records
     */
    async findInProgressBySubmissionIDAndType(submissionID, type) {
        return this.findMany({
            submissionID,
            type,
            status: DATA_SYNC_STATUS.IN_PROGRESS,
        });
    }
}

module.exports = DataSyncDAO;
