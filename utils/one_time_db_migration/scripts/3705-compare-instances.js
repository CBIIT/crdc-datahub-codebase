import dotenv from 'dotenv';
import { COLLECTION_NAMES_3705 } from '../utilities/3705-constants.js';
import { MongoClient } from 'mongodb';

dotenv.config();

function validateEnv() {
    const {
        BACKUP_CONNECTION_STRING,
        RESTORE_CONNECTION_STRING,
        BACKUP_DATABASE_NAME
    } = process.env;

    const missingEnvVars = [
        ['BACKUP_CONNECTION_STRING', BACKUP_CONNECTION_STRING],
        ['RESTORE_CONNECTION_STRING', RESTORE_CONNECTION_STRING],
        ['BACKUP_DATABASE_NAME', BACKUP_DATABASE_NAME],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    return { BACKUP_CONNECTION_STRING, RESTORE_CONNECTION_STRING, BACKUP_DATABASE_NAME };
}

async function compareInstances() {
    const { BACKUP_CONNECTION_STRING, RESTORE_CONNECTION_STRING, BACKUP_DATABASE_NAME } = validateEnv();

    const backupCounts = await getCounts(BACKUP_CONNECTION_STRING, BACKUP_DATABASE_NAME, 'backup');
    const restoreCounts = await getCounts(RESTORE_CONNECTION_STRING, BACKUP_DATABASE_NAME, 'restore');
    const mismatchedCollections = await compareCounts(backupCounts, restoreCounts);
    if (mismatchedCollections.length === 0) {
        console.log('All collections matched');
    } else {
        console.error(`Mismatched collections: ${mismatchedCollections.join(', ')}`);
        console.error('Verification failed');
        process.exit(1);
    }
}

async function getCounts(connectionString, databaseName, label) {
    const client = new MongoClient(connectionString);
    try {
        await client.connect();
        const db = client.db(databaseName);
        const counts = {};
        for (const collectionName of COLLECTION_NAMES_3705) {
            console.log(`Getting count for ${collectionName} in ${label} database`);
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
