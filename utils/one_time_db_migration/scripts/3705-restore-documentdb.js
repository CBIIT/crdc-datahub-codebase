import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

function validateEnv() {
    const { RESTORE_CONNECTION_STRING, BACKUP_DIRECTORY } = process.env;

    const missingEnvVars = [
        ['RESTORE_CONNECTION_STRING', RESTORE_CONNECTION_STRING],
        ['BACKUP_DIRECTORY', BACKUP_DIRECTORY],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingEnvVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }

    return { RESTORE_CONNECTION_STRING, BACKUP_DIRECTORY };
}

function restoreDocumentDB(restoreConnectionString, backupDirectory) {
    return new Promise((resolve, reject) => {
        const mongorestoreProcess = spawn('mongorestore', [
            '--uri', restoreConnectionString,
            '--drop',
            backupDirectory
        ]);
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

async function main() {
    const { RESTORE_CONNECTION_STRING, BACKUP_DIRECTORY } = validateEnv();
    await restoreDocumentDB(RESTORE_CONNECTION_STRING, BACKUP_DIRECTORY);
}

await main().catch((err) => {
    console.error(err);
    process.exit(1);
});
