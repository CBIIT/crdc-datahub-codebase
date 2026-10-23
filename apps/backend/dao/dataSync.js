const MongooseGenericDAO = require("./mongoose-generic");
const DataSyncModel = require("../mongoose/models/data-sync");

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
}

module.exports = DataSyncDAO;
