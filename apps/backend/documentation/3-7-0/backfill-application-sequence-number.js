/**
 * Migration: Backfill Application.sequenceNumber to 1 where missing
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

const APPLICATIONS_COLLECTION = 'applications';

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
async function backfillApplicationSequenceNumber(db) {
    console.log('🔄 Backfilling Application.sequenceNumber where missing...');

    const collection = db.collection(APPLICATIONS_COLLECTION);

    try {
        const result = await collection.updateMany(
            {
                $or: [
                    { sequenceNumber: { $exists: false } },
                    { sequenceNumber: null }
                ]
            },
            { $set: { sequenceNumber: 1 } }
        );

        console.log(`   ✅ Matched ${result.matchedCount}, modified ${result.modifiedCount}`);
        return {
            success: true,
            message: `Set sequenceNumber to 1 on ${result.modifiedCount} document(s)`,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        };
    } catch (error) {
        console.error('   ❌ Error backfilling Application.sequenceNumber:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
async function executeBackfillApplicationSequenceNumber(db) {
    console.log('🔄 Executing Application.sequenceNumber backfill...');

    try {
        const result = await backfillApplicationSequenceNumber(db);

        if (result.success) {
            console.log('✅ Application.sequenceNumber backfill completed successfully');
        } else {
            console.log('❌ Application.sequenceNumber backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing Application.sequenceNumber backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillApplicationSequenceNumber,
    executeBackfillApplicationSequenceNumber
};
