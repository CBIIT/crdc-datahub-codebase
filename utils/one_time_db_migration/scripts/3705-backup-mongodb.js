import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { COLLECTION_NAMES_3705 } from '../utilities/3705-constants.js';

dotenv.config();

function validateEnv() {
    const {
        BACKUP_CONNECTION_STRING,
        BACKUP_DATABASE_NAME,
        BACKUP_DIRECTORY
    } = process.env;

    const missingEnvVars = [
        ['BACKUP_CONNECTION_STRING', BACKUP_CONNECTION_STRING],
        ['BACKUP_DATABASE_NAME', BACKUP_DATABASE_NAME],
        ['BACKUP_DIRECTORY', BACKUP_DIRECTORY],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    return { BACKUP_CONNECTION_STRING, BACKUP_DATABASE_NAME, BACKUP_DIRECTORY };
}

async function dumpMongoDB() {
    const { BACKUP_CONNECTION_STRING, BACKUP_DATABASE_NAME, BACKUP_DIRECTORY } = validateEnv();

    for (const collectionName of COLLECTION_NAMES_3705) {
        await backupCollection(collectionName, BACKUP_CONNECTION_STRING, BACKUP_DATABASE_NAME, BACKUP_DIRECTORY);
    }
}

function backupCollection(collectionName, connectionString, databaseName, backupDirectory) {
    return new Promise((resolve, reject) => {
        const mongodumpProcess = spawn('mongodump', [
            '--uri', connectionString,
            '--db', databaseName,
            '--authenticationDatabase', 'admin',
            '--out', backupDirectory,
            '--collection', collectionName,
        ]);
        mongodumpProcess.stdout.pipe(process.stdout);
        mongodumpProcess.stderr.pipe(process.stderr);
        mongodumpProcess.on('error', reject);
        mongodumpProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`mongodump exited with code ${code} for collection ${collectionName}`));
                return;
            }
            resolve();
        });
    });
}

await dumpMongoDB().catch((err) => {
    console.error(err);
    process.exit(1);
});
