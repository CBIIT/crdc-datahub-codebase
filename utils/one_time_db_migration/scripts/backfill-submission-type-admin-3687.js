import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parse as parseYaml } from 'yaml';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

/** RFC 4122 UUID (versions 1–5), case-insensitive hex. */
export const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUBMISSIONS_COLLECTION_NAME = 'submissions';
export const ADMIN_SUBMISSION_TYPE = 'Admin';

const options = {
    config: {
        type: 'string'
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

/**
 * @typedef {{
 *   idsLoaded: number,
 *   idsInvalid: number,
 *   idsUnique: number,
 *   notFound: number,
 *   skippedNoSubmittedHistory: number,
 *   historyAlreadyCorrect: number,
 *   dryRunWouldPatchHistory: number,
 *   historyPatchOperations: number,
 *   historyMatchedTotal: number,
 *   historyModifiedTotal: number,
 *   unmatchedWriteAttempts: number,
 *   singleUpdateStopped: boolean
 * }} BackfillStats
 */

/** @returns {BackfillStats} */
export function createStats() {
    return {
        idsLoaded: 0,
        idsInvalid: 0,
        idsUnique: 0,
        notFound: 0,
        skippedNoSubmittedHistory: 0,
        historyAlreadyCorrect: 0,
        dryRunWouldPatchHistory: 0,
        historyPatchOperations: 0,
        historyMatchedTotal: 0,
        historyModifiedTotal: 0,
        unmatchedWriteAttempts: 0,
        singleUpdateStopped: false
    };
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseAdminSubmissionIdsFromConfig(raw) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Config must be a YAML object with admin_submission_ids');
    }
    const list = /** @type {{ admin_submission_ids?: unknown }} */ (raw).admin_submission_ids;
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error('admin_submission_ids must be a non-empty array of strings');
    }
    return list.map((item, index) => {
        if (typeof item !== 'string') {
            throw new Error(`admin_submission_ids[${index}] must be a string`);
        }
        return item.trim();
    });
}

/**
 * @param {string[]} rawIds
 * @returns {{ validIds: string[], invalidCount: number }}
 */
export function validateAndDedupeSubmissionIds(rawIds) {
    const seen = new Set();
    const validIds = [];
    let invalidCount = 0;

    for (const id of rawIds) {
        if (id === '') {
            invalidCount++;
            continue;
        }
        if (!UUID_REGEX.test(id)) {
            invalidCount++;
            console.error(`Error: invalid UUID ${JSON.stringify(id)}`);
            continue;
        }
        const normalized = id.toLowerCase();
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        validIds.push(id);
    }

    return { validIds, invalidCount };
}

/**
 * @param {string} configPath
 * @returns {Promise<string[]>}
 */
export async function loadAdminSubmissionIdsFromFile(configPath) {
    const content = await readFile(configPath, 'utf8');
    const raw = parseYaml(content);
    return parseAdminSubmissionIdsFromConfig(raw);
}

/**
 * @param {unknown[] | undefined | null} history
 * @returns {number}
 */
export function findLastSubmittedHistoryIndex(history) {
    if (!Array.isArray(history)) {
        return -1;
    }
    for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        if (entry && typeof entry === 'object' && /** @type {{ status?: unknown }} */ (entry).status === 'Submitted') {
            return i;
        }
    }
    return -1;
}

/**
 * @param {unknown[] | undefined | null} history
 * @returns {boolean}
 */
export function historyNeedsAdminSubmitPatch(history) {
    const index = findLastSubmittedHistoryIndex(history);
    if (index < 0) {
        return false;
    }
    const entry = history[index];
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    return /** @type {{ isAdminSubmit?: unknown }} */ (entry).isAdminSubmit !== true;
}

/**
 * @param {unknown} submissionType
 * @returns {boolean}
 */
export function submissionNeedsAdminTypePatch(submissionType) {
    return submissionType !== ADMIN_SUBMISSION_TYPE;
}

/**
 * @param {{ history?: unknown[] | null, submissionType?: unknown }} doc
 * @returns {{ submittedIndex: number, historyNeeds: boolean, typeNeeds: boolean } | null}
 */
export function planAdminBackfillPatch(doc) {
    const submittedIndex = findLastSubmittedHistoryIndex(doc.history);
    if (submittedIndex < 0) {
        return null;
    }
    const historyNeeds = historyNeedsAdminSubmitPatch(doc.history);
    const typeNeeds = submissionNeedsAdminTypePatch(doc.submissionType);
    if (!historyNeeds && !typeNeeds) {
        return null;
    }
    return { submittedIndex, historyNeeds, typeNeeds };
}

/**
 * @param {unknown[]} history
 * @param {number} submittedIndex
 * @returns {unknown[]}
 */
export function buildPatchedHistory(history, submittedIndex) {
    return history.map((entry, i) => {
        if (i !== submittedIndex) {
            return entry;
        }
        if (!entry || typeof entry !== 'object') {
            return { isAdminSubmit: true };
        }
        return { ...entry, isAdminSubmit: true };
    });
}

/**
 * @param {object} params
 * @param {string} params.databaseName
 * @param {string} params.configPath
 * @param {number} params.idsLoaded
 * @param {number} params.idsUnique
 * @param {boolean} params.dryRun
 * @param {boolean} params.singleUpdate
 * @param {string | undefined} params.logPath
 */
function logRunConfig({ databaseName, configPath, idsLoaded, idsUnique, dryRun, singleUpdate, logPath }) {
    console.log('======== Run configuration (ticket 3687) ========');
    console.log(`  Database:      ${databaseName}`);
    console.log(`  Config:        ${configPath}`);
    console.log(`  IDs loaded:    ${idsLoaded}`);
    console.log(`  IDs unique:    ${idsUnique}`);
    console.log(`  Dry run:       ${dryRun ? 'yes' : 'no'}`);
    console.log(`  Single update: ${singleUpdate ? 'yes' : 'no'}`);
    console.log(`  Log file:      ${logPath ?? '(none)'}`);
    console.log('=================================================');
}

/** @param {BackfillStats} stats */
function logSummary(stats) {
    console.log('-------- Summary --------');
    console.log(`  IDs loaded:                    ${stats.idsLoaded}`);
    console.log(`  IDs invalid (skipped):         ${stats.idsInvalid}`);
    console.log(`  IDs unique (processed):        ${stats.idsUnique}`);
    console.log(`  Not found:                     ${stats.notFound}`);
    console.log(`  No Submitted history entry:    ${stats.skippedNoSubmittedHistory}`);
    console.log(`  History already correct:       ${stats.historyAlreadyCorrect}`);
    console.log(`  Dry run (would patch history): ${stats.dryRunWouldPatchHistory}`);
    console.log(`  History patch operations:      ${stats.historyPatchOperations}`);
    console.log(`  Matched (writes):              ${stats.historyMatchedTotal}`);
    console.log(`  Modified (writes):             ${stats.historyModifiedTotal}`);
    console.log(`  Unmatched write attempts:      ${stats.unmatchedWriteAttempts}`);
    console.log(`  Stopped after single update:   ${stats.singleUpdateStopped ? 'yes' : 'no'}`);
    console.log('-------------------------');
}

/**
 * @param {Record<string, unknown>} values
 * @param {{ logPath?: string, configPath?: string, submissionIds?: string[], connect?: () => Promise<{ client: { close: () => Promise<void> }, db: import('mongodb').Db }> }} [options]
 * @returns {Promise<BackfillStats>}
 */
export async function backfillSubmissionTypeAdmin3687(values, options = {}) {
    const { logPath, connect: connectFn = connectDatabaseFromEnv } = options;
    const configPath = options.configPath ?? values.config;

    let rawIds;
    if (options.submissionIds) {
        rawIds = options.submissionIds;
    } else {
        if (!configPath || typeof configPath !== 'string') {
            throw new Error('--config <path> is required (YAML with admin_submission_ids)');
        }
        rawIds = await loadAdminSubmissionIdsFromFile(configPath);
    }
    const { validIds, invalidCount } = validateAndDedupeSubmissionIds(rawIds);

    const singleUpdate = values['single-update'];
    const dryRun = values['dry-run'];

    const stats = createStats();
    stats.idsLoaded = rawIds.length;
    stats.idsInvalid = invalidCount;
    stats.idsUnique = validIds.length;

    if (validIds.length === 0) {
        throw new Error('No valid submission IDs to process after validation');
    }

    const { client, db } = await connectFn();

    logRunConfig({
        databaseName: db.databaseName,
        configPath: typeof configPath === 'string' ? configPath : '(inline IDs)',
        idsLoaded: stats.idsLoaded,
        idsUnique: stats.idsUnique,
        dryRun,
        singleUpdate,
        logPath
    });

    try {
        const submissions = db.collection(SUBMISSIONS_COLLECTION_NAME);
        const cursor = submissions.find(
            { _id: { $in: validIds } },
            { projection: { _id: 1, status: 1, submissionType: 1, history: 1 } }
        );

        /** @type {Map<string, { _id: string, status?: string, submissionType?: unknown, history?: unknown[] }>} */
        const docById = new Map();
        for await (const doc of cursor) {
            docById.set(String(doc._id), doc);
        }

        for (const submissionId of validIds) {
            const doc = docById.get(submissionId);
            const statusLabel = doc?.status != null ? String(doc.status) : '(missing)';

            if (!doc) {
                stats.notFound++;
                console.warn(`Skip: not found ${submissionId}`);
                continue;
            }

            const submittedIndex = findLastSubmittedHistoryIndex(doc.history);
            if (submittedIndex < 0) {
                stats.skippedNoSubmittedHistory++;
                console.warn(
                    `Skip: no Submitted history entry ${submissionId} (status=${statusLabel})`
                );
                continue;
            }

            const patchPlan = planAdminBackfillPatch(doc);
            if (!patchPlan) {
                stats.historyAlreadyCorrect++;
                console.log(
                    `Skip: already admin ${submissionId} (status=${statusLabel}, submissionType=${String(doc.submissionType ?? '(missing)')})`
                );
                continue;
            }

            if (dryRun) {
                stats.dryRunWouldPatchHistory++;
                const patchParts = [];
                if (patchPlan.historyNeeds) {
                    patchParts.push('history (last Submitted isAdminSubmit)');
                }
                if (patchPlan.typeNeeds) {
                    patchParts.push(`submissionType=${ADMIN_SUBMISSION_TYPE}`);
                }
                console.log(
                    `Would patch ${patchParts.join(', ')} ${submissionId} (status=${statusLabel})`
                );
                if (singleUpdate) {
                    stats.singleUpdateStopped = true;
                    logSummary(stats);
                    return stats;
                }
                continue;
            }

            /** @type {Record<string, unknown>} */
            const $set = {};
            if (patchPlan.historyNeeds) {
                const history = /** @type {unknown[]} */ (doc.history);
                $set.history = buildPatchedHistory(history, patchPlan.submittedIndex);
            }
            if (patchPlan.typeNeeds) {
                $set.submissionType = ADMIN_SUBMISSION_TYPE;
            }

            const result = await submissions.updateOne({ _id: submissionId }, { $set });

            stats.historyPatchOperations++;
            const matched = result.matchedCount ?? 0;
            const modified = result.modifiedCount ?? 0;
            stats.historyMatchedTotal += matched;
            stats.historyModifiedTotal += modified;

            const patchedParts = [];
            if (patchPlan.historyNeeds) {
                patchedParts.push('history (last Submitted)');
            }
            if (patchPlan.typeNeeds) {
                patchedParts.push(`submissionType=${ADMIN_SUBMISSION_TYPE}`);
            }
            console.log(`Patched ${patchedParts.join(', ')} ${submissionId} (status=${statusLabel})`);

            if (matched === 0) {
                stats.unmatchedWriteAttempts++;
                console.warn(
                    `Warning: update matched no documents for ${submissionId} (document may have changed).`
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
        await backfillSubmissionTypeAdmin3687(values, { logPath, configPath: values.config });
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
