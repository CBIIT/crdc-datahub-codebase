import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

const options = {
    'data-commons': {
        type: 'string',
        multiple: true,
        default: []
    },
    'single-update': {
        type: 'boolean',
        default: false
    },
    'dry-run': {
        type: 'boolean',
        default: false
    },
    output: {
        type: 'string'
    }
};

export const NODE_ID_PROPERTY_MAP = {
    CDS: 'dbGaPID',
    ICDC: 'studyAbbreviation'
};

const RELEASE_COLLECTION_NAME = 'release';
const APPROVED_STUDIES_COLLECTION_NAME = 'approvedStudies';

/**
 * @typedef {{
 *   unknownDataCommon: number,
 *   releasesCandidatesTotal: number,
 *   skippedMissingNodeId: number,
 *   skippedNoApprovedStudy: number,
 *   dryRunWouldUpdate: number,
 *   updateOperations: number,
 *   matchedTotal: number,
 *   modifiedTotal: number,
 *   upsertedTotal: number,
 *   unmatchedWriteAttempts: number,
 *   singleUpdateStopped: boolean
 * }} BackfillStats
 */

/** @returns {BackfillStats} */
function createStats() {
    return {
        unknownDataCommon: 0,
        releasesCandidatesTotal: 0,
        skippedMissingNodeId: 0,
        skippedNoApprovedStudy: 0,
        dryRunWouldUpdate: 0,
        updateOperations: 0,
        matchedTotal: 0,
        modifiedTotal: 0,
        upsertedTotal: 0,
        unmatchedWriteAttempts: 0,
        singleUpdateStopped: false
    };
}

/**
 * @param {object} params
 * @param {string} params.databaseName
 * @param {string[]} params.dataCommons
 * @param {boolean} params.dryRun
 * @param {boolean} params.singleUpdate
 * @param {string | undefined} params.logPath
 */
function logRunConfig({ databaseName, dataCommons, dryRun, singleUpdate, logPath }) {
    const commonsLabel = dataCommons.length ? dataCommons.join(', ') : 'none';
    console.log('======== Run configuration ========');
    console.log(`  Database:      ${databaseName}`);
    console.log(`  Data commons:  ${commonsLabel}`);
    console.log(`  Dry run:       ${dryRun ? 'yes' : 'no'}`);
    console.log(`  Single update: ${singleUpdate ? 'yes' : 'no'}`);
    console.log(`  Log file:      ${logPath ?? '(none)'}`);
    console.log('====================================');
}

/** @param {BackfillStats} stats */
function logSummary(stats) {
    console.log('-------- Summary --------');
    console.log(`  Releases considered:           ${stats.releasesCandidatesTotal}`);
    console.log(`  Unknown data common (skipped): ${stats.unknownDataCommon}`);
    console.log(`  Skipped (missing node ID):     ${stats.skippedMissingNodeId}`);
    console.log(`  Skipped (no approved study):   ${stats.skippedNoApprovedStudy}`);
    console.log(`  Dry run (would update):        ${stats.dryRunWouldUpdate}`);
    console.log(`  Update operations:             ${stats.updateOperations}`);
    console.log(`  Matched (writes):              ${stats.matchedTotal}`);
    console.log(`  Modified (writes):             ${stats.modifiedTotal}`);
    console.log(`  Upserted (writes):             ${stats.upsertedTotal}`);
    console.log(`  Unmatched write attempts:      ${stats.unmatchedWriteAttempts}`);
    console.log(`  Stopped after single update:   ${stats.singleUpdateStopped ? 'yes' : 'no'}`);
    console.log('-------------------------');
}

/**
 * @param {Record<string, unknown>} values
 * @param {{ logPath?: string, connect?: () => Promise<{ client: { close: () => Promise<void> }, db: import('mongodb').Db }> }} [options]
 * @returns {Promise<BackfillStats>}
 */
export async function backfillReleaseStudyIDs(values, options = {}) {
    const { logPath, connect: connectFn = connectDatabaseFromEnv } = options;
    const requestedDataCommons = values['data-commons'];
    const dataCommons =
        Array.isArray(requestedDataCommons) && requestedDataCommons.length > 0
            ? requestedDataCommons
            : Object.keys(NODE_ID_PROPERTY_MAP);
    const singleUpdate = values['single-update'];
    const dryRun = values['dry-run'];

    const { client, db } = await connectFn();
    const stats = createStats();

    logRunConfig({
        databaseName: db.databaseName,
        dataCommons,
        dryRun,
        singleUpdate,
        logPath
    });

    try {
        for (const dataCommon of dataCommons) {
            if (!NODE_ID_PROPERTY_MAP[dataCommon]) {
                stats.unknownDataCommon++;
                console.error(
                    `Error: no node ID mapping for data common ${JSON.stringify(dataCommon)}. Skipping.`
                );
                continue;
            }
            const nodeIdProperty = NODE_ID_PROPERTY_MAP[dataCommon];
            const matchConditions = {
                nodeType: 'study',
                dataCommons: dataCommon,
                status: 'Released',
                studyID: { $exists: false }
            };

            const releaseCollection = db.collection(RELEASE_COLLECTION_NAME);
            const approvedStudiesCollection = db.collection(APPROVED_STUDIES_COLLECTION_NAME);

            const pendingCount = await releaseCollection.countDocuments(matchConditions);
            console.log(`${dataCommon}: ${pendingCount} release document(s) pending (no studyID yet)`);

            const cursor = releaseCollection.find(matchConditions);

            for await (const doc of cursor) {
                stats.releasesCandidatesTotal++;
                const nodeValue = doc.nodeID;
                if (nodeValue == null || nodeValue === '') {
                    stats.skippedMissingNodeId++;
                    console.warn(`Skip: missing nodeID on release ${doc._id}`);
                    continue;
                }

                const approvedStudy = await approvedStudiesCollection.findOne({
                    [nodeIdProperty]: nodeValue
                });
                if (!approvedStudy) {
                    stats.skippedNoApprovedStudy++;
                    console.warn(
                        `Skip: no approved study for ${dataCommon} ${nodeIdProperty}=${String(nodeValue)} (release ${doc._id})`
                    );
                    continue;
                }

                const studyID = approvedStudy.id ?? approvedStudy._id;
                if (dryRun) {
                    stats.dryRunWouldUpdate++;
                    console.log(
                        `Would set studyID ${String(studyID)} on release ${doc._id} (${dataCommon})`
                    );
                    if (singleUpdate) {
                        stats.singleUpdateStopped = true;
                        logSummary(stats);
                        return stats;
                    }
                    continue;
                }

                const result = await releaseCollection.updateOne(
                    { _id: doc._id },
                    { $set: { studyID } }
                );
                stats.updateOperations++;
                const matched = result.matchedCount ?? 0;
                const modified = result.modifiedCount ?? 0;
                const upserted = result.upsertedCount ?? 0;
                stats.matchedTotal += matched;
                stats.modifiedTotal += modified;
                stats.upsertedTotal += upserted;

                console.log(`Set studyID ${String(studyID)} on release ${doc._id} (${dataCommon})`);

                if (matched === 0) {
                    stats.unmatchedWriteAttempts++;
                    console.warn(
                        `Warning: update matched no documents for release ${doc._id} (document may have changed).`
                    );
                }

                if (singleUpdate) {
                    stats.singleUpdateStopped = true;
                    logSummary(stats);
                    return stats;
                }
            }
        }

        logSummary(stats);
        return stats;
    } finally {
        await client.close();
    }
}

async function main() {
    const { values } = parseArgs({ options, allowPositionals: true });
    const outputArg = values['output'];

    let logPath;
    let endConsoleFileMirror = null;
    if (outputArg) {
        const out = await openDatedConsoleFileMirror(outputArg);
        endConsoleFileMirror = out.endConsoleFileMirror;
        logPath = out.logPath;
    }

    try {
        await backfillReleaseStudyIDs(values, { logPath });
    } finally {
        if (endConsoleFileMirror) {
            await endConsoleFileMirror();
        }
    }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath);
if (isMainModule) {
    main().catch((err) => {
        console.error('Fatal:', err);
        process.exit(1);
    });
}
