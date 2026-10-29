/**
 * Migration: Backfill Submission metadataDataSyncStatus and fileDataSyncStatus
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.1 migration orchestrator
 */

const { SUBMISSIONS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');
const {
    DATA_SYNC_STATUS,
    missingDataSyncRollupMongoFilter,
} = require('../../constants/data-sync-constants');

const NOT_STARTED = DATA_SYNC_STATUS.NOT_STARTED;

const METADATA_FIELD = 'metadataDataSyncStatus';
const FILE_FIELD = 'fileDataSyncStatus';

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{
 *   success: boolean,
 *   message?: string,
 *   matchedCount?: number,
 *   modifiedCount?: number,
 *   metadataMatchedCount?: number,
 *   metadataModifiedCount?: number,
 *   fileMatchedCount?: number,
 *   fileModifiedCount?: number,
 *   error?: string
 * }>}
 */
async function backfillSubmissionDataSyncStatus(db) {
    console.log('🔄 Backfilling Submission DataSync status fields where missing...');

    const collection = db.collection(SUBMISSIONS_COLLECTION);

    const metadataFilter = missingDataSyncRollupMongoFilter(METADATA_FIELD);
    const fileFilter = missingDataSyncRollupMongoFilter(FILE_FIELD);

    try {
        const submissionsMatched = await collection.countDocuments({
            $or: [...metadataFilter.$or, ...fileFilter.$or],
        });

        const metadataResult = await collection.updateMany(metadataFilter, {
            $set: { [METADATA_FIELD]: NOT_STARTED },
        });

        const fileResult = await collection.updateMany(fileFilter, {
            $set: { [FILE_FIELD]: NOT_STARTED },
        });

        const metadataMatchedCount = metadataResult.matchedCount;
        const metadataModifiedCount = metadataResult.modifiedCount;
        const fileMatchedCount = fileResult.matchedCount;
        const fileModifiedCount = fileResult.modifiedCount;

        console.log(
            `   ✅ ${submissionsMatched} submission(s) needed backfill; ` +
                `metadata matched ${metadataMatchedCount}, modified ${metadataModifiedCount}; ` +
                `file matched ${fileMatchedCount}, modified ${fileModifiedCount}`
        );

        return {
            success: true,
            message:
                `Backfilled DataSync rollup fields on ${submissionsMatched} submission(s) ` +
                `(metadata: ${metadataModifiedCount} modified; file: ${fileModifiedCount} modified)`,
            matchedCount: submissionsMatched,
            modifiedCount: submissionsMatched,
            metadataMatchedCount,
            metadataModifiedCount,
            fileMatchedCount,
            fileModifiedCount,
        };
    } catch (error) {
        console.error('   ❌ Error backfilling Submission DataSync status fields:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{
 *   success: boolean,
 *   message?: string,
 *   matchedCount?: number,
 *   modifiedCount?: number,
 *   metadataMatchedCount?: number,
 *   metadataModifiedCount?: number,
 *   fileMatchedCount?: number,
 *   fileModifiedCount?: number,
 *   error?: string
 * }>}
 */
async function executeBackfillSubmissionDataSyncStatus(db) {
    console.log('🔄 Executing Submission DataSync status backfill...');

    try {
        const result = await backfillSubmissionDataSyncStatus(db);

        if (result.success) {
            console.log('✅ Submission DataSync status backfill completed successfully');
        } else {
            console.log('❌ Submission DataSync status backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing Submission DataSync status backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillSubmissionDataSyncStatus,
    executeBackfillSubmissionDataSyncStatus,
};
