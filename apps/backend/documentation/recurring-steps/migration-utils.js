/**
 * Shared MongoDB connection helpers for migration orchestrators.
 */

const { MongoClient } = require('mongodb');

require('dotenv').config();

async function createDatabaseConnection() {
    const user = process.env.MONGO_DB_USER;
    const password = process.env.MONGO_DB_PASSWORD;
    const host = process.env.MONGO_DB_HOST || 'localhost';
    const port = process.env.MONGO_DB_PORT || '27017';

    let connectionString;
    if (user && password) {
        connectionString = `mongodb://${user}:${password}@${host}:${port}`;
    } else {
        connectionString = `mongodb://${host}:${port}`;
    }

    const client = new MongoClient(connectionString);
    await client.connect();

    const dbName = process.env.MONGO_DB_NAME || process.env.DATABASE_NAME || 'crdc-datahub';
    const db = client.db(dbName);

    console.log(`📊 Connected to database: ${dbName}`);

    return {
        client,
        db,
        dbName,
        connectionString: `mongodb://${user ? user + ':***@' : ''}${host}:${port}/${dbName}`
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
