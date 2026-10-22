import assert from 'node:assert';
import { test, afterEach, mock } from 'node:test';

import { backfillReleaseStudyIDs, NODE_ID_PROPERTY_MAP } from '../scripts/backfill-release-studyids.js';

/**
 * @returns {AsyncIterable<Record<string, unknown>>}
 */
function asyncIterableFrom(docs) {
    return {
        [Symbol.asyncIterator]: async function* () {
            for (const d of docs) {
                yield d;
            }
        }
    };
}

let restoreConsole = null;

afterEach(() => {
    if (restoreConsole) {
        restoreConsole();
        restoreConsole = null;
    }
    mock.reset();
});

function stubConsole() {
    const originals = {
        log: console.log,
        error: console.error,
        warn: console.warn
    };
    for (const k of Object.keys(originals)) {
        console[k] = () => {};
    }
    return () => {
        Object.assign(console, originals);
    };
}

/**
 * @param {{
 *   byDataCommon?: Record<string, { releaseDocs: Record<string, unknown>[], findOneByNodeValue?: Map<unknown, Record<string, unknown>> }>,
 *   onCount?: (dataCommon: string, cond: Record<string, unknown>) => void
 * }} config
 */
function createMockConnect({ byDataCommon = {}, onCount } = {}) {
    return async () => {
        const client = {
            close: async () => {}
        };
        const db = {
            databaseName: 'testdb',
            /**
             * @param {string} name
             */
            collection(name) {
                if (name === 'release') {
                    return {
                        /**
                         * @param {Record<string, unknown>} cond
                         */
                        countDocuments: async (cond) => {
                            const dc = cond.dataCommons;
                            if (typeof dc === 'string' && onCount) {
                                onCount(dc, cond);
                            }
                            return 0;
                        },
                        /**
                         * @param {Record<string, unknown>} cond
                         */
                        find: (cond) => {
                            const dc = cond.dataCommons;
                            if (typeof dc !== 'string') {
                                return asyncIterableFrom([]);
                            }
                            const entry = byDataCommon[dc];
                            return asyncIterableFrom(entry?.releaseDocs ?? []);
                        },
                        /**
                         * @param {Record<string, unknown>} filter
                         * @param {Record<string, unknown>} update
                         */
                        updateOne: async (filter, update) => ({
                            matchedCount: 1,
                            modifiedCount: 1,
                            upsertedCount: 0,
                            acknowledged: true,
                            _filter: filter,
                            _update: update
                        })
                    };
                }
                if (name === 'approvedStudies') {
                    return {
                        /**
                         * @param {Record<string, unknown>} query
                         */
                        findOne: async (query) => {
                            const keys = Object.keys(query);
                            const key = keys[0];
                            if (!key) {
                                return null;
                            }
                            const val = query[key];
                            for (const conf of Object.values(byDataCommon)) {
                                if (conf.findOneByNodeValue?.has(val)) {
                                    return conf.findOneByNodeValue.get(val);
                                }
                            }
                            return null;
                        }
                    };
                }
                throw new Error(`Unexpected collection: ${name}`);
            }
        };
        return { client, db };
    };
}

test('no --data-commons: iterates every key in NODE_ID_PROPERTY_MAP', async () => {
    restoreConsole = stubConsole();
    const seen = [];
    const connect = createMockConnect({
        onCount: (dc) => {
            seen.push(dc);
        }
    });
    await backfillReleaseStudyIDs(
        { 'data-commons': [], 'single-update': false, 'dry-run': true },
        { connect }
    );
    const expected = Object.keys(NODE_ID_PROPERTY_MAP).slice().sort();
    assert.deepEqual(
        [...new Set(seen)].slice().sort(),
        expected
    );
    assert.equal(seen.length, expected.length);
});

test('explicit data commons: only those are processed', async () => {
    restoreConsole = stubConsole();
    const seen = [];
    const connect = createMockConnect({
        onCount: (dc) => {
            seen.push(dc);
        }
    });
    await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': true },
        { connect }
    );
    assert.deepEqual(seen, ['CDS']);
});

test('unknown data common: counted in stats, no countDocuments for that name', async () => {
    restoreConsole = stubConsole();
    const seen = [];
    const connect = createMockConnect({
        onCount: (dc) => {
            seen.push(dc);
        }
    });
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['NOT_A_REAL_COMMON'], 'single-update': false, 'dry-run': true },
        { connect }
    );
    assert.equal(stats.unknownDataCommon, 1);
    assert.equal(seen.length, 0);
    assert.equal(stats.releasesCandidatesTotal, 0);
});

test('dry-run: would update, no updateOne on db', async () => {
    restoreConsole = stubConsole();
    const findOneByNodeValue = new Map([['node-1', { id: 'study-abc' }]]);
    const { client, db } = await createMockConnect({
        byDataCommon: {
            CDS: {
                releaseDocs: [{ _id: 'r1', nodeID: 'node-1' }],
                findOneByNodeValue
            }
        }
    })();
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        acknowledged: true
    }));
    const release = db.collection('release');
    const connect = async () => ({
        client,
        db: {
            databaseName: db.databaseName,
            /**
             * @param {string} n
             */
            collection: (n) => {
                if (n === 'release') {
                    return {
                        countDocuments: release.countDocuments,
                        find: release.find,
                        updateOne
                    };
                }
                return db.collection(n);
            }
        }
    });
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': true },
        { connect }
    );
    assert.equal(stats.dryRunWouldUpdate, 1);
    assert.equal(updateOne.mock.callCount(), 0);
});

test('dry-run: skip when nodeID missing', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        byDataCommon: {
            CDS: {
                releaseDocs: [{ _id: 'a', nodeID: null }],
                findOneByNodeValue: new Map()
            }
        }
    });
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': true },
        { connect }
    );
    assert.equal(stats.skippedMissingNodeId, 1);
    assert.equal(stats.dryRunWouldUpdate, 0);
});

test('dry-run: skip when no approved study', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        byDataCommon: {
            CDS: {
                releaseDocs: [{ _id: 'a', nodeID: 'orphan' }],
                findOneByNodeValue: new Map()
            }
        }
    });
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': true },
        { connect }
    );
    assert.equal(stats.skippedNoApprovedStudy, 1);
});

test('write: updateOne sets studyID from approved study', async () => {
    restoreConsole = stubConsole();
    const releaseId = { toString: () => 'oid1' };
    const findOneByNodeValue = new Map();
    findOneByNodeValue.set('n1', { id: 'final-study-id' });
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            byDataCommon: {
                CDS: {
                    releaseDocs: [{ _id: releaseId, nodeID: 'n1' }],
                    findOneByNodeValue
                }
            }
        })();
        return {
            client: base.client,
            db: {
                ...base.db,
                /**
                 * @param {string} n
                 */
                collection: (n) => {
                    if (n === 'release') {
                        return {
                            countDocuments: base.db.collection('release').countDocuments,
                            find: base.db.collection('release').find,
                            updateOne
                        };
                    }
                    return base.db.collection(n);
                }
            }
        };
    };
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': false },
        { connect }
    );
    assert.equal(updateOne.mock.callCount(), 1);
    const call = updateOne.mock.calls[0];
    const updateArg = call?.arguments[1];
    assert.ok(updateArg);
    assert.equal(updateArg.$set.studyID, 'final-study-id');
    assert.equal(stats.updateOperations, 1);
    assert.equal(stats.matchedTotal, 1);
});

test('single-update dry-run: stops after first and sets singleUpdateStopped', async () => {
    restoreConsole = stubConsole();
    const findOneByNodeValue = new Map();
    findOneByNodeValue.set('a', { id: 's1' });
    findOneByNodeValue.set('b', { id: 's2' });
    const connect = createMockConnect({
        byDataCommon: {
            CDS: {
                releaseDocs: [
                    { _id: 1, nodeID: 'a' },
                    { _id: 2, nodeID: 'b' }
                ],
                findOneByNodeValue
            }
        }
    });
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': true, 'dry-run': true },
        { connect }
    );
    assert.equal(stats.dryRunWouldUpdate, 1);
    assert.equal(stats.singleUpdateStopped, true);
});

test('write: matchedCount 0 increments unmatchedWriteAttempts', async () => {
    restoreConsole = stubConsole();
    const findOneByNodeValue = new Map();
    findOneByNodeValue.set('n1', { id: 's' });
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            byDataCommon: {
                CDS: {
                    releaseDocs: [{ _id: 'x', nodeID: 'n1' }],
                    findOneByNodeValue
                }
            }
        })();
        return {
            client: base.client,
            db: {
                ...base.db,
                /**
                 * @param {string} n
                 */
                collection: (n) => {
                    if (n === 'release') {
                        return {
                            countDocuments: base.db.collection('release').countDocuments,
                            find: base.db.collection('release').find,
                            updateOne
                        };
                    }
                    return base.db.collection(n);
                }
            }
        };
    };
    const stats = await backfillReleaseStudyIDs(
        { 'data-commons': ['CDS'], 'single-update': false, 'dry-run': false },
        { connect }
    );
    assert.equal(stats.unmatchedWriteAttempts, 1);
});
