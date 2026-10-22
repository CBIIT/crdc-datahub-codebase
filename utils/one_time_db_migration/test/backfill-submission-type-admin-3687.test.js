import assert from 'node:assert';
import { test, afterEach, mock } from 'node:test';

import {
    ADMIN_SUBMISSION_TYPE,
    backfillSubmissionTypeAdmin3687,
    buildPatchedHistory,
    createStats,
    findLastSubmittedHistoryIndex,
    historyNeedsAdminSubmitPatch,
    parseAdminSubmissionIdsFromConfig,
    planAdminBackfillPatch,
    submissionNeedsAdminTypePatch,
    UUID_REGEX,
    validateAndDedupeSubmissionIds
} from '../scripts/backfill-submission-type-admin-3687.js';

const ID_A = 'c70f6940-8bac-43ef-a5ac-cc9ff55cc354';
const ID_B = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = 'f9a86e2b-d980-45b1-9401-254266b64e51';

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

function sampleHistory({ lastSubmittedAdmin = undefined } = {}) {
    const submitted = {
        status: 'Submitted',
        userID: USER_ID,
        dateTime: new Date('2025-04-07T19:21:33.733Z')
    };
    if (lastSubmittedAdmin === true) {
        submitted.isAdminSubmit = true;
    } else if (lastSubmittedAdmin === false) {
        submitted.isAdminSubmit = false;
    }
    return [
        { status: 'New', userID: USER_ID, dateTime: new Date('2025-04-07T19:12:00.031Z') },
        { status: 'In Progress', userID: USER_ID, dateTime: new Date('2025-04-07T19:12:23.119Z') },
        submitted
    ];
}

/**
 * @param {Record<string, { _id: string, status?: string, history?: unknown[] }>} docsById
 */
function createMockConnect(docsById) {
    return async () => {
        const client = { close: async () => {} };
        const db = {
            databaseName: 'testdb',
            /**
             * @param {string} name
             */
            collection(name) {
                if (name !== 'submissions') {
                    throw new Error(`Unexpected collection: ${name}`);
                }
                return {
                    /**
                     * @param {Record<string, unknown>} filter
                     */
                    find: (filter) => {
                        const ids = filter._id?.$in ?? [];
                        const docs = ids
                            .map((id) => docsById[String(id)])
                            .filter(Boolean);
                        return {
                            [Symbol.asyncIterator]: async function* () {
                                for (const d of docs) {
                                    yield d;
                                }
                            }
                        };
                    },
                    updateOne: mock.fn(async () => ({
                        matchedCount: 1,
                        modifiedCount: 1,
                        acknowledged: true
                    }))
                };
            }
        };
        return { client, db };
    };
}

test('UUID_REGEX accepts canonical UUIDs', () => {
    assert.ok(UUID_REGEX.test(ID_A));
    assert.ok(UUID_REGEX.test(ID_A.toUpperCase()));
    assert.ok(!UUID_REGEX.test('not-a-uuid'));
});

test('parseAdminSubmissionIdsFromConfig reads admin_submission_ids', () => {
    const ids = parseAdminSubmissionIdsFromConfig({
        admin_submission_ids: [`  ${ID_A}  `, ID_B]
    });
    assert.deepEqual(ids, [ID_A, ID_B]);
});

test('parseAdminSubmissionIdsFromConfig rejects missing array', () => {
    assert.throws(() => parseAdminSubmissionIdsFromConfig({}), /admin_submission_ids/);
});

test('validateAndDedupeSubmissionIds dedupes and rejects invalid', () => {
    const { validIds, invalidCount } = validateAndDedupeSubmissionIds([
        ID_A,
        ID_A,
        'bad',
        ''
    ]);
    assert.equal(invalidCount, 2);
    assert.deepEqual(validIds, [ID_A]);
});

test('findLastSubmittedHistoryIndex returns last Submitted', () => {
    const history = [
        { status: 'Submitted', isAdminSubmit: true },
        { status: 'Released' },
        { status: 'Submitted', userID: USER_ID }
    ];
    assert.equal(findLastSubmittedHistoryIndex(history), 2);
});

test('buildPatchedHistory only changes last Submitted entry', () => {
    const history = sampleHistory();
    const patched = buildPatchedHistory(history, 2);
    assert.equal(patched[0].isAdminSubmit, undefined);
    assert.equal(patched[1].isAdminSubmit, undefined);
    assert.equal(patched[2].isAdminSubmit, true);
    assert.equal(patched[2].userID, USER_ID);
    assert.equal(patched[2].dateTime.getTime(), history[2].dateTime.getTime());
});

test('historyNeedsAdminSubmitPatch false when already true', () => {
    assert.equal(historyNeedsAdminSubmitPatch(sampleHistory({ lastSubmittedAdmin: true })), false);
});

test('submissionNeedsAdminTypePatch false when Admin', () => {
    assert.equal(submissionNeedsAdminTypePatch(ADMIN_SUBMISSION_TYPE), false);
    assert.equal(submissionNeedsAdminTypePatch(undefined), true);
});

test('planAdminBackfillPatch null when history and submissionType already correct', () => {
    assert.equal(
        planAdminBackfillPatch({
            submissionType: ADMIN_SUBMISSION_TYPE,
            history: sampleHistory({ lastSubmittedAdmin: true })
        }),
        null
    );
});

test('planAdminBackfillPatch type only when history already admin', () => {
    const plan = planAdminBackfillPatch({
        submissionType: 'Standard',
        history: sampleHistory({ lastSubmittedAdmin: true })
    });
    assert.ok(plan);
    assert.equal(plan.historyNeeds, false);
    assert.equal(plan.typeNeeds, true);
});

test('notFound increments when ID missing', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({});
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': true },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.notFound, 1);
});

test('dry-run would patch without updateOne', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            [ID_A]: { _id: ID_A, status: 'Submitted', history: sampleHistory() }
        })();
        const coll = base.db.collection('submissions');
        return {
            client: base.client,
            db: {
                databaseName: base.db.databaseName,
                collection: (n) => {
                    if (n === 'submissions') {
                        return { find: coll.find, updateOne };
                    }
                    throw new Error(n);
                }
            }
        };
    };
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': true },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.dryRunWouldPatchHistory, 1);
    assert.equal(updateOne.mock.callCount(), 0);
});

test('write patches history with isAdminSubmit on last Submitted', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            [ID_A]: { _id: ID_A, status: 'Submitted', history: sampleHistory() }
        })();
        const coll = base.db.collection('submissions');
        return {
            client: base.client,
            db: {
                databaseName: base.db.databaseName,
                collection: (n) => {
                    if (n === 'submissions') {
                        return { find: coll.find, updateOne };
                    }
                    throw new Error(n);
                }
            }
        };
    };
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': false },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.historyPatchOperations, 1);
    assert.equal(updateOne.mock.callCount(), 1);
    const updateArg = updateOne.mock.calls[0]?.arguments[1];
    assert.ok(updateArg?.$set?.history);
    assert.equal(updateArg.$set.submissionType, ADMIN_SUBMISSION_TYPE);
    const last = updateArg.$set.history[2];
    assert.equal(last.isAdminSubmit, true);
    assert.equal(last.userID, USER_ID);
});

test('write sets submissionType only when history already admin', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            [ID_A]: {
                _id: ID_A,
                status: 'Submitted',
                submissionType: 'Standard',
                history: sampleHistory({ lastSubmittedAdmin: true })
            }
        })();
        const coll = base.db.collection('submissions');
        return {
            client: base.client,
            db: {
                databaseName: base.db.databaseName,
                collection: (n) => {
                    if (n === 'submissions') {
                        return { find: coll.find, updateOne };
                    }
                    throw new Error(n);
                }
            }
        };
    };
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': false },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.historyPatchOperations, 1);
    const updateArg = updateOne.mock.calls[0]?.arguments[1];
    assert.equal(updateArg?.$set?.submissionType, ADMIN_SUBMISSION_TYPE);
    assert.equal(updateArg?.$set?.history, undefined);
});

test('no status gate: New submission with Submitted history still patches', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1,
        acknowledged: true
    }));
    const connect = async () => {
        const base = await createMockConnect({
            [ID_A]: { _id: ID_A, status: 'New', history: sampleHistory() }
        })();
        const coll = base.db.collection('submissions');
        return {
            client: base.client,
            db: {
                databaseName: base.db.databaseName,
                collection: (n) => {
                    if (n === 'submissions') {
                        return { find: coll.find, updateOne };
                    }
                    throw new Error(n);
                }
            }
        };
    };
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': false },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.historyPatchOperations, 1);
});

test('skippedNoSubmittedHistory when no Submitted entry', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        [ID_A]: {
            _id: ID_A,
            status: 'New',
            history: [{ status: 'New', userID: USER_ID, dateTime: new Date() }]
        }
    });
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': true },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.skippedNoSubmittedHistory, 1);
});

test('historyAlreadyCorrect when isAdminSubmit and submissionType are correct', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        [ID_A]: {
            _id: ID_A,
            status: 'Submitted',
            submissionType: ADMIN_SUBMISSION_TYPE,
            history: sampleHistory({ lastSubmittedAdmin: true })
        }
    });
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': false, 'dry-run': false },
        { connect, submissionIds: [ID_A] }
    );
    assert.equal(stats.historyAlreadyCorrect, 1);
    assert.equal(stats.historyPatchOperations, 0);
});

test('single-update stops after first would-patch in dry-run', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        [ID_A]: { _id: ID_A, status: 'Submitted', history: sampleHistory() },
        [ID_B]: { _id: ID_B, status: 'Submitted', history: sampleHistory() }
    });
    const stats = await backfillSubmissionTypeAdmin3687(
        { 'single-update': true, 'dry-run': true },
        { connect, submissionIds: [ID_A, ID_B] }
    );
    assert.equal(stats.dryRunWouldPatchHistory, 1);
    assert.equal(stats.singleUpdateStopped, true);
});

test('createStats returns zeroed counters', () => {
    const stats = createStats();
    assert.equal(stats.notFound, 0);
    assert.equal(stats.historyPatchOperations, 0);
});
