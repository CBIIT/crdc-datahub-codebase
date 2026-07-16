import assert from 'node:assert';
import { test, afterEach } from 'node:test';

import {
    backfillReopenUserPermissions,
    backfillReopenUserNotification,
} from '../scripts/backfill-reopen-user-permissions.js';

let restoreConsole = null;

afterEach(() => {
    if (restoreConsole) {
        restoreConsole();
        restoreConsole = null;
    }
});

function stubConsole() {
    const originals = {
        log: console.log,
        error: console.error
    };
    for (const k of Object.keys(originals)) {
        console[k] = () => {};
    }
    return () => {
        Object.assign(console, originals);
    };
}

/**
 * @param {(filter: Record<string, unknown>, update: Record<string, unknown>) => void} onUpdateMany
 */
function createMockDb(onUpdateMany) {
    const usersCollection = {
        updateMany: async (filter, update) => {
            onUpdateMany?.(filter, update);
            return { matchedCount: 1, modifiedCount: 1 };
        }
    };
    const calls = [];
    const db = {
        collection: (name) => {
            calls.push(name);
            return usersCollection;
        }
    };
    return { db, calls };
}

test('adds reopen permissions per role on active users', async () => {
    restoreConsole = stubConsole();
    const updateCalls = [];
    const { db, calls } = createMockDb((filter, update) => updateCalls.push({ filter, update }));

    const result = await backfillReopenUserPermissions(db);

    assert.equal(result.success, true);
    assert.deepEqual(calls, ['users']);
    assert.equal(updateCalls.length, 3);
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'Submitter' &&
        filter.userStatus === 'Active' &&
        filter.permissions.$ne === 'submission_request:reopen:own' &&
        update.$addToSet.permissions === 'submission_request:reopen:own'
    ));
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'Admin' &&
        filter.userStatus === 'Active' &&
        filter.permissions.$ne === 'submission_request:reopen:all' &&
        update.$addToSet.permissions === 'submission_request:reopen:all'
    ));
});

test('adds reopen notification per role on active users', async () => {
    restoreConsole = stubConsole();
    const updateCalls = [];
    const { db, calls } = createMockDb((filter, update) => updateCalls.push({ filter, update }));

    const result = await backfillReopenUserNotification(db);

    assert.equal(result.success, true);
    assert.deepEqual(calls, ['users']);
    assert.equal(updateCalls.length, 3);
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'Submitter' &&
        filter.userStatus === 'Active' &&
        filter.notifications.$ne === 'submission_request:reopened' &&
        update.$addToSet.notifications === 'submission_request:reopened'
    ));
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'Admin' &&
        filter.userStatus === 'Active' &&
        filter.notifications.$ne === 'submission_request:reopened' &&
        update.$addToSet.notifications === 'submission_request:reopened'
    ));
});
