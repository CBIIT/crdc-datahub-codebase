const {
    DATA_RECORDS_COLLECTION,
    RELEASE_DATA_RECORDS_COLLECTION,
    SESSION_COLLECTION,
    USER_COLLECTION,
} = require('../../../crdc-datahub-database-drivers/database-constants');
const {
    INDEXES,
    ensureIndexes
} = require('../../../documentation/recurring-steps/ensure-indexes');

describe('ensure-indexes', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const catalogCollectionNames = [...new Set(INDEXES.map((spec) => spec.collection))];

    const expectedCatalog = [
        { collection: 'users', name: 'institution_id_role', keys: { 'institution._id': 1, role: 1 } },
        { collection: 'pendingPvs', name: 'submissionID_1', keys: { submissionID: 1 } },
        { collection: 'batch', name: 'submissionID_1_createdAt_-1', keys: { submissionID: 1, createdAt: -1 } },
        {
            collection: 'submissions',
            name: 'studyID_1_dataCommons_1_status_1',
            keys: { studyID: 1, dataCommons: 1, status: 1 },
        },
        { collection: 'sessions', name: 'expires_1', keys: { expires: 1 } },
        {
            collection: 'release',
            name: 'dataCommons_nodeType_nodeID',
            keys: { dataCommons: 1, nodeType: 1, nodeID: 1 },
        },
        { collection: 'release', name: 'CRDC_ID', keys: { CRDC_ID: 1 } },
        {
            collection: 'release',
            name: 'dataCommons_1_nodeType_1_nodeID_1_status_1',
            keys: { dataCommons: 1, nodeType: 1, nodeID: 1, status: 1 },
        },
        { collection: 'approvedStudies', name: 'programID_1', keys: { programID: 1 } },
        { collection: 'validation', name: 'submissionID_1', keys: { submissionID: 1 } },
        {
            collection: 'propertyPVs',
            name: 'model_1_version_1_property_1',
            keys: { model: 1, version: 1, property: 1 },
        },
        { collection: 'qcResults', name: 'submissionID_1', keys: { submissionID: 1 } },
        {
            collection: 'dataRecords',
            name: 'submissionID_nodeType_nodeID',
            keys: { submissionID: 1, nodeType: 1, nodeID: 1 },
        },
        {
            collection: 'dataRecords',
            name: 'dataCommons_nodeType_nodeID',
            keys: { dataCommons: 1, nodeType: 1, nodeID: 1 },
        },
        { collection: 'dataRecords', name: 'submissionID_index', keys: { submissionID: 1 } },
        {
            collection: 'dataRecords',
            name: 'studyID_entityType_nodeID',
            keys: { studyID: 1, entityType: 1, nodeID: 1 },
        },
        {
            collection: 'dataRecords',
            name: 'submissionID_1_status_1_nodeType_1_nodeID_1',
            keys: { submissionID: 1, status: 1, nodeType: 1, nodeID: 1 },
        },
        {
            collection: 'dataRecords',
            name: 'submissionID_1_nodeType_1_parents.parentType_1_parents.parentIDPropName_1_parents.parentIDValue_1',
            keys: {
                submissionID: 1,
                nodeType: 1,
                'parents.parentType': 1,
                'parents.parentIDPropName': 1,
                'parents.parentIDValue': 1,
            },
        },
    ];

    /**
     * @param {string[]} [collectionNames]
     * @param {{ indexes?: object[], createIndex?: jest.Mock }} [options]
     * @returns {{ db: object, collection: jest.Mock, createIndex: jest.Mock, indexes: jest.Mock }}
     */
    function mockDb(collectionNames = catalogCollectionNames, options = {}) {
        const indexes = options.indexes || jest.fn().mockResolvedValue([]);
        const createIndex = options.createIndex || jest.fn().mockResolvedValue('ok');
        const collection = jest.fn().mockReturnValue({ indexes, createIndex });
        const db = {
            collection,
            listCollections: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(collectionNames.map((name) => ({ name }))),
            }),
        };
        return { db, collection, indexes, createIndex };
    }

    /**
     * @param {Map<string, object[]>} indexesByCollection
     * @param {jest.Mock} createIndex
     * @returns {object}
     */
    function dbWithIndexesByCollection(indexesByCollection, createIndex) {
        const { db } = mockDb(catalogCollectionNames, { createIndex });
        db.collection = jest.fn((name) => ({
            indexes: jest.fn().mockResolvedValue(indexesByCollection.get(name) || []),
            createIndex,
        }));
        return db;
    }

    it('declares all 18 catalog indexes', () => {
        expect(INDEXES).toHaveLength(18);
        expect(INDEXES.map(({ collection, name, keys }) => ({ collection, name, keys }))).toEqual(expectedCatalog);
        const sessionsSpec = INDEXES.find((spec) => spec.collection === SESSION_COLLECTION && spec.name === 'expires_1');
        expect(sessionsSpec.expireAfterSeconds).toBe(0);
    });

    it('creates every catalog index when none exist', async () => {
        const { db, collection, createIndex } = mockDb();

        const result = await ensureIndexes(db);

        expect(result).toEqual({ success: true, created: INDEXES.length, skipped: 0 });
        expect(collection).toHaveBeenCalledTimes(catalogCollectionNames.length);
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length);
        INDEXES.forEach((spec, i) => {
            const expectedOptions = { name: spec.name, background: true };
            if (spec.expireAfterSeconds !== undefined) {
                expectedOptions.expireAfterSeconds = spec.expireAfterSeconds;
            }
            expect(createIndex).toHaveBeenNthCalledWith(i + 1, spec.keys, expectedOptions);
        });
    });

    it('skips an index when the same name and key pattern already exist', async () => {
        const indexesByCollection = new Map();
        for (const spec of INDEXES) {
            const list = indexesByCollection.get(spec.collection) || [];
            const entry = { name: spec.name, key: spec.keys };
            if (spec.expireAfterSeconds !== undefined) {
                entry.expireAfterSeconds = spec.expireAfterSeconds;
            }
            list.push(entry);
            indexesByCollection.set(spec.collection, list);
        }
        const createIndex = jest.fn();
        const db = dbWithIndexesByCollection(indexesByCollection, createIndex);

        const result = await ensureIndexes(db);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(INDEXES.length);
        expect(result.created).toBe(0);
        expect(createIndex).not.toHaveBeenCalled();
    });

    it('skips when the same keys exist under a different name and warns with both names', async () => {
        const crdcSpec = INDEXES.find(
            (spec) => spec.collection === RELEASE_DATA_RECORDS_COLLECTION && spec.name === 'CRDC_ID'
        );
        const indexesByCollection = new Map();
        indexesByCollection.set(RELEASE_DATA_RECORDS_COLLECTION, [
            { name: 'CRDC_ID_1', key: crdcSpec.keys },
        ]);
        const createIndex = jest.fn().mockResolvedValue('ok');
        const db = dbWithIndexesByCollection(indexesByCollection, createIndex);

        const result = await ensureIndexes(db);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(1);
        expect(result.created).toBe(INDEXES.length - 1);
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length - 1);
        expect(createIndex.mock.calls.some((call) => call[0].CRDC_ID === 1 && Object.keys(call[0]).length === 1))
            .toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CRDC_ID'));
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CRDC_ID_1'));
    });

    it('returns success false when createIndex rejects but continues remaining specs', async () => {
        const createIndex = jest.fn()
            .mockRejectedValueOnce(new Error('index name conflict'))
            .mockResolvedValue('ok');
        const { db } = mockDb(catalogCollectionNames, { createIndex });

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toBe(`${USER_COLLECTION}.institution_id_role: index name conflict`);
        expect(result.created).toBe(INDEXES.length - 1);
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length);
    });

    it('skips missing collections, continues others, and returns success false', async () => {
        const present = catalogCollectionNames.filter((name) => name !== DATA_RECORDS_COLLECTION);
        const dataRecordsCount = INDEXES.filter((spec) => spec.collection === DATA_RECORDS_COLLECTION).length;
        const { db, collection, createIndex } = mockDb(present);

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toBe(`Collection does not exist: ${DATA_RECORDS_COLLECTION}`);
        expect(result.created).toBe(INDEXES.length - dataRecordsCount);
        expect(result.skipped).toBe(0);
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length - dataRecordsCount);
        expect(collection).not.toHaveBeenCalledWith(DATA_RECORDS_COLLECTION);
    });

    it('returns success false when the same name exists with different keys and does not createIndex', async () => {
        const indexesByCollection = new Map();
        indexesByCollection.set(USER_COLLECTION, [
            { name: 'institution_id_role', key: { role: 1 } },
        ]);
        const createIndex = jest.fn().mockResolvedValue('ok');
        const db = dbWithIndexesByCollection(indexesByCollection, createIndex);

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toEqual(expect.stringContaining(`${USER_COLLECTION}.institution_id_role:`));
        expect(result.error).toEqual(expect.stringContaining('different keys'));
        expect(createIndex.mock.calls.some((call) => call[0]['institution._id'] === 1)).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('institution_id_role'));
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('role'));
    });

    it('returns success false when expireAfterSeconds differs and does not createIndex', async () => {
        const indexesByCollection = new Map();
        indexesByCollection.set(SESSION_COLLECTION, [
            { name: 'expires_1', key: { expires: 1 }, expireAfterSeconds: 3600 },
        ]);
        const createIndex = jest.fn().mockResolvedValue('ok');
        const db = dbWithIndexesByCollection(indexesByCollection, createIndex);

        const result = await ensureIndexes(db);

        expect(result.success).toBe(false);
        expect(result.error).toEqual(expect.stringContaining(`${SESSION_COLLECTION}.expires_1:`));
        expect(result.error).toEqual(expect.stringContaining('expireAfterSeconds'));
        expect(result.skipped).toBe(1);
        expect(createIndex.mock.calls.some((call) => call[0].expires === 1 && Object.keys(call[0]).length === 1))
            .toBe(false);
    });

    it('skips a later catalog spec with the same keys using the in-memory index cache', async () => {
        const duplicate = {
            collection: RELEASE_DATA_RECORDS_COLLECTION,
            keys: { CRDC_ID: 1 },
            name: 'CRDC_ID_duplicate',
        };
        INDEXES.push(duplicate);
        try {
            const { db, createIndex } = mockDb();

            const result = await ensureIndexes(db);

            expect(result.success).toBe(true);
            expect(result.created).toBe(INDEXES.length - 1);
            expect(result.skipped).toBe(1);
            expect(createIndex).toHaveBeenCalledTimes(INDEXES.length - 1);
            expect(createIndex.mock.calls.filter((call) => call[0].CRDC_ID === 1 && Object.keys(call[0]).length === 1))
                .toHaveLength(1);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CRDC_ID_duplicate'));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('CRDC_ID'));
        } finally {
            INDEXES.pop();
        }
    });

    it('retries when createIndex reports an index build in progress and then succeeds', async () => {
        const createIndex = jest.fn()
            .mockRejectedValueOnce(new Error('index build already in progress'))
            .mockResolvedValue('ok');
        const { db } = mockDb(catalogCollectionNames, { createIndex });

        const result = await ensureIndexes(db);

        expect(result.success).toBe(true);
        expect(result.created).toBe(INDEXES.length);
        expect(result.error).toBeUndefined();
        expect(createIndex).toHaveBeenCalledTimes(INDEXES.length + 1);
    });

    it('skips after createIndex reports an equivalent index already exists', async () => {
        const crdcSpec = INDEXES.find(
            (spec) => spec.collection === RELEASE_DATA_RECORDS_COLLECTION && spec.name === 'CRDC_ID'
        );
        const releaseIndexes = { current: [] };
        const createIndex = jest.fn().mockImplementation(async (keys) => {
            if (keys.CRDC_ID === 1 && Object.keys(keys).length === 1) {
                throw new Error('An equivalent index already exists');
            }
            return 'ok';
        });
        const { db } = mockDb();
        db.collection = jest.fn((name) => {
            if (name === RELEASE_DATA_RECORDS_COLLECTION) {
                return {
                    indexes: jest.fn().mockImplementation(async () => releaseIndexes.current),
                    createIndex: jest.fn().mockImplementation(async (keys, options) => {
                        try {
                            return await createIndex(keys, options);
                        } finally {
                            if (!(keys.CRDC_ID === 1 && Object.keys(keys).length === 1)) {
                                releaseIndexes.current = [
                                    ...releaseIndexes.current,
                                    { name: options.name, key: keys },
                                ];
                            } else {
                                releaseIndexes.current = [
                                    ...releaseIndexes.current,
                                    { name: 'CRDC_ID_1', key: crdcSpec.keys },
                                ];
                            }
                        }
                    }),
                };
            }
            return {
                indexes: jest.fn().mockResolvedValue([]),
                createIndex: jest.fn().mockResolvedValue('ok'),
            };
        });

        const result = await ensureIndexes(db);

        expect(result.success).toBe(true);
        expect(result.skipped).toBe(1);
        expect(result.created).toBe(INDEXES.length - 1);
        expect(result.error).toBeUndefined();
        expect(createIndex).toHaveBeenCalledWith(crdcSpec.keys, { name: 'CRDC_ID', background: true });
    });
});
