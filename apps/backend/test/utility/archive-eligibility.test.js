const { isArchiveEligible } = require('../../utility/archive-eligibility');
const { DATA_TYPE } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

/**
 * isArchiveEligible is the pure predicate form of the archive status criteria:
 *
 *   (dataType = "Metadata Only"           AND metadataDataSyncStatus = "Succeeded")
 *   OR
 *   (dataType = "Metadata and Data Files" AND metadataDataSyncStatus = "Succeeded"
 *                                         AND fileDataSyncStatus     = "Succeeded")
 */

/** @param {object} overrides */
const submission = (overrides) => ({ _id: 'sub-1', ...overrides });

describe('isArchiveEligible', () => {

    it('treats Metadata Only with a succeeded metadata sync as eligible', () => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_ONLY,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        }))).toBe(true);
    });

    it('ignores fileDataSyncStatus for Metadata Only', () => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_ONLY,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
        }))).toBe(true);
    });

    it('rejects Metadata Only when the metadata sync has not started', () => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_ONLY,
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
        }))).toBe(false);
    });

    it('treats Metadata and Data Files with both syncs succeeded as eligible', () => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        }))).toBe(true);
    });

    it.each([
        DATA_SYNC_STATUS.FAILED,
        DATA_SYNC_STATUS.NOT_STARTED,
        DATA_SYNC_STATUS.IN_PROGRESS,
    ])('rejects Metadata and Data Files when the file sync is %s', (fileStatus) => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            fileDataSyncStatus: fileStatus,
        }))).toBe(false);
    });

    it('rejects Metadata and Data Files when only the file sync succeeded', () => {
        expect(isArchiveEligible(submission({
            dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        }))).toBe(false);
    });

});
