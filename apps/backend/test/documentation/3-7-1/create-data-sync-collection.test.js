const { DATA_SYNC_COLLECTION } = require('../../../crdc-datahub-database-drivers/database-constants');
const { createDataSyncCollection } = require('../../../documentation/3-7-1/create-data-sync-collection');

describe('Create dataSync collection migration', () => {
    let mockDb;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockDb = {
            createCollection: jest.fn()
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should create collection and return created: true', async () => {
        mockDb.createCollection.mockResolvedValue(undefined);

        const result = await createDataSyncCollection(mockDb);

        expect(mockDb.createCollection).toHaveBeenCalledWith(DATA_SYNC_COLLECTION);
        expect(result).toEqual({ success: true, created: true });
    });

    it('should return skipped: true when collection already exists (code 48)', async () => {
        const err = new Error('namespace exists');
        err.code = 48;
        mockDb.createCollection.mockRejectedValue(err);

        const result = await createDataSyncCollection(mockDb);

        expect(result).toEqual({ success: true, skipped: true });
    });

    it('should return success: false on other errors', async () => {
        mockDb.createCollection.mockRejectedValue(new Error('connection failed'));

        const result = await createDataSyncCollection(mockDb);

        expect(result).toEqual({ success: false, error: 'connection failed' });
    });
});
