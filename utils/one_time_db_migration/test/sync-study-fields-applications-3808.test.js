import assert from 'node:assert';
import { test, afterEach, mock } from 'node:test';

import {
    createStats,
    deriveStudyTargets,
    formatStudyFieldsChangeDetails,
    getUnexpectedStudyFieldTypeReason,
    isValidStudyFieldValue,
    normalizeStudyField,
    parseQuestionnaireData,
    planStudyFieldsSync,
    syncStudyFieldsApplications
} from '../scripts/sync-study-fields-applications-3808.js';

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
 *   applicationDocs?: Record<string, unknown>[],
 *   onCount?: () => void,
 *   updateOne?: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<{
 *     matchedCount: number,
 *     modifiedCount: number
 *   }>
 * }} [config]
 */
function createMockConnect({ applicationDocs = [], onCount, updateOne } = {}) {
    const defaultUpdateOne = async () => ({
        matchedCount: 1,
        modifiedCount: 1
    });
    const updateOneFn = updateOne ?? defaultUpdateOne;

    return async () => {
        const client = {
            close: async () => {}
        };
        const db = {
            databaseName: 'crdc-datahub',
            /**
             * @param {string} name
             */
            collection(name) {
                if (name === 'applications') {
                    return {
                        countDocuments: async () => {
                            if (onCount) {
                                onCount();
                            }
                            return applicationDocs.length;
                        },
                        find: () => asyncIterableFrom(applicationDocs),
                        updateOne: updateOneFn
                    };
                }
                throw new Error(`Unexpected collection: ${name}`);
            }
        };
        return { client, db };
    };
}

test('normalizeStudyField: null and undefined become empty string', () => {
    assert.equal(normalizeStudyField(null), '');
    assert.equal(normalizeStudyField(undefined), '');
    assert.equal(normalizeStudyField('ABC'), 'ABC');
});

test('isValidStudyFieldValue: accepts null, undefined, and strings', () => {
    assert.equal(isValidStudyFieldValue(null), true);
    assert.equal(isValidStudyFieldValue(undefined), true);
    assert.equal(isValidStudyFieldValue(''), true);
    assert.equal(isValidStudyFieldValue('ABC'), true);
    assert.equal(isValidStudyFieldValue(123), false);
    assert.equal(isValidStudyFieldValue(true), false);
});

test('getUnexpectedStudyFieldTypeReason: identifies invalid root field types', () => {
    assert.equal(getUnexpectedStudyFieldTypeReason({ studyAbbreviation: 'A', studyName: 'B' }), null);
    assert.equal(
        getUnexpectedStudyFieldTypeReason({ studyAbbreviation: 123, studyName: 'B' }),
        'unexpected type for studyAbbreviation'
    );
    assert.equal(
        getUnexpectedStudyFieldTypeReason({ studyAbbreviation: 'A', studyName: false }),
        'unexpected type for studyName'
    );
});

test('parseQuestionnaireData: valid JSON object', () => {
    const result = parseQuestionnaireData('{"study":{"name":"Test","abbreviation":"TST"}}');
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.deepEqual(result.parsedData.study, { name: 'Test', abbreviation: 'TST' });
    }
});

test('parseQuestionnaireData: accepts native object', () => {
    const questionnaireData = { study: { name: 'Test', abbreviation: 'TST' } };
    const result = parseQuestionnaireData(questionnaireData);
    assert.equal(result.ok, true);
    if (result.ok) {
        assert.deepEqual(result.parsedData, questionnaireData);
    }
});

test('parseQuestionnaireData: rejects missing, empty, and invalid JSON', () => {
    assert.equal(parseQuestionnaireData(null).ok, false);
    assert.equal(parseQuestionnaireData('').ok, false);
    assert.equal(parseQuestionnaireData('not json').ok, false);
    assert.equal(parseQuestionnaireData('[]').ok, false);
    assert.equal(parseQuestionnaireData([1, 2, 3]).ok, false);
});

test('deriveStudyTargets: null study subfields become empty strings', () => {
    assert.deepEqual(deriveStudyTargets({ study: { name: null, abbreviation: null } }), {
        studyAbbreviation: '',
        studyName: ''
    });
    assert.deepEqual(deriveStudyTargets({}), {
        studyAbbreviation: '',
        studyName: ''
    });
    assert.deepEqual(deriveStudyTargets({ study: null }), {
        studyAbbreviation: '',
        studyName: ''
    });
});

test('planStudyFieldsSync: returns null when already in sync', () => {
    const questionnaireData = JSON.stringify({
        study: { name: 'My Study', abbreviation: 'MYS' }
    });
    const parsed = parseQuestionnaireData(questionnaireData);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
        return;
    }

    assert.equal(
        planStudyFieldsSync(
            { studyAbbreviation: 'MYS', studyName: 'My Study', questionnaireData },
            parsed.parsedData
        ),
        null
    );

    const emptyParsed = { study: { name: null, abbreviation: null } };
    assert.equal(
        planStudyFieldsSync(
            { studyAbbreviation: null, studyName: undefined },
            emptyParsed
        ),
        null
    );
});

test('planStudyFieldsSync: returns patch when one or both fields differ', () => {
    const parsedData = { study: { name: 'New Name', abbreviation: 'NEW' } };

    const both = planStudyFieldsSync(
        { studyAbbreviation: 'OLD', studyName: 'Old Name' },
        parsedData
    );
    assert.ok(both);
    assert.equal(both.studyAbbreviation, 'NEW');
    assert.equal(both.studyName, 'New Name');
    assert.deepEqual(both.changes.studyAbbreviation, { from: 'OLD', to: 'NEW' });
    assert.deepEqual(both.changes.studyName, { from: 'Old Name', to: 'New Name' });

    const abbreviationOnly = planStudyFieldsSync(
        { studyAbbreviation: 'OLD', studyName: 'New Name' },
        parsedData
    );
    assert.ok(abbreviationOnly);
    assert.deepEqual(abbreviationOnly.changes.studyAbbreviation, { from: 'OLD', to: 'NEW' });
    assert.equal(abbreviationOnly.changes.studyName, undefined);
});

test('formatStudyFieldsChangeDetails: formats changed fields', () => {
    const details = formatStudyFieldsChangeDetails({
        studyAbbreviation: { from: 'A', to: 'B' },
        studyName: { from: 'Old', to: 'New' }
    });
    assert.equal(
        details,
        'studyAbbreviation "A" -> "B", studyName "Old" -> "New"'
    );
});

test('dry-run: would update, no updateOne on db', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old Name',
                questionnaireData: JSON.stringify({
                    study: { name: 'New Name', abbreviation: 'NEW' }
                })
            }
        ],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.applicationsConsidered, 1);
    assert.equal(stats.dryRunWouldUpdate, 1);
    assert.equal(stats.updatedDocuments, 0);
    assert.equal(updateOne.mock.callCount(), 0);
});

test('dry-run: skip invalid questionnaireData', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0
    }));
    const connect = createMockConnect({
        applicationDocs: [{ _id: 'app-1', studyAbbreviation: 'A', studyName: 'B', questionnaireData: null }],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.skippedInvalidQuestionnaireData, 1);
    assert.equal(stats.dryRunWouldUpdate, 0);
    assert.equal(updateOne.mock.callCount(), 0);
});

test('dry-run: already in sync is not counted as updated', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'MYS',
                studyName: 'My Study',
                questionnaireData: JSON.stringify({
                    study: { name: 'My Study', abbreviation: 'MYS' }
                })
            }
        ]
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.alreadyInSync, 1);
    assert.equal(stats.dryRunWouldUpdate, 0);
});

test('write: updateOne sets study fields from questionnaireData', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old Name',
                questionnaireData: JSON.stringify({
                    study: { name: 'New Name', abbreviation: 'NEW' }
                })
            }
        ],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': false },
        { connect }
    );

    assert.equal(updateOne.mock.callCount(), 1);
    const call = updateOne.mock.calls[0];
    const updateArg = call?.arguments[1];
    assert.ok(updateArg);
    assert.deepEqual(updateArg.$set, {
        studyAbbreviation: 'NEW',
        studyName: 'New Name'
    });
    assert.equal(stats.updatedDocuments, 1);
    assert.equal(stats.updateOperations, 1);
});

test('write: null study fields in questionnaireData set root fields to empty string', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 1
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old Name',
                questionnaireData: JSON.stringify({
                    study: { name: null, abbreviation: null }
                })
            }
        ],
        updateOne
    });

    await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': false },
        { connect }
    );

    const updateArg = updateOne.mock.calls[0]?.arguments[1];
    assert.deepEqual(updateArg?.$set, {
        studyAbbreviation: '',
        studyName: ''
    });
});

test('single-update dry-run: stops after first would-update', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'A',
                studyName: 'One',
                questionnaireData: JSON.stringify({ study: { name: 'Two', abbreviation: 'B' } })
            },
            {
                _id: 'app-2',
                studyAbbreviation: 'C',
                studyName: 'Three',
                questionnaireData: JSON.stringify({ study: { name: 'Four', abbreviation: 'D' } })
            }
        ]
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': true, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.dryRunWouldUpdate, 1);
    assert.equal(stats.singleUpdateStopped, true);
});

test('dry-run: skip unexpected root field type', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 123,
                studyName: 'B',
                questionnaireData: JSON.stringify({
                    study: { name: 'B', abbreviation: 'A' }
                })
            }
        ],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.skippedUnexpectedFieldType, 1);
    assert.equal(stats.dryRunWouldUpdate, 0);
    assert.equal(updateOne.mock.callCount(), 0);
});

test('dry-run: questionnaireData as object', async () => {
    restoreConsole = stubConsole();
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old Name',
                questionnaireData: {
                    study: { name: 'New Name', abbreviation: 'NEW' }
                }
            }
        ]
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': true },
        { connect }
    );

    assert.equal(stats.dryRunWouldUpdate, 1);
    assert.equal(stats.skippedInvalidQuestionnaireData, 0);
});

test('write: matched but not modified increments matchedButNotModified', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 1,
        modifiedCount: 0
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old',
                questionnaireData: JSON.stringify({ study: { name: 'New', abbreviation: 'NEW' } })
            }
        ],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': false },
        { connect }
    );

    assert.equal(stats.matchedButNotModified, 1);
    assert.equal(stats.updatedDocuments, 0);
    assert.equal(stats.unmatchedWriteAttempts, 0);
    assert.equal(updateOne.mock.callCount(), 1);
});

test('write: matchedCount 0 increments unmatchedWriteAttempts', async () => {
    restoreConsole = stubConsole();
    const updateOne = mock.fn(async () => ({
        matchedCount: 0,
        modifiedCount: 0
    }));
    const connect = createMockConnect({
        applicationDocs: [
            {
                _id: 'app-1',
                studyAbbreviation: 'OLD',
                studyName: 'Old',
                questionnaireData: JSON.stringify({ study: { name: 'New', abbreviation: 'NEW' } })
            }
        ],
        updateOne
    });

    const stats = await syncStudyFieldsApplications(
        { 'single-update': false, 'dry-run': false },
        { connect }
    );

    assert.equal(stats.unmatchedWriteAttempts, 1);
    assert.equal(stats.updatedDocuments, 0);
});

test('createStats: returns zeroed counters', () => {
    const stats = createStats();
    assert.equal(stats.applicationsConsidered, 0);
    assert.equal(stats.dryRunWouldUpdate, 0);
    assert.equal(stats.updatedDocuments, 0);
});
