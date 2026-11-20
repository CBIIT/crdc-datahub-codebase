import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

/**
 * Reads restore settings from the environment.
 * `RESTORE_DATABASE_NAME` defaults to `BACKUP_DATABASE_NAME` when unset.
 * @returns {{ RESTORE_CONNECTION_STRING: string, BACKUP_DIRECTORY: string, BACKUP_DATABASE_NAME: string, restoreDatabaseName: string }}
 * @throws {Error} When a required variable is missing
 */
function validateEnv() {
    const {
        RESTORE_CONNECTION_STRING,
        BACKUP_DIRECTORY,
        BACKUP_DATABASE_NAME,
        RESTORE_DATABASE_NAME,
    } = process.env;

    const missingEnvVars = [
        ['RESTORE_CONNECTION_STRING', RESTORE_CONNECTION_STRING],
        ['BACKUP_DIRECTORY', BACKUP_DIRECTORY],
        ['BACKUP_DATABASE_NAME', BACKUP_DATABASE_NAME],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    const restoreDatabaseName = RESTORE_DATABASE_NAME || BACKUP_DATABASE_NAME;

    return {
        RESTORE_CONNECTION_STRING,
        BACKUP_DIRECTORY,
        BACKUP_DATABASE_NAME,
        restoreDatabaseName,
    };
}

/**
 * Restores a mongodump directory into DocumentDB, optionally remapping the database name.
 * When the names differ, passes `--nsInclude`, `--nsFrom`, and `--nsTo` so only the source database is dropped and restored under the destination name.
 * @param {string} restoreConnectionString DocumentDB URI
 * @param {string} backupDirectory Local mongodump output root
 * @param {string} backupDatabaseName Database name in the dump (mongodump --db)
 * @param {string} restoreDatabaseName Target database name on DocumentDB
 * @returns {Promise<void>}
 */
function restoreDocumentDB(
    restoreConnectionString,
    backupDirectory,
    backupDatabaseName,
    restoreDatabaseName,
) {
    return new Promise((resolve, reject) => {
        const mongorestoreArgs = [
            '--uri', restoreConnectionString,
            '--drop',
        ];
        console.log(`Restoring database ${backupDatabaseName} into ${restoreDatabaseName}`);
        if (backupDatabaseName !== restoreDatabaseName) {
            const sourceNamespace = `${backupDatabaseName}.*`;
            const destinationNamespace = `${restoreDatabaseName}.*`;
            console.log(`Remapping namespaces with --nsInclude ${sourceNamespace} --nsFrom ${sourceNamespace} --nsTo ${destinationNamespace}`);
            mongorestoreArgs.push(
                '--nsInclude', sourceNamespace,
                '--nsFrom', sourceNamespace,
                '--nsTo', destinationNamespace,
            );
        }
        mongorestoreArgs.push(backupDirectory);

        const mongorestoreProcess = spawn('mongorestore', mongorestoreArgs);
        mongorestoreProcess.stdout.pipe(process.stdout);
        mongorestoreProcess.stderr.pipe(process.stderr);
        mongorestoreProcess.on('error', reject);
        mongorestoreProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`mongorestore exited with code ${code}`));
                return;
            }
            resolve();
        });
    });
}

/**
 * Validates the environment and restores the dump into DocumentDB.
 * @returns {Promise<void>}
 */
async function main() {
    const {
        RESTORE_CONNECTION_STRING,
        BACKUP_DIRECTORY,
        BACKUP_DATABASE_NAME,
        restoreDatabaseName,
    } = validateEnv();
    await restoreDocumentDB(
        RESTORE_CONNECTION_STRING,
        BACKUP_DIRECTORY,
        BACKUP_DATABASE_NAME,
        restoreDatabaseName,
    );
}

await main().catch((err) => {
    console.error(err);
    process.exit(1);
});
