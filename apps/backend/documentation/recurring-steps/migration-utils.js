/**
 * Shared MongoDB/DocumentDB connection helpers for migration orchestrators.
 */

require('dotenv').config();

const { MongoClient } = require('mongodb');
const config = require('../../config');
const { DATABASE_NAME } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Opens a MongoClient using the shared DocumentDB URI from config
 * (docdb_*, TLS, retryWrites=false, SCRAM-SHA-1).
 * @returns {Promise<{client: import('mongodb').MongoClient, db: import('mongodb').Db, dbName: string, connectionString: string}>}
 */
async function createDatabaseConnection() {
    const uri = config.document_db_connection_string;
    const client = new MongoClient(uri);
    await client.connect();

    const dbName = DATABASE_NAME;
    const db = client.db(dbName);
    const user = config.document_db_user;
    const host = config.document_db_host;
    const port = config.document_db_port;

    console.log(`📊 Connected to database: ${dbName}`);

    return {
        client,
        db,
        dbName,
        connectionString: `mongodb://${user ? user + ':***@' : ''}${host}:${port}/${dbName}`
    };
}

/**
 * Closes a MongoClient opened by createDatabaseConnection.
 * @param {import('mongodb').MongoClient} client
 * @returns {Promise<void>}
 */
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
