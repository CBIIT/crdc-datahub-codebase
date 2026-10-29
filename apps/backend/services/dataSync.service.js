const DataSyncDAO = require("../dao/dataSync");
const ERROR = require("../constants/error-constants");
const { replaceErrorString } = require("../utility/string-util");

/**
 * Read-only access to DataSync task records. The export validator owns all writes.
 */
class DataSyncService {
    /**
     * @param {DataSyncDAO} [dataSyncDAO] Persistence for DataSync task records
     */
    constructor(dataSyncDAO = new DataSyncDAO()) {
        this.dataSyncDAO = dataSyncDAO;
    }

    /**
     * Rejects a value that is missing, the wrong schema type, or outside its enum.
     * Schema types are read from the DataSync model on the DAO.
     * @param {*} value Value to check
     * @param {string} field Schema field name, also used in the error message
     * @param {string} missingError Error template for a missing or empty value
     * @param {string} invalidTypeError Error template for the wrong type
     * @param {string} invalidEnumError Error template for a value outside the enum
     * @throws {Error} When the value fails one of those checks
     */
    _checkSchemaValue(value, field, missingError, invalidTypeError, invalidEnumError) {
        if (value == null || value === "") {
            throw new Error(replaceErrorString(missingError, field));
        }
        const schemaPath = this.dataSyncDAO.model.schema.path(field);
        const typeMatches = schemaPath.instance === "Date"
            ? value instanceof Date
            : typeof value === schemaPath.instance.toLowerCase();
        if (!typeMatches) {
            throw new Error(replaceErrorString(invalidTypeError, field));
        }
        if (schemaPath.enumValues?.length && !schemaPath.enumValues.includes(value)) {
            throw new Error(replaceErrorString(invalidEnumError, field));
        }
    }

    /**
     * DataSync tasks for a submission, newest startTime first.
     * submissionID is required. type is optional; null, undefined, or empty string returns every type.
     * @param {string} submissionID Submission ID
     * @param {string} [type] DataSync type (metadata or file)
     * @returns {Promise<object[]>} Matching records
     * @throws {Error} When submissionID is missing or the wrong type, or a provided type is the wrong type or outside its enum
     */
    async listBySubmissionID(submissionID, type) {
        this._checkSchemaValue(
            submissionID,
            "submissionID",
            ERROR.FIND_DATA_SYNC_MISSING_FIELD,
            ERROR.FIND_DATA_SYNC_INVALID_TYPE,
            ERROR.FIND_DATA_SYNC_INVALID_ENUM
        );
        const typeFilter = type == null || type === "" ? undefined : type;
        if (typeFilter !== undefined) {
            this._checkSchemaValue(
                typeFilter,
                "type",
                ERROR.FIND_DATA_SYNC_MISSING_FIELD,
                ERROR.FIND_DATA_SYNC_INVALID_TYPE,
                ERROR.FIND_DATA_SYNC_INVALID_ENUM
            );
        }
        return this.dataSyncDAO.listBySubmissionID(submissionID, typeFilter);
    }

    /**
     * Latest DataSync task for a submission and type, by startTime descending.
     * @param {string} submissionID Submission ID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object|null>} The latest record, or null when none match
     * @throws {Error} When submissionID or type is missing or the wrong type, or type is outside its enum
     */
    async findLatestBySubmissionIDAndType(submissionID, type) {
        for (const [field, value] of [["submissionID", submissionID], ["type", type]]) {
            this._checkSchemaValue(
                value,
                field,
                ERROR.FIND_DATA_SYNC_MISSING_FIELD,
                ERROR.FIND_DATA_SYNC_INVALID_TYPE,
                ERROR.FIND_DATA_SYNC_INVALID_ENUM
            );
        }
        return this.dataSyncDAO.findLatestBySubmissionIDAndType(submissionID, type);
    }
}

module.exports = { DataSyncService };
