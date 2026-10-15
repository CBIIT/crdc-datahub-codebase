/**
 * DataSync task and submission rollup status/type strings.
 * Keep in sync with apps/validator
 *
 * Stored null, missing, or empty string on submission rollup fields are invalid;
 * use normalizeDataSyncRollupStatus for API responses; migration backfill persists Not Started.
 */
const DATA_SYNC_STATUS = Object.freeze({
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
});

const DATA_SYNC_TYPE = Object.freeze({
    METADATA: 'metadata',
    FILE: 'file',
});

/** @type {readonly string[]} */
const DATA_SYNC_STATUSES = Object.freeze(Object.values(DATA_SYNC_STATUS));

/**
 * GraphQL/API view of a submission rollup field. Null and empty string mean Not Started.
 * @param {string|null|undefined} value Stored rollup value
 * @returns {string}
 */
function normalizeDataSyncRollupStatus(value) {
    if (value == null || value === '') {
        return DATA_SYNC_STATUS.NOT_STARTED;
    }
    return value;
}

/**
 * MongoDB filter matching submissions whose rollup field should be backfilled.
 * @param {string} fieldName Submission field name (e.g. metadataDataSyncStatus)
 * @returns {{ $or: object[] }}
 */
function missingDataSyncRollupMongoFilter(fieldName) {
    return {
        $or: [
            { [fieldName]: { $exists: false } },
            { [fieldName]: null },
            { [fieldName]: '' },
        ],
    };
}

module.exports = Object.freeze({
    DATA_SYNC_STATUS,
    DATA_SYNC_TYPE,
    DATA_SYNC_STATUSES,
    normalizeDataSyncRollupStatus,
    missingDataSyncRollupMongoFilter,
});
