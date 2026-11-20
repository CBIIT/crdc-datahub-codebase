const {
    DATA_SYNC_STATUS,
    normalizeDataSyncRollupStatus,
    missingDataSyncRollupMongoFilter,
} = require('../../constants/data-sync-constants');

describe('data-sync-constants', () => {
    describe('normalizeDataSyncRollupStatus', () => {
        it('returns Not Started for null, undefined, and empty string', () => {
            expect(normalizeDataSyncRollupStatus(null)).toBe(DATA_SYNC_STATUS.NOT_STARTED);
            expect(normalizeDataSyncRollupStatus(undefined)).toBe(DATA_SYNC_STATUS.NOT_STARTED);
            expect(normalizeDataSyncRollupStatus('')).toBe(DATA_SYNC_STATUS.NOT_STARTED);
        });

        it('returns stored value when valid', () => {
            expect(normalizeDataSyncRollupStatus(DATA_SYNC_STATUS.IN_PROGRESS)).toBe(
                DATA_SYNC_STATUS.IN_PROGRESS
            );
        });

        it('includes Stale among DataSync statuses', () => {
            expect(DATA_SYNC_STATUS.STALE).toBe('Stale');
        });
    });

    describe('missingDataSyncRollupMongoFilter', () => {
        it('matches missing, null, and empty string for the given field', () => {
            expect(missingDataSyncRollupMongoFilter('metadataDataSyncStatus')).toEqual({
                $or: [
                    { metadataDataSyncStatus: { $exists: false } },
                    { metadataDataSyncStatus: null },
                    { metadataDataSyncStatus: '' },
                ],
            });
        });
    });
});
