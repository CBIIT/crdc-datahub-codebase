/**
 * Shared DocumentDB connection helpers for migration orchestrators.
 */

const { MongoClient } = require('mongodb');
const config = require('../../config');
const { DATABASE_NAME } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Opens a DocumentDB connection using the shared TLS URI from config.js.
 * @returns {Promise<{client: object, db: object, dbName: string}>}
 */
async function createDatabaseConnection() {
    const client = new MongoClient(config.document_db_connection_string);
    await client.connect();

    const dbName = DATABASE_NAME;
    const db = client.db(dbName);

    console.log(`📊 Connected to database: ${dbName}`);

    return {
        client,
        db,
        dbName
    };
}

async function closeDatabaseConnection(client) {
    try {
        await client.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error.message);
    }
}

module.exports = {
    createDatabaseConnection,
    closeDatabaseConnection
};
