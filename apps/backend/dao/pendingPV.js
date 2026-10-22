const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");
const MongooseGenericDAO = require("./mongoose-generic");
const PendingPVModel = require("../mongoose/models/pending-pv");

/**
 * Mongoose-backed DAO for pending PV requests.
 */
class PendingPVDAO extends MongooseGenericDAO {
    constructor() {
        super(PendingPVModel);
    }

    /**
     * Finds all pending PVs associated with a given submission ID.
     *
     * @param {string} submissionID - The ID of the submission to query.
     * @returns {Promise<Array<Object>>} - A promise that resolves to an array of pending PV records.
     */
    async findBySubmissionID(submissionID) {
        return await this.findMany({ submissionID });
    }

    /**
     * Inserts a pending PV request for a submission.
     * Soft-fails (logs and returns undefined) so callers can surface a failed-insert error.
     *
     * @param {string} submissionID
     * @param {string} offendingProperty
     * @param {string} value
     * @returns {Promise<object|undefined>}
     */
    async insertOne(submissionID, offendingProperty, value) {
        try {
            const newPendingPV = PendingPVData.createPendingPV(submissionID, offendingProperty, value);
            return await this.create(newPendingPV);
        } catch (error) {
            console.error(`Error inserting pending PV: ${submissionID}`, error);
        }
    }
}

class PendingPVData {
    constructor(submissionID, offendingProperty, value) {
        this.submissionID = submissionID;
        this.offendingProperty = offendingProperty;
        this.value = value;
        this.createdAt = this.updatedAt = getCurrentTime();
    }

    static createPendingPV(submissionID, offendingProperty, value) {
        return new PendingPVData(submissionID, offendingProperty, value);
    }
}

module.exports = PendingPVDAO;
