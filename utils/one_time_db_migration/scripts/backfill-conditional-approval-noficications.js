/**
 * One-time migration: remove submission_request:pending_cleared notification from all
 * users and backfill conditional-approval notifications on existing active User/Submitter users.
 *
 * Idempotent via $pull / $addToSet. Run once after sync-pbac-defaults (manual or first deploy).
 * Not intended for recurring startup sync — admins may remove notifications per user afterward.
 *
 * Usage: npm run backfill-conditional-approval -- [--output <path>]
 *         (from utils/one_time_db_migration)
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

const PENDING_CLEARED_NOTIFICATION = 'submission_request:pending_cleared';

/** Notifications aligned with PBACDefaults_config.json (checked: true for User/Submitter) */
const CONDITIONAL_APPROVAL_NOTIFICATIONS = [
    'submission_request:conditionally_approved',
    'submission_request:pending_dbgapid',
    'submission_request:pending_model_update',
    'submission_request:pending_image_deidentification',
];

const CONDITIONAL_APPROVAL_ROLES = [USER.ROLES.USER, USER.ROLES.SUBMITTER];

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
export async function removePendingClearedNotification(db) {
    console.log('🔄 Removing submission_request:pending_cleared notification from all users...');

    const usersCollection = db.collection(USERS_COLLECTION);

    try {
        const result = await usersCollection.updateMany(
            { notifications: PENDING_CLEARED_NOTIFICATION },
            { $pull: { notifications: PENDING_CLEARED_NOTIFICATION } }
        );

        console.log(`   ✅ Pending cleared removal: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
        return {
            success: true,
            message: `Removed pending_cleared notification from ${result.modifiedCount} user(s)`,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (error) {
        console.error('   ❌ Error removing pending_cleared notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
export async function backfillConditionalApprovalNotifications(db) {
    console.log('🔄 Backfilling conditional-approval notifications on existing User/Submitter users...');

    const usersCollection = db.collection(USERS_COLLECTION);

    try {
        let matchedCount = 0;
        let modifiedCount = 0;

        for (const role of CONDITIONAL_APPROVAL_ROLES) {
            const result = await usersCollection.updateMany(
                {
                    role,
                },
                { $addToSet: { notifications: { $each: CONDITIONAL_APPROVAL_NOTIFICATIONS } } }
            );
            matchedCount += result.matchedCount;
            modifiedCount += result.modifiedCount;
        }

        console.log(`   ✅ Conditional approval notification backfill: matched ${matchedCount}, modified ${modifiedCount}`);
        return {
            success: true,
            message: `Added conditional approval notifications to ${modifiedCount} user(s)`,
            matchedCount,
            modifiedCount,
        };
    } catch (error) {
        console.error('   ❌ Error backfilling conditional approval notifications:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Runs pending_cleared removal and conditional-approval notification backfill.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, removePendingCleared?: object, backfillNotifications?: object, error?: string}>}
 */
export async function executeBackfillConditionalApproval(db) {
    console.log('🔄 Executing conditional approval notification backfill...');

    try {
        const removeResult = await removePendingClearedNotification(db);
        const backfillResult = await backfillConditionalApprovalNotifications(db);

        const success = removeResult.success && backfillResult.success;

        if (success) {
            console.log('✅ Conditional approval notification backfill completed successfully');
        } else {
            console.log('❌ Conditional approval notification backfill failed');
        }

        return {
            success,
            removePendingCleared: removeResult,
            backfillNotifications: backfillResult,
        };
    } catch (error) {
        console.error('❌ Error executing conditional approval notification backfill:', error.message);
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
        await executeBackfillConditionalApproval(db);
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
