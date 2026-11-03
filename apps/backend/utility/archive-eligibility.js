const { DATA_TYPE } = require('../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../constants/data-sync-constants');

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

module.exports = { isArchiveEligible };
