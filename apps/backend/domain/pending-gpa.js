const {isTrue} = require("../crdc-datahub-database-drivers/utility/string-utility");

/** Temporary default when GPA name is missing on controlled-access SRF approval. To revert, grep for DEFAULT_GPA_NAME, resolveGPAName, and "Not Provided". */
const DEFAULT_GPA_NAME = "Not Provided";

class PendingGPA {
    constructor(GPAName, isPendingGPA) {
        this.GPAName = GPAName;
        this.isPendingGPA = isTrue(isPendingGPA);
    }

    static create(GPAName, isPendingGPA) {
        return new PendingGPA(GPAName, isPendingGPA);
    }

    /**
     * Resolves GPA name for SRF approval. Missing controlled-access names default to Not Provided (temporary).
     * @param {string} [GPAName]
     * @param {boolean} isControlledAccess
     * @returns {string}
     */
    static resolveGPAName(GPAName, isControlledAccess) {
        const trimmed = GPAName?.trim();
        if (trimmed) {
            return trimmed;
        }
        if (isControlledAccess) {
            return DEFAULT_GPA_NAME;
        }
        return GPAName ?? "";
    }
}

module.exports = {
    DEFAULT_GPA_NAME,
    PendingGPA
};
