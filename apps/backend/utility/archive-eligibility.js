const { DATA_TYPE } = require('../constants/submission-constants');
const { DATA_SYNC_STATUS, DATA_SYNC_TYPE } = require('../constants/data-sync-constants');

/**
 * True when a submission meets the DataSync status criteria for archival:
 * Metadata Only with a succeeded metadata sync, or Metadata and Data Files
 * with both metadata and file syncs succeeded.
 * @param {object} submission Submission document
 * @returns {boolean}
 */
function isArchiveEligible(submission) {
    if (submission?.metadataDataSyncStatus !== DATA_SYNC_STATUS.SUCCEEDED) {
        return false;
    }
    if (submission.dataType === DATA_TYPE.METADATA_ONLY) {
        return true;
    }
    if (submission.dataType === DATA_TYPE.METADATA_AND_DATA_FILES) {
        return submission.fileDataSyncStatus === DATA_SYNC_STATUS.SUCCEEDED;
    }
    return false;
}

/**
 * DataSync types a submission must have a record for.
 * Metadata Only requires metadata. Metadata and Data Files requires metadata and file.
 * Any other dataType returns an empty list; callers must treat that as not eligible.
 * @param {object} submission Submission document
 * @returns {string[]}
 */
function requiredDataSyncTypes(submission) {
    if (submission?.dataType === DATA_TYPE.METADATA_ONLY) {
        return [DATA_SYNC_TYPE.METADATA];
    }
    if (submission?.dataType === DATA_TYPE.METADATA_AND_DATA_FILES) {
        return [DATA_SYNC_TYPE.METADATA, DATA_SYNC_TYPE.FILE];
    }
    return [];
}

module.exports = { isArchiveEligible, requiredDataSyncTypes };
