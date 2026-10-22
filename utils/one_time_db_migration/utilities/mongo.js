import { MongoClient } from 'mongodb';

/**
 * Connect using CONNECTION_STRING and DATABASE_NAME from the environment.
 * @returns {Promise<{ client: MongoClient, db: import('mongodb').Db }>}
 */
export async function connectDatabaseFromEnv() {
    const { CONNECTION_STRING, DATABASE_NAME } = process.env;
    if (!CONNECTION_STRING || !DATABASE_NAME) {
        throw new Error('CONNECTION_STRING and DATABASE_NAME must be set');
    }
    const client = new MongoClient(CONNECTION_STRING);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    return { client, db };
}
