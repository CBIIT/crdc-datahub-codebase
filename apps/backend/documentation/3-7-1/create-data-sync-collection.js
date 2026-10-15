/**
 * Migration: Create dataSync collection
 *
 * Creates the dataSync MongoDB collection if it does not exist.
 * Idempotent: safe to re-run (MongoDB error code 48 = namespace exists).
 *
 * Usage: Called by the 3.7.1 migration orchestrator
 */

const { DATA_SYNC_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * @param {import('mongodb').Db} db - MongoDB database connection
 * @returns {Promise<{success: boolean, created?: boolean, skipped?: boolean, error?: string}>}
 */
async function createDataSyncCollection(db) {
    console.log('🔄 Creating dataSync collection...');

    try {
        await db.createCollection(DATA_SYNC_COLLECTION);
        console.log('   ✅ dataSync collection created');
        return { success: true, created: true };
    } catch (error) {
        if (error.code === 48) {
            console.log('   ℹ️  dataSync collection already exists');
            return { success: true, skipped: true };
        }
        console.error('   ❌ Error creating dataSync collection:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createDataSyncCollection
};
