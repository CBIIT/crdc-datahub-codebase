const { DATA_RECORDS_COLLECTION } = require('../../../crdc-datahub-database-drivers/database-constants');
const {
    INDEXES,
    ensureIndexes
} = require('../../../documentation/recurring-steps/ensure-indexes');

describe('ensure-indexes', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const catalogCollectionNames = [...new Set(INDEXES.map((spec) => spec.collection))];

    /**
     * @param {string[]} names
     * @returns {jest.Mock}
     */
    function mockListCollections(names = catalogCollectionNames) {
        return jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(names.map((name) => ({ name }))),
        });
    }

    /**
     * @param {{ indexes?: object[], createIndex?: jest.Mock, collectionNames?: string[] }} [options]
     * @returns {{ db: object, collection: jest.Mock, createIndex: jest.Mock, indexes: jest.Mock }}
     */
    function mockDb(options = {}) {
        const indexes = options.indexes || jest.fn().mockResolvedValue([]);
        const createIndex = options.createIndex || jest.fn().mockResolvedValue('ok');
        const collection = jest.fn().mockReturnValue({ indexes, createIndex });
        const listCollections = mockListCollections(options.collectionNames);
        return { db: { collection, listCollections }, collection, indexes, createIndex };
    }

    it('creates every catalog index when none exist', async () => {
        const { db, collection, createIndex } = mockDb();

        const result = await ensureIndexes(db);

        expect(result).toEqual({ success: true, created: INDEXES.length, skipped: 0 });
        expect(collection).toHaveBeenCalledTimes(INDEXES.length);
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length);
        INDEXES.forEach((spec, i) => {
            expect(collection).toHaveBeenNthCalledWith(i + 1, spec.collection);
            expect(createIndex).toHaveBeenNthCalledWith(i + 1, spec.keys, { name: spec.name });
        });
    });

    it('skips an index when the same name and key pattern already exist', async () => {
        const indexesByCollection = new Map();
        for (const spec of INDEXES) {
            const list = indexesByCollection.get(spec.collection) || [];
            list.push({ name: spec.name, key: spec.keys });
            indexesByCollection.set(spec.collection, list);
        }
        const createIndex = jest.fn();
        const db = {
            listCollections: mockListCollections(),
            collection: jest.fn((name) => ({
                indexes: jest.fn().mockResolvedValue(indexesByCollection.get(name) || []),
                createIndex,
            })),
        };

        const result = await ensureIndexes(db);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(INDEXES.length);
        expect(result.created).toBe(0);
        expect(createIndex).not.toHaveBeenCalled();
    });

    it('returns success false when createIndex rejects', async () => {
        const { db } = mockDb({
            createIndex: jest.fn().mockRejectedValue(new Error('index name conflict')),
        });

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toBe('index name conflict');
        expect(result.created).toBe(0);
    });

    it('skips all indexes for a missing collection and still fails after creating the rest', async () => {
        const remaining = INDEXES.filter((spec) => spec.collection !== DATA_RECORDS_COLLECTION);
        const { db, collection, createIndex } = mockDb({
            collectionNames: catalogCollectionNames.filter((name) => name !== DATA_RECORDS_COLLECTION),
        });

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toBe(`Collection does not exist: ${DATA_RECORDS_COLLECTION}`);
        expect(result.created).toBe(remaining.length);
        expect(result.skipped).toBe(0);
        expect(collection).toHaveBeenCalledTimes(remaining.length);
        expect(createIndex).toHaveBeenCalledTimes(remaining.length);
        remaining.forEach((spec, i) => {
            expect(collection).toHaveBeenNthCalledWith(i + 1, spec.collection);
            expect(createIndex).toHaveBeenNthCalledWith(i + 1, spec.keys, { name: spec.name });
        });
        expect(console.error).toHaveBeenCalledWith(
            `❌ Collection ${DATA_RECORDS_COLLECTION} does not exist; skipping its indexes`
        );
    });
});
