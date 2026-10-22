/**
 * Migration: Backfill ApprovedStudy.pendingConditionsAtApproval where missing
 *
 * Reads approved studies without pendingConditionsAtApproval, computes the value
 * via getPendingConditionsAtApproval, and persists it on the document.
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

const APPROVED_STUDIES_COLLECTION = 'approvedStudies';
const { getPendingConditionsAtApproval } = require('../../utility/pending-conditions-at-approval');

const MISSING_PENDING_CONDITIONS_FILTER = {
    $or: [
        { pendingConditionsAtApproval: { $exists: false } },
        { pendingConditionsAtApproval: null }
    ]
};

const PENDING_CONDITIONS_PROJECTION = {
    controlledAccess: 1,
    dbGaPID: 1,
    pendingModelChange: 1,
    pendingImageDeIdentification: 1
};

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
async function backfillGetPendingConditionsAtApproval(db) {
    console.log('🔄 Backfilling ApprovedStudy.pendingConditionsAtApproval where missing...');

    const collection = db.collection(APPROVED_STUDIES_COLLECTION);

    try {
        const studies = await collection
            .find(MISSING_PENDING_CONDITIONS_FILTER, { projection: PENDING_CONDITIONS_PROJECTION })
            .toArray();

        if (studies.length === 0) {
            console.log('   ✅ No approved studies require backfill');
            return {
                success: true,
                message: 'No approved studies required backfill',
                matchedCount: 0,
                modifiedCount: 0
            };
        }

        const operations = studies.map((study) => ({
            updateOne: {
                filter: {
                    _id: study._id,
                    ...MISSING_PENDING_CONDITIONS_FILTER
                },
                update: {
                    $set: {
                        pendingConditionsAtApproval: getPendingConditionsAtApproval(study)
                    }
                }
            }
        }));

        const result = await collection.bulkWrite(operations, { ordered: false });
        const matchedCount = result.matchedCount ?? 0;
        const modifiedCount = result.modifiedCount ?? 0;

        console.log(`   ✅ Matched ${matchedCount}, modified ${modifiedCount}`);
        return {
            success: true,
            message: `Set pendingConditionsAtApproval on ${modifiedCount} approved study document(s)`,
            matchedCount,
            modifiedCount
        };
    } catch (error) {
        console.error('   ❌ Error backfilling ApprovedStudy.pendingConditionsAtApproval:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
async function executeBackfillGetPendingConditionsAtApproval(db) {
    console.log('🔄 Executing ApprovedStudy.pendingConditionsAtApproval backfill...');

    try {
        const result = await backfillGetPendingConditionsAtApproval(db);

        if (result.success) {
            console.log('✅ ApprovedStudy.pendingConditionsAtApproval backfill completed successfully');
        } else {
            console.log('❌ ApprovedStudy.pendingConditionsAtApproval backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing ApprovedStudy.pendingConditionsAtApproval backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillGetPendingConditionsAtApproval,
    executeBackfillGetPendingConditionsAtApproval
};
