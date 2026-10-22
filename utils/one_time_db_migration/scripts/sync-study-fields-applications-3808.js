import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

const options = {
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

const APPLICATIONS_COLLECTION_NAME = 'applications';

/**
 * @typedef {{
 *   applicationsConsidered: number,
 *   skippedInvalidQuestionnaireData: number,
 *   skippedUnexpectedFieldType: number,
 *   alreadyInSync: number,
 *   dryRunWouldUpdate: number,
 *   updatedDocuments: number,
 *   updateOperations: number,
 *   matchedTotal: number,
 *   modifiedTotal: number,
 *   unmatchedWriteAttempts: number,
 *   matchedButNotModified: number,
 *   singleUpdateStopped: boolean
 * }} SyncStats
 */

/** @returns {SyncStats} */
export function createStats() {
    return {
        applicationsConsidered: 0,
        skippedInvalidQuestionnaireData: 0,
        skippedUnexpectedFieldType: 0,
        alreadyInSync: 0,
        dryRunWouldUpdate: 0,
        updatedDocuments: 0,
        updateOperations: 0,
        matchedTotal: 0,
        modifiedTotal: 0,
        unmatchedWriteAttempts: 0,
        matchedButNotModified: 0,
        singleUpdateStopped: false
    };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeStudyField(value) {
    if (value == null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    return String(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidStudyFieldValue(value) {
    return value == null || typeof value === 'string';
}

/**
 * @param {{ studyAbbreviation?: unknown, studyName?: unknown }} doc
 * @returns {string | null}
 */
export function getUnexpectedStudyFieldTypeReason(doc) {
    if (!isValidStudyFieldValue(doc.studyAbbreviation)) {
        return 'unexpected type for studyAbbreviation';
    }
    if (!isValidStudyFieldValue(doc.studyName)) {
        return 'unexpected type for studyName';
    }
    return null;
}

/**
 * @param {unknown} questionnaireData
 * @returns {{ ok: true, parsedData: Record<string, unknown> } | { ok: false, reason: string }}
 */
export function parseQuestionnaireData(questionnaireData) {
    if (questionnaireData == null) {
        return { ok: false, reason: 'missing questionnaireData' };
    }
    if (typeof questionnaireData === 'object' && !Array.isArray(questionnaireData)) {
        return { ok: true, parsedData: /** @type {Record<string, unknown>} */ (questionnaireData) };
    }
    if (typeof questionnaireData !== 'string') {
        return { ok: false, reason: 'questionnaireData is not a string or object' };
    }
    if (questionnaireData === '') {
        return { ok: false, reason: 'empty questionnaireData' };
    }
    try {
        const parsed = JSON.parse(questionnaireData);
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, reason: 'questionnaireData did not parse to an object' };
        }
        return { ok: true, parsedData: /** @type {Record<string, unknown>} */ (parsed) };
    } catch {
        return { ok: false, reason: 'invalid JSON in questionnaireData' };
    }
}

/**
 * @param {Record<string, unknown>} parsedData
 * @returns {{ studyAbbreviation: string, studyName: string }}
 */
export function deriveStudyTargets(parsedData) {
    const study =
        parsedData.study != null && typeof parsedData.study === 'object' && !Array.isArray(parsedData.study)
            ? /** @type {Record<string, unknown>} */ (parsedData.study)
            : null;

    return {
        studyAbbreviation: normalizeStudyField(study?.abbreviation),
        studyName: normalizeStudyField(study?.name)
    };
}

/**
 * @param {{ studyAbbreviation?: unknown, studyName?: unknown }} doc
 * @param {Record<string, unknown>} parsedData
 * @returns {{
 *   studyAbbreviation: string,
 *   studyName: string,
 *   changes: {
 *     studyAbbreviation?: { from: string, to: string },
 *     studyName?: { from: string, to: string }
 *   }
 * } | null}
 */
export function planStudyFieldsSync(doc, parsedData) {
    const targets = deriveStudyTargets(parsedData);
    const currentAbbreviation = normalizeStudyField(doc.studyAbbreviation);
    const currentName = normalizeStudyField(doc.studyName);

    const abbreviationMatches = currentAbbreviation === targets.studyAbbreviation;
    const nameMatches = currentName === targets.studyName;
    if (abbreviationMatches && nameMatches) {
        return null;
    }

    /** @type {{ studyAbbreviation?: { from: string, to: string }, studyName?: { from: string, to: string } }} */
    const changes = {};
    if (!abbreviationMatches) {
        changes.studyAbbreviation = { from: currentAbbreviation, to: targets.studyAbbreviation };
    }
    if (!nameMatches) {
        changes.studyName = { from: currentName, to: targets.studyName };
    }

    return {
        studyAbbreviation: targets.studyAbbreviation,
        studyName: targets.studyName,
        changes
    };
}

/**
 * @param {{ studyAbbreviation?: { from: string, to: string }, studyName?: { from: string, to: string } }} changes
 * @returns {string}
 */
export function formatStudyFieldsChangeDetails(changes) {
    const parts = [];
    if (changes.studyAbbreviation) {
        parts.push(
            `studyAbbreviation "${changes.studyAbbreviation.from}" -> "${changes.studyAbbreviation.to}"`
        );
    }
    if (changes.studyName) {
        parts.push(`studyName "${changes.studyName.from}" -> "${changes.studyName.to}"`);
    }
    return parts.join(', ');
}

/**
 * @param {object} params
 * @param {string} params.databaseName
 * @param {boolean} params.dryRun
 * @param {boolean} params.singleUpdate
 * @param {string | undefined} params.logPath
 */
function logRunConfig({ databaseName, dryRun, singleUpdate, logPath }) {
    console.log('======== Run configuration ========');
    console.log(`  Database:      ${databaseName}`);
    console.log(`  Collection:    ${APPLICATIONS_COLLECTION_NAME}`);
    console.log(`  Dry run:       ${dryRun ? 'yes' : 'no'}`);
    console.log(`  Single update: ${singleUpdate ? 'yes' : 'no'}`);
    console.log(`  Log file:      ${logPath ?? '(none)'}`);
    console.log('====================================');
}

/** @param {SyncStats} stats */
function logSummary(stats) {
    console.log('-------- Summary --------');
    console.log(`  Applications considered:              ${stats.applicationsConsidered}`);
    console.log(`  Skipped (invalid questionnaireData):  ${stats.skippedInvalidQuestionnaireData}`);
    console.log(`  Skipped (unexpected field type):      ${stats.skippedUnexpectedFieldType}`);
    console.log(`  Already in sync:                      ${stats.alreadyInSync}`);
    console.log(`  Dry run (would update):               ${stats.dryRunWouldUpdate}`);
    console.log(`  Updated documents:                    ${stats.updatedDocuments}`);
    console.log(`  Update operations:                    ${stats.updateOperations}`);
    console.log(`  Matched (writes):                     ${stats.matchedTotal}`);
    console.log(`  Modified (writes):                    ${stats.modifiedTotal}`);
    console.log(`  Unmatched write attempts:             ${stats.unmatchedWriteAttempts}`);
    console.log(`  Matched but not modified:             ${stats.matchedButNotModified}`);
    console.log(`  Stopped after single update:          ${stats.singleUpdateStopped ? 'yes' : 'no'}`);
    console.log('-------------------------');
}

/**
 * @param {Record<string, unknown>} values
 * @param {{ logPath?: string, connect?: () => Promise<{ client: { close: () => Promise<void> }, db: import('mongodb').Db }> }} [options]
 * @returns {Promise<SyncStats>}
 */
export async function syncStudyFieldsApplications(values, options = {}) {
    const { logPath, connect: connectFn = connectDatabaseFromEnv } = options;
    const singleUpdate = values['single-update'];
    const dryRun = values['dry-run'];

    const { client, db } = await connectFn();
    const stats = createStats();

    logRunConfig({
        databaseName: db.databaseName,
        dryRun,
        singleUpdate,
        logPath
    });

    try {
        const applicationsCollection = db.collection(APPLICATIONS_COLLECTION_NAME);
        const pendingCount = await applicationsCollection.countDocuments({});
        console.log(`${pendingCount} application document(s) to scan`);

        const cursor = applicationsCollection.find(
            {},
            { projection: { studyAbbreviation: 1, studyName: 1, questionnaireData: 1 } }
        );

        for await (const doc of cursor) {
            stats.applicationsConsidered++;
            const applicationID = String(doc._id);

            const parseResult = parseQuestionnaireData(doc.questionnaireData);
            if (!parseResult.ok) {
                stats.skippedInvalidQuestionnaireData++;
                console.warn(`Skip: ${parseResult.reason} (application ${applicationID})`);
                continue;
            }

            const unexpectedFieldTypeReason = getUnexpectedStudyFieldTypeReason(doc);
            if (unexpectedFieldTypeReason) {
                stats.skippedUnexpectedFieldType++;
                console.warn(`Skip: ${unexpectedFieldTypeReason} (application ${applicationID})`);
                continue;
            }

            const patchPlan = planStudyFieldsSync(doc, parseResult.parsedData);
            if (!patchPlan) {
                stats.alreadyInSync++;
                continue;
            }

            const changeDetails = formatStudyFieldsChangeDetails(patchPlan.changes);

            if (dryRun) {
                stats.dryRunWouldUpdate++;
                console.log(`Would update application ${applicationID}: ${changeDetails}`);
                if (singleUpdate) {
                    stats.singleUpdateStopped = true;
                    logSummary(stats);
                    return stats;
                }
                continue;
            }

            const result = await applicationsCollection.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        studyAbbreviation: patchPlan.studyAbbreviation,
                        studyName: patchPlan.studyName
                    }
                }
            );
            stats.updateOperations++;
            const matched = result.matchedCount ?? 0;
            const modified = result.modifiedCount ?? 0;
            stats.matchedTotal += matched;
            stats.modifiedTotal += modified;

            if (modified > 0) {
                stats.updatedDocuments++;
                console.log(`Updated application ${applicationID}: ${changeDetails}`);
            } else if (matched > 0) {
                stats.matchedButNotModified++;
                console.warn(
                    `Warning: update matched but did not modify application ${applicationID} (document may have changed).`
                );
            }

            if (matched === 0) {
                stats.unmatchedWriteAttempts++;
                console.warn(
                    `Warning: update matched no documents for application ${applicationID} (document may have changed).`
                );
            }

            if (singleUpdate) {
                stats.singleUpdateStopped = true;
                logSummary(stats);
                return stats;
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
        await syncStudyFieldsApplications(values, { logPath });
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
