const DataSyncDAO = require("../dao/dataSync");
const ERROR = require("../constants/error-constants");
const { replaceErrorString } = require("../utility/string-util");

const REQUIRED_DATA_SYNC_FIELDS = [
    "type",
    "submissionID",
    "sourceFolder",
    "targetFolder",
    "startTime",
    "status",
];

const OPTIONAL_DATA_SYNC_FIELDS = [
    "taskArn",
    "taskExecutionArn",
    "endTime",
    "_id",
];

const UPDATABLE_DATA_SYNC_FIELDS = [
    "status",
    "endTime",
    "taskArn",
    "taskExecutionArn",
];

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
     * Rejects a missing, mistyped, or out-of-enum submissionID or type.
     * @param {string} submissionID
     * @param {string} type DataSync type (metadata or file)
     * @throws {Error} When submissionID or type is missing, the wrong type, or type is outside its enum
     */
    _assertFindArgs(submissionID, type) {
        this._checkSchemaValue(
            submissionID,
            "submissionID",
            ERROR.FIND_DATA_SYNC_MISSING_FIELD,
            ERROR.FIND_DATA_SYNC_INVALID_TYPE,
            ERROR.FIND_DATA_SYNC_INVALID_ENUM
        );
        this._checkSchemaValue(
            type,
            "type",
            ERROR.FIND_DATA_SYNC_MISSING_FIELD,
            ERROR.FIND_DATA_SYNC_INVALID_TYPE,
            ERROR.FIND_DATA_SYNC_INVALID_ENUM
        );
    }

    /**
     * Create a DataSync task record.
     * Required: type, submissionID, sourceFolder, targetFolder, startTime, status.
     * Optional: taskArn, taskExecutionArn, endTime, _id. Undefined optional keys are omitted.
     * Only those fields are written. Null or empty optional values are rejected.
     * Field types and enum values are checked against the DataSync schema.
     * @param {object} data Task fields
     * @returns {Promise<object>} The created record
     * @throws {Error} When a required field is missing, an optional field is empty, a field has the wrong type, a value is outside its enum, or create resolves to null
     */
    async createDataSync(data) {
        const payload = {};
        for (const field of REQUIRED_DATA_SYNC_FIELDS) {
            this._checkSchemaValue(
                data?.[field],
                field,
                ERROR.CREATE_DATA_SYNC_MISSING_FIELD,
                ERROR.CREATE_DATA_SYNC_INVALID_TYPE,
                ERROR.CREATE_DATA_SYNC_INVALID_ENUM
            );
            payload[field] = data[field];
        }
        for (const field of OPTIONAL_DATA_SYNC_FIELDS) {
            if (data?.[field] === undefined) {
                continue;
            }
            this._checkSchemaValue(
                data[field],
                field,
                ERROR.CREATE_DATA_SYNC_EMPTY_FIELD,
                ERROR.CREATE_DATA_SYNC_INVALID_TYPE,
                ERROR.CREATE_DATA_SYNC_INVALID_ENUM
            );
            payload[field] = data[field];
        }
        const record = await this.dataSyncDAO.create(payload);
        if (record == null) {
            throw new Error("Failed to create DataSync");
        }
        return record;
    }

    /**
     * Update a DataSync task by ID.
     * dataSyncID is required. At least one whitelisted field must be present.
     * Undefined keys are skipped. Null or empty whitelisted values are rejected.
     * Only status, endTime, taskArn, and taskExecutionArn are written. Other keys are ignored.
     * The DataSync schema does not use Mongoose timestamps.
     * @param {string} dataSyncID Task ID
     * @param {object} updates Fields to update. Keys outside the whitelist are ignored.
     * @returns {Promise<object>} The updated record
     * @throws {Error} When dataSyncID is missing or the wrong type, a present field is empty, the wrong type, or outside its enum, no whitelisted field is present, or update resolves to null
     */
    async updateDataSync(dataSyncID, updates) {
        if (dataSyncID == null || dataSyncID === "") {
            throw new Error(replaceErrorString(ERROR.UPDATE_DATA_SYNC_MISSING_FIELD, "dataSyncID"));
        }
        if (typeof dataSyncID !== "string") {
            throw new Error(replaceErrorString(ERROR.UPDATE_DATA_SYNC_INVALID_TYPE, "dataSyncID"));
        }
        const allowedUpdates = {};
        for (const field of UPDATABLE_DATA_SYNC_FIELDS) {
            if (updates?.[field] === undefined) {
                continue;
            }
            this._checkSchemaValue(
                updates[field],
                field,
                ERROR.UPDATE_DATA_SYNC_EMPTY_FIELD,
                ERROR.UPDATE_DATA_SYNC_INVALID_TYPE,
                ERROR.UPDATE_DATA_SYNC_INVALID_ENUM
            );
            allowedUpdates[field] = updates[field];
        }
        if (Object.keys(allowedUpdates).length === 0) {
            throw new Error(ERROR.UPDATE_DATA_SYNC_NO_FIELDS);
        }
        const record = await this.dataSyncDAO.update(dataSyncID, allowedUpdates, false);
        if (record == null) {
            throw new Error("Failed to update DataSync");
        }
        return record;
    }

    /**
     * Latest DataSync task for a submission and type, by startTime descending.
     * @param {string} submissionID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object|null>} The latest record, or null when none match
     * @throws {Error} When submissionID or type is missing, the wrong type, or type is outside its enum
     */
    async findLatestBySubmissionIDAndType(submissionID, type) {
        this._assertFindArgs(submissionID, type);
        return this.dataSyncDAO.findLatestBySubmissionIDAndType(submissionID, type);
    }

    /**
     * In-progress DataSync tasks for a submission and type.
     * @param {string} submissionID
     * @param {string} type DataSync type (metadata or file)
     * @returns {Promise<object[]>} Matching records
     * @throws {Error} When submissionID or type is missing, the wrong type, or type is outside its enum
     */
    async findInProgressBySubmissionIDAndType(submissionID, type) {
        this._assertFindArgs(submissionID, type);
        return this.dataSyncDAO.findInProgressBySubmissionIDAndType(submissionID, type);
    }
}

module.exports = { DataSyncService };
