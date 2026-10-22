/**
 * 3.7.0 migration step: ensure DocumentDB indexes from the recurring catalog.
 *
 * Delegates to documentation/recurring-steps/ensure-indexes.js.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, created?: number, skipped?: number, error?: string}>}
 */
async function executeEnsureIndexes(db) {
    console.log('🔄 Executing ensure indexes (recurring)...');

    try {
        const { ensureIndexes } = require('../recurring-steps/ensure-indexes');
        const result = await ensureIndexes(db);

        if (result.success) {
            console.log('✅ Ensure indexes completed successfully');
        } else {
            console.log('❌ Ensure indexes failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing ensure indexes:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    executeEnsureIndexes
};
