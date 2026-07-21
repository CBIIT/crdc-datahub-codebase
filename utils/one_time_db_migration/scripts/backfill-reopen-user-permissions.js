/**
 * 3.7.0 one-time migration: backfill submission_request:reopen:* permissions and
 * submission_request:reopened notification on existing active users.
 *
 * Idempotent via $addToSet. Run once after sync-pbac-defaults (manual or first deploy).
 * Not intended for recurring startup sync — admins may remove permissions/notifications per user afterward.
 *
 * Usage: Called by the 3.7.0 migration orchestrator, or run via npm run migrate:3.7.0
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';
import UserConstants from '../../../lib/db-driver/constants/user-constants.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

const { USER } = UserConstants;

const options = {
    output: {
        type: 'string'
    }
};

const USERS_COLLECTION = 'users';

/** Role → reopen permission aligned with PBACDefaults_config.json */
const REOPEN_PERMISSIONS_BY_ROLE = [
    { role: USER.ROLES.ADMIN, permission: 'submission_request:reopen:all' },
    { role: USER.ROLES.SUBMITTER, permission: 'submission_request:reopen:own' },
    { role: USER.ROLES.USER, permission: 'submission_request:reopen:own' },
];

/** Role → reopen notification aligned with PBACDefaults_config.json (checked: true) */
const REOPEN_NOTIFICATIONS_BY_ROLE = [
    { role: USER.ROLES.ADMIN, notification: 'submission_request:reopened' },
    { role: USER.ROLES.SUBMITTER, notification: 'submission_request:reopened' },
    { role: USER.ROLES.USER, notification: 'submission_request:reopened' },
];

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
export async function backfillReopenUserPermissions(db) {
    console.log('🔄 Backfilling submission_request:reopen:* permissions on existing users...');

    const usersCollection = db.collection(USERS_COLLECTION);

    try {
        let matchedCount = 0;
        let modifiedCount = 0;

        for (const { role, permission } of REOPEN_PERMISSIONS_BY_ROLE) {
            const result = await usersCollection.updateMany(
                {
                    role,
                    userStatus: USER.STATUSES.ACTIVE,
                    permissions: { $ne: permission },
                },
                { $addToSet: { permissions: permission } }
            );
            matchedCount += result.matchedCount;
            modifiedCount += result.modifiedCount;
        }

        console.log(`   ✅ Reopen permission backfill: matched ${matchedCount}, modified ${modifiedCount}`);
        return {
            success: true,
            message: `Added reopen permissions to ${modifiedCount} user(s)`,
            matchedCount,
            modifiedCount,
        };
    } catch (error) {
        console.error('   ❌ Error backfilling reopen user permissions:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
export async function backfillReopenUserNotification(db) {
    console.log('🔄 Backfilling submission_request:reopened notification on existing users...');

    const usersCollection = db.collection(USERS_COLLECTION);

    try {
        let matchedCount = 0;
        let modifiedCount = 0;

        for (const { role, notification } of REOPEN_NOTIFICATIONS_BY_ROLE) {
            const result = await usersCollection.updateMany(
                {
                    role,
                    userStatus: USER.STATUSES.ACTIVE,
                    notifications: { $ne: notification },
                },
                { $addToSet: { notifications: notification } }
            );
            matchedCount += result.matchedCount;
            modifiedCount += result.modifiedCount;
        }

        console.log(`   ✅ Reopen notification backfill: matched ${matchedCount}, modified ${modifiedCount}`);
        return {
            success: true,
            message: `Added reopen notification to ${modifiedCount} user(s)`,
            matchedCount,
            modifiedCount,
        };
    } catch (error) {
        console.error('   ❌ Error backfilling reopen user notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 */
export async function executeBackfillReopenUserPermissions(db) {
    console.log('🔄 Executing reopen user permission and notification backfill...');

    try {
        const permissionResult = await backfillReopenUserPermissions(db);
        const notificationResult = await backfillReopenUserNotification(db);

        const success = permissionResult.success && notificationResult.success;

        if (success) {
            console.log('✅ Reopen user permission and notification backfill completed successfully');
        } else {
            console.log('❌ Reopen user permission and notification backfill failed');
        }

        return {
            success,
            permissions: permissionResult,
            notifications: notificationResult,
        };
    } catch (error) {
        console.error('❌ Error executing reopen user permission and notification backfill:', error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    const { values } = parseArgs({ options, allowPositionals: true });
    const outputArg = values['output'];

    let logPath;
    let endConsoleFileMirror = null;
    if (outputArg) {
        const out = await openDatedConsoleFileMirror(outputArg);
        endConsoleFileMirror = out.endConsoleFileMirror;
        logPath = out.logPath;
    }
    if (logPath) {
        console.log(`Log file: ${logPath}`);
    }

    const { client, db } = await connectDatabaseFromEnv();
    try {
        await executeBackfillReopenUserPermissions(db);
    } finally {
        await client.close();
        if (endConsoleFileMirror) {
            await endConsoleFileMirror();
        }
    }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);
if (isMainModule) {
    main().catch((err) => {
        console.error('Fatal:', err);
        process.exit(1);
    });
}