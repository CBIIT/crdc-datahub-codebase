/**
 * Migration: Update SCHEDULED_JOBS inactive application configuration defaults
 *
 * - INACTIVE_APPLICATION_DAYS → 60 when not already 60
 * - INACTIVE_APPLICATION_NOTIFY_DAYS → [15, 30] when present and not already [15, 30]
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

const options = {
    output: {
        type: 'string'
    }
};

const CONFIGURATION_COLLECTION = 'configuration';
const CONFIG_TYPE = 'SCHEDULED_JOBS';
const CONFIG_ID = '8e2d00f4-2ac6-4a0d-a453-733cc218b04f';
const INACTIVE_APPLICATION_DAYS = 'INACTIVE_APPLICATION_DAYS';
const INACTIVE_APPLICATION_NOTIFY_DAYS = 'INACTIVE_APPLICATION_NOTIFY_DAYS';
const TARGET_INACTIVE_APPLICATION_DAYS = 60;
const TARGET_INACTIVE_APPLICATION_NOTIFY_DAYS = [15, 30];

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function arraysEqual(a, b) {
    return Array.isArray(a) && Array.isArray(b)
        && a.length === b.length
        && a.every((val, idx) => val === b[idx]);
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, modifiedCount?: number, updates?: string[], error?: string}>}
 */
async function updateInactiveApplicationConfig(db) {
    console.log('🔄 Updating SCHEDULED_JOBS inactive application configuration...');

    const configCollection = db.collection(CONFIGURATION_COLLECTION);

    try {
        await configCollection.updateOne(
            { type: CONFIG_TYPE },
            { $setOnInsert: { _id: CONFIG_ID, type: CONFIG_TYPE } },
            { upsert: true }
        );

        const scheduledJobs = await configCollection.findOne({ type: CONFIG_TYPE });
        const updates = {};

        if (scheduledJobs?.[INACTIVE_APPLICATION_DAYS] !== TARGET_INACTIVE_APPLICATION_DAYS) {
            updates[INACTIVE_APPLICATION_DAYS] = TARGET_INACTIVE_APPLICATION_DAYS;
        }

        const currentNotifyDays = scheduledJobs?.[INACTIVE_APPLICATION_NOTIFY_DAYS];
        if (currentNotifyDays !== undefined && currentNotifyDays !== null) {
            if (!arraysEqual(currentNotifyDays, TARGET_INACTIVE_APPLICATION_NOTIFY_DAYS)) {
                updates[INACTIVE_APPLICATION_NOTIFY_DAYS] = TARGET_INACTIVE_APPLICATION_NOTIFY_DAYS;
            }
        }

        if (Object.keys(updates).length === 0) {
            console.log('   ✅ Inactive application configuration already up to date');
            return {
                success: true,
                message: 'Inactive application configuration already up to date',
                modifiedCount: 0,
                updates: []
            };
        }

        const result = await configCollection.updateOne(
            { type: CONFIG_TYPE },
            { $set: updates }
        );

        const updatedKeys = Object.keys(updates);
        console.log(`   ✅ Updated ${updatedKeys.join(', ')} on ${CONFIG_TYPE} configuration`);
        return {
            success: true,
            message: `Updated ${updatedKeys.join(', ')} on ${CONFIG_TYPE} configuration`,
            modifiedCount: result.modifiedCount ?? 0,
            updates: updatedKeys
        };
    } catch (error) {
        console.error('   ❌ Error updating inactive application configuration:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, modifiedCount?: number, updates?: string[], error?: string}>}
 */
async function executeUpdateInactiveApplicationConfig(db) {
    console.log('🔄 Executing inactive application configuration update...');

    try {
        const result = await updateInactiveApplicationConfig(db);

        if (result.success) {
            console.log('✅ Inactive application configuration update completed successfully');
        } else {
            console.log('❌ Inactive application configuration update failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing inactive application configuration update:', error.message);
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
        await executeUpdateInactiveApplicationConfig(db);
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
