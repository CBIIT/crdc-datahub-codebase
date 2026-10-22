/**
 * 3.7.0 migration step: sync PBAC defaults from JSON (recurring).
 *
 * Delegates to documentation/recurring-steps/sync-pbac-defaults.js.
 *
 * Usage: Called by the 3.7.0 migration orchestrator
 */

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function executeSyncPbacDefaults(db) {
    console.log('🔄 Executing PBAC defaults sync (recurring)...');

    try {
        const { syncPbacDefaults } = require('../recurring-steps/sync-pbac-defaults');
        const result = await syncPbacDefaults(db);

        if (result.success) {
            console.log('✅ PBAC defaults sync completed successfully');
        } else {
            console.log('❌ PBAC defaults sync failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing PBAC defaults sync:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    executeSyncPbacDefaults
};
