/**
 * 3.7.0 Migration Script
 *
 * Usage: npm run migrate:3.7.0
 *         (or startup via bin/www.js)
 *
 * Migration files:
 * - sync-pbac-defaults-migration.js: Sync PBAC defaults from JSON (recurring step)
 * - backfill-reopen-user-permissions.js: Backfill submission_request:reopen:* on existing users
 * - backfill-application-sequence-number.js: Backfill Application.sequenceNumber where missing
 */

const {
    createDatabaseConnection,
    closeDatabaseConnection
} = require('../recurring-steps/migration-utils');

const { executeSyncPbacDefaults } = require('./sync-pbac-defaults-migration');
const { executeBackfillReopenUserPermissions } = require('./backfill-reopen-user-permissions');
const { executeBackfillApplicationSequenceNumber } = require('./backfill-application-sequence-number');

async function orchestrateMigration() {
    console.log('🚀 Starting 3.7.0 migrations execution...');
    console.log('============================================================');

    const startTime = new Date();
    let client;

    try {
        const dbConnection = await createDatabaseConnection();
        client = dbConnection.client;
        const db = dbConnection.db;

        const availableMigrations = [
            {
                name: 'Sync PBAC defaults from JSON (recurring)',
                file: 'sync-pbac-defaults-migration.js',
                execute: () => executeSyncPbacDefaults(db)
            },
            {
                name: 'Backfill reopen permissions on existing users',
                file: 'backfill-reopen-user-permissions.js',
                execute: () => executeBackfillReopenUserPermissions(db)
            },
            {
                name: 'Backfill Application.sequenceNumber',
                file: 'backfill-application-sequence-number.js',
                execute: () => executeBackfillApplicationSequenceNumber(db)
            }
        ];

        const migrations = [];

        for (const migration of availableMigrations) {
            try {
                const result = await migration.execute();
                migrations.push({
                    name: migration.name,
                    file: migration.file,
                    success: result.success !== false,
                    result
                });
            } catch (error) {
                console.error(`❌ ${migration.name} failed: ${error.message}`);
                migrations.push({
                    name: migration.name,
                    file: migration.file,
                    success: false,
                    error: error.message
                });
            }
        }

        const endTime = new Date();
        const duration = endTime - startTime;
        const successCount = migrations.filter((m) => m.success).length;
        const totalCount = migrations.length;

        console.log(`✅ Migration process completed: ${successCount}/${totalCount} successful (${duration}ms)`);

        if (successCount !== totalCount) {
            console.warn('⚠️  Some migrations encountered issues - see errors above');
        }

        return {
            success: successCount === totalCount,
            duration,
            migrationsExecuted: totalCount,
            migrationsSuccessful: successCount,
            results: migrations
        };
    } catch (error) {
        console.error('❌ Migration orchestration failed:', error.message);
        return { success: false, error: error.message };
    } finally {
        if (client) {
            await closeDatabaseConnection(client);
        }
    }
}

async function main() {
    try {
        const result = await orchestrateMigration();
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error.message);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = {
    orchestrateMigration
};
