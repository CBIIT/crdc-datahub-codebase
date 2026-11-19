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

/**
 * Inserts a configuration document when no document with this type exists.
 * Does not modify an existing document.
 * @param {import('mongodb').Db} db
 * @param {string} fixedID _id used when inserting
 * @param {string} type Configuration type discriminator
 * @param {object} keys Configuration keys
 * @returns {Promise<{success: boolean, created: boolean, skipped?: boolean}>}
 */
async function createNewConfiguration(db, fixedID, type, keys) {
    const configurationCollection = db.collection('configuration');
    const existingConfiguration = await configurationCollection.findOne({ type: type });
    if (existingConfiguration) {
        console.log(`Configuration with type ${type} already exists`);
        return { success: true, created: false, skipped: true };
    }
    const document = {
        _id: fixedID,
        type: type,
        keys: keys
    }
    await configurationCollection.insertOne(document);
    return { success: true, created: true };
}

module.exports = {
    createNewConfiguration,
    createDatabaseConnection,
    closeDatabaseConnection
};
