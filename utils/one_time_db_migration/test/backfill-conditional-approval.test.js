import assert from 'node:assert';
import { test, afterEach } from 'node:test';

import {
    removePendingClearedNotification,
    backfillConditionalApprovalNotifications,
} from '../scripts/backfill-conditional-approval.js';

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

test('removes pending_cleared notification from all users that have it', async () => {
    restoreConsole = stubConsole();
    const updateCalls = [];
    const { db, calls } = createMockDb((filter, update) => updateCalls.push({ filter, update }));

    const result = await removePendingClearedNotification(db);

    assert.equal(result.success, true);
    assert.deepEqual(calls, ['users']);
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0], {
        filter: { notifications: 'submission_request:pending_cleared' },
        update: { $pull: { notifications: 'submission_request:pending_cleared' } },
    });
});

test('adds conditional approval notifications for active User and Submitter roles', async () => {
    restoreConsole = stubConsole();
    const updateCalls = [];
    const { db, calls } = createMockDb((filter, update) => updateCalls.push({ filter, update }));

    const expectedNotifications = {
        $each: [
            'submission_request:conditionally_approved',
            'submission_request:pending_dbgapid',
            'submission_request:pending_model_update',
            'submission_request:pending_image_deidentification',
        ],
    };

    const result = await backfillConditionalApprovalNotifications(db);

    assert.equal(result.success, true);
    assert.deepEqual(calls, ['users']);
    assert.equal(updateCalls.length, 2);
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'Submitter' &&
        filter.userStatus === 'Active' &&
        JSON.stringify(update.$addToSet.notifications) === JSON.stringify(expectedNotifications)
    ));
    assert.ok(updateCalls.some(({ filter, update }) =>
        filter.role === 'User' &&
        filter.userStatus === 'Active' &&
        JSON.stringify(update.$addToSet.notifications) === JSON.stringify(expectedNotifications)
    ));
});
