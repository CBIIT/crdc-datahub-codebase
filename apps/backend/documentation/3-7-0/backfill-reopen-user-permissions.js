/**
 * 3.7.0 one-time migration: backfill submission_request:reopen:* on existing active users.
 *
 * Idempotent via $addToSet. Run once after sync-pbac-defaults (manual or first deploy).
 * Not intended for recurring startup sync — admins may remove permissions per user afterward.
 *
 * Usage: Called by the 3.7.0 migration orchestrator, or run via npm run migrate:3.7.0
 */

const { USER } = require('../../crdc-datahub-database-drivers/constants/user-constants');

const USERS_COLLECTION = 'users';

/** Role → reopen permission aligned with PBACDefaults_config.json */
const REOPEN_PERMISSIONS_BY_ROLE = [
    { role: USER.ROLES.ADMIN, permission: 'submission_request:reopen:all' },
    { role: USER.ROLES.FEDERAL_LEAD, permission: 'submission_request:reopen:all' },
    { role: USER.ROLES.DATA_COMMONS_PERSONNEL, permission: 'submission_request:reopen:all' },
    { role: USER.ROLES.SUBMITTER, permission: 'submission_request:reopen:own' },
    { role: USER.ROLES.USER, permission: 'submission_request:reopen:own' },
];

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, matchedCount?: number, modifiedCount?: number, error?: string}>}
 */
async function backfillReopenUserPermissions(db) {
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
 * Orchestrator entry point for this migration step.
 * @param {import('mongodb').Db} db
 */
async function executeBackfillReopenUserPermissions(db) {
    console.log('🔄 Executing reopen user permission backfill...');

    try {
        const result = await backfillReopenUserPermissions(db);

        if (result.success) {
            console.log('✅ Reopen user permission backfill completed successfully');
        } else {
            console.log('❌ Reopen user permission backfill failed');
        }

        return result;
    } catch (error) {
        console.error('❌ Error executing reopen user permission backfill:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    backfillReopenUserPermissions,
    executeBackfillReopenUserPermissions,
};
