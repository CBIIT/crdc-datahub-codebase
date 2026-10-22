import dotenv from 'dotenv';
import { COLLECTION_NAMES_3705 } from '../utilities/3705-constants.js';
import { MongoClient } from 'mongodb';

dotenv.config();

/**
 * Reads source and destination connection settings from the environment.
 * `RESTORE_DATABASE_NAME` defaults to `BACKUP_DATABASE_NAME` when unset.
 * @returns {{ BACKUP_CONNECTION_STRING: string, RESTORE_CONNECTION_STRING: string, BACKUP_DATABASE_NAME: string, restoreDatabaseName: string }}
 * @throws {Error} When a required variable is missing
 */
function validateEnv() {
    const {
        BACKUP_CONNECTION_STRING,
        RESTORE_CONNECTION_STRING,
        BACKUP_DATABASE_NAME,
        RESTORE_DATABASE_NAME,
    } = process.env;

    const missingEnvVars = [
        ['BACKUP_CONNECTION_STRING', BACKUP_CONNECTION_STRING],
        ['RESTORE_CONNECTION_STRING', RESTORE_CONNECTION_STRING],
        ['BACKUP_DATABASE_NAME', BACKUP_DATABASE_NAME],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    const restoreDatabaseName = RESTORE_DATABASE_NAME || BACKUP_DATABASE_NAME;

    return {
        BACKUP_CONNECTION_STRING,
        RESTORE_CONNECTION_STRING,
        BACKUP_DATABASE_NAME,
        restoreDatabaseName,
    };
}

/**
 * Compares document counts for each 3705 collection between source MongoDB and DocumentDB.
 * @returns {Promise<void>}
 */
async function compareInstances() {
    const {
        BACKUP_CONNECTION_STRING,
        RESTORE_CONNECTION_STRING,
        BACKUP_DATABASE_NAME,
        restoreDatabaseName,
    } = validateEnv();

    const backupCounts = await getCounts(BACKUP_CONNECTION_STRING, BACKUP_DATABASE_NAME, 'backup');
    const restoreCounts = await getCounts(RESTORE_CONNECTION_STRING, restoreDatabaseName, 'restore');
    const mismatchedCollections = await compareCounts(backupCounts, restoreCounts);
    if (mismatchedCollections.length === 0) {
        console.log('All collections matched');
    } else {
        console.error(`Mismatched collections: ${mismatchedCollections.join(', ')}`);
        console.error('Verification failed');
        process.exit(1);
    }
}

/**
 * Counts documents in each 3705 collection.
 * @param {string} connectionString MongoDB or DocumentDB URI
 * @param {string} databaseName Database to query
 * @param {string} label Log label, such as backup or restore
 * @returns {Promise<Record<string, number>>}
 */
async function getCounts(connectionString, databaseName, label) {
    const client = new MongoClient(connectionString);
    try {
        await client.connect();
        const db = client.db(databaseName);
        const counts = {};
        for (const collectionName of COLLECTION_NAMES_3705) {
            console.log(`Getting count for ${collectionName} in ${label} database ${databaseName}`);
            counts[collectionName] = await db.collection(collectionName).countDocuments();
        }
        return counts;
    } catch (error) {
        console.error(`An error occurred while querying the ${label} database`);
        console.error(error);
        throw error;
    } finally {
        await client.close();
    }
}

async function compareCounts(backupCounts, restoreCounts) {
    const mismatchedCollections = [];
    for (const collectionName of COLLECTION_NAMES_3705) {
        const backupCount = backupCounts[collectionName];
        const restoreCount = restoreCounts[collectionName];
        if (backupCount !== restoreCount) {
            mismatchedCollections.push(collectionName);
            console.error(`MISMATCHED COUNTS FOR ${collectionName}`);
            console.error(`Source count: ${backupCount}`);
            console.error(`Destination count: ${restoreCount}`);
        } else {
            console.log(`Matched counts for ${collectionName}: ${backupCount}`);
        }
    }
    return mismatchedCollections;
}

await compareInstances().catch((err) => {
    console.error(err);
    process.exit(1);
});
