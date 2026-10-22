const { SUBMISSIONS_COLLECTION } = require('../../../crdc-datahub-database-drivers/database-constants');
const { DATA_SYNC_STATUS, missingDataSyncRollupMongoFilter } = require('../../../constants/data-sync-constants');
const { backfillSubmissionDataSyncStatus } = require('../../../documentation/3-7-1/backfill-submission-data-sync-status');

const metadataFilter = missingDataSyncRollupMongoFilter('metadataDataSyncStatus');
const fileFilter = missingDataSyncRollupMongoFilter('fileDataSyncStatus');

describe('backfill-submission-data-sync-status', () => {
    let mockCollection;
    let mockDb;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockCollection = {
            countDocuments: jest.fn(),
            updateMany: jest.fn(),
        };
        mockDb = {
            collection: jest.fn(() => mockCollection),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('updates submissions missing metadataDataSyncStatus or fileDataSyncStatus', async () => {
        mockCollection.countDocuments.mockResolvedValue(2);
        mockCollection.updateMany
            .mockResolvedValueOnce({ matchedCount: 3, modifiedCount: 3 })
            .mockResolvedValueOnce({ matchedCount: 2, modifiedCount: 2 });

        const result = await backfillSubmissionDataSyncStatus(mockDb);

        expect(mockDb.collection).toHaveBeenCalledWith(SUBMISSIONS_COLLECTION);
        expect(mockCollection.countDocuments).toHaveBeenCalledWith({
            $or: [...metadataFilter.$or, ...fileFilter.$or],
        });
        expect(mockCollection.updateMany).toHaveBeenNthCalledWith(
            1,
            metadataFilter,
            { $set: { metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED } }
        );
        expect(mockCollection.updateMany).toHaveBeenNthCalledWith(
            2,
            fileFilter,
            { $set: { fileDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED } }
        );
        expect(result).toEqual({
            success: true,
            message: 'Backfilled DataSync rollup fields on 2 submission(s) (metadata: 3 modified; file: 2 modified)',
            matchedCount: 2,
            modifiedCount: 2,
            metadataMatchedCount: 3,
            metadataModifiedCount: 3,
            fileMatchedCount: 2,
            fileModifiedCount: 2,
        });
    });

    it('returns success with zero modifications when none match', async () => {
        mockCollection.countDocuments.mockResolvedValue(0);
        mockCollection.updateMany
            .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 })
            .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

        const result = await backfillSubmissionDataSyncStatus(mockDb);

        expect(result.success).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
    });
});
