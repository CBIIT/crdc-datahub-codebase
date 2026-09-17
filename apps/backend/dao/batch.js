const MongooseGenericDAO = require("./mongoose-generic");
const BatchModel = require("../mongoose/models/batch");

class BatchDAO extends MongooseGenericDAO {
    constructor() {
        super(BatchModel);
    }

    /**
     * Delete batches by a submission ID.
     * @param {string} submissionID - Submission ID
     * @returns {Promise<{count: number}|undefined>} - Deletion result, or undefined when submissionID is falsy
     */
    async deleteBatchesBySubmissionID(submissionID) {
        try {
            if (submissionID) {
                const result = await this.model.deleteMany({ submissionID: submissionID });
                const res = { count: result.deletedCount };
                console.log(`deleteBySubmissionID submissionID: ${JSON.stringify(submissionID)}, ${JSON.stringify(res)}`);
                return res;
            }
        } catch (error) {
            console.error('BatchDAO.deleteBySubmissionID failed:', {
                error: error.message,
                submissionID,
                stack: error.stack
            });
            throw new Error(`Failed to delete batches`);
        }
    }

    /**
     * Find batches by submission ID and status.
     * @param {string} submissionID - Submission ID to filter by
     * @param {string} status - Status to filter by
     * @returns {Promise<object[]>} - Array of matching batches (empty or single-element)
     */
    async findByStatus(submissionID, status) {
        try {
            const result = this._mapDoc(
                await this.model.findOne({
                    submissionID: submissionID,
                    status: status
                }).lean()
            );

            if (!result) {
                return [];
            }

            return [result];
        } catch (error) {
            console.error('BatchDAO.findByStatus failed:', {
                error: error.message,
                submissionID,
                status,
                stack: error.stack
            });
            throw new Error(`Failed to find batch by status`);
        }
    }

    /**
     * Get the next display ID for a submission.
     * @param {string} submissionID - Submission ID to get next display ID for
     * @returns {Promise<number>} - Next display ID
     */
    async getNextDisplayID(submissionID) {
        try {
            const count = await this.model.countDocuments({
                submissionID: submissionID
            });

            return count + 1;
        } catch (error) {
            console.error('BatchDAO.getNextDisplayID failed:', {
                error: error.message,
                submissionID,
                stack: error.stack
            });
            throw new Error(`Failed to get next display ID`);
        }
    }

    /**
     * Get the latest batch display ID for a specific uploaded file in a submission.
     * @param {string} submissionID - Submission ID
     * @param {string} fileName - File name to search for
     * @param {number} [maxBatches=10] - Maximum number of batches to search through (unused; retained for callers)
     * @returns {Promise<number|null>} - Latest batch display ID or null if not found
     */
    async getLastFileBatchID(submissionID, fileName, maxBatches = 10) {
        try {
            const result = await this.model
                .findOne({
                    submissionID: submissionID,
                    type: "data file",
                    status: "Uploaded",
                    files: {
                        $elemMatch: {
                            fileName: fileName,
                            status: 'Uploaded'
                        }
                    }
                })
                .select("displayID")
                .sort({ displayID: -1 })
                .lean();

            return result ? result.displayID : null;
        } catch (error) {
            console.error('BatchDAO.getLastFileBatchID failed:', {
                error: error.message,
                submissionID,
                fileName,
                maxBatches,
                stack: error.stack
            });
            throw new Error(`Failed to get last file batch ID`);
        }
    }
}

module.exports = BatchDAO;
