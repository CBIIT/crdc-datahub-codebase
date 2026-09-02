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

    /**
     * @param {{ indexes?: object[], createIndex?: jest.Mock }} [options]
     * @returns {{ collection: jest.Mock, createIndex: jest.Mock, indexes: jest.Mock }}
     */
    function mockDb(options = {}) {
        const indexes = options.indexes || jest.fn().mockResolvedValue([]);
        const createIndex = options.createIndex || jest.fn().mockResolvedValue('ok');
        const collection = jest.fn().mockReturnValue({ indexes, createIndex });
        return { db: { collection }, collection, indexes, createIndex };
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
});
