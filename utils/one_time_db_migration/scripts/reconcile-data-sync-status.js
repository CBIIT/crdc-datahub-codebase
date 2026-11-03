import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { openDatedConsoleFileMirror } from '../utilities/logging.js';
import { connectDatabaseFromEnv } from '../utilities/mongo.js';

dotenv.config();

const scriptPath = fileURLToPath(import.meta.url);

const COMPLETED = 'Completed';
const SUCCEEDED = 'Succeeded';
const IN_PROGRESS = 'In Progress';
const METADATA_ONLY = 'Metadata Only';
const METADATA_AND_DATA_FILES = 'Metadata and Data Files';
const METADATA_TYPE = 'metadata';
const FILE_TYPE = 'file';
const METADATA_BUCKET_TYPE = 'Metadata Bucket';
const DM_BUCKET_TYPE = 'DM_BUCKET_NAME';

/** Source subtree each DataSync type copies from, relative to the submission root. */
const SOURCE_SUFFIX = {
    [METADATA_TYPE]: 'metadata/release',
    [FILE_TYPE]: 'file'
};

const options = {
    apply: {
        type: 'boolean',
        default: false
    },
    'verify-only': {
        type: 'boolean',
        default: false
    },
    submission: {
        type: 'string'
    },
    limit: {
        type: 'string'
    },
    report: {
        type: 'string'
    },
    output: {
        type: 'string'
    }
};

/**
 * Relative object key under a prefix. Trailing slashes on the prefix are ignored.
 * @param {string} key Object key
 * @param {string} prefix Prefix to strip
 * @returns {string}
 */
function relativeKey(key, prefix) {
    const normalizedPrefix = String(prefix).replace(/\/+$/, '');
    const prefixWithSlash = `${normalizedPrefix}/`;
    if (key.startsWith(prefixWithSlash)) {
        return key.slice(prefixWithSlash.length);
    }
    if (key === normalizedPrefix) {
        return '';
    }
    return key;
}

/**
 * True for a zero-length "folder" marker object, which is not data.
 * @param {{Key: string}} object Listing entry
 * @returns {boolean}
 */
function isFolderPlaceholder(object) {
    return String(object.Key).endsWith('/');
}

/**
 * S3 additional-checksum algorithms, in the order they are tried. Mirrors CHECKSUM_ALGORITHMS in
 * apps/backend/utility/synced-copy-compare.js.
 */
const CHECKSUM_ALGORITHMS = ['CRC64NVME', 'SHA256', 'SHA1', 'CRC32C', 'CRC32'];

export const CONTENT_VERDICT = Object.freeze({
    EQUAL: 'equal',
    DIFFERENT: 'different',
    UNKNOWN: 'unknown',
});

/**
 * @param {string|undefined|null} etag
 * @returns {string|null} ETag without surrounding quotes, or null when absent
 */
function normalizeETag(etag) {
    if (etag == null) {
        return null;
    }
    const text = String(etag).trim().replace(/^"+|"+$/g, '');
    return text === '' ? null : text;
}

/**
 * True only when both ETags are present and identical — positive evidence of equal content.
 * Unequal ETags prove nothing (SSE-KMS, multipart part size), so callers fall through.
 * @param {string|undefined} a
 * @param {string|undefined} b
 * @returns {boolean}
 */
function etagsMatch(a, b) {
    const left = normalizeETag(a);
    const right = normalizeETag(b);
    return left !== null && left === right;
}

/**
 * @param {string} value Checksum value
 * @param {string|null|undefined} checksumType FULL_OBJECT, COMPOSITE, or absent
 * @returns {boolean} true when the value describes the whole object (composite values carry `-<parts>`)
 */
function isFullObjectChecksum(value, checksumType) {
    if (checksumType === 'FULL_OBJECT') {
        return true;
    }
    if (checksumType === 'COMPOSITE') {
        return false;
    }
    return !/-\d+$/.test(value);
}

/**
 * Decides whether two objects hold the same bytes from their ETags and stored checksums.
 *
 * DUPLICATE of contentVerdict in apps/backend/utility/synced-copy-compare.js (this ESM package
 * cannot import that CommonJS module). Both test suites carry the same vector table; change both
 * together.
 *
 * @param {{etag?: string|null, checksumType?: string|null, checksums?: Record<string, string>}} source
 * @param {{etag?: string|null, checksumType?: string|null, checksums?: Record<string, string>}} dest
 * @returns {{verdict: string, algorithm?: string}}
 */
export function contentVerdict(source = {}, dest = {}) {
    if (etagsMatch(source.etag, dest.etag)) {
        return { verdict: CONTENT_VERDICT.EQUAL };
    }
    for (const algorithm of CHECKSUM_ALGORITHMS) {
        const sourceValue = source.checksums?.[algorithm];
        const destValue = dest.checksums?.[algorithm];
        if (!sourceValue || !destValue) {
            continue;
        }
        const sourceFull = isFullObjectChecksum(sourceValue, source.checksumType);
        const destFull = isFullObjectChecksum(destValue, dest.checksumType);
        if (sourceFull !== destFull) {
            return { verdict: CONTENT_VERDICT.UNKNOWN, algorithm };
        }
        if (sourceValue === destValue) {
            return { verdict: CONTENT_VERDICT.EQUAL, algorithm };
        }
        return {
            verdict: sourceFull ? CONTENT_VERDICT.DIFFERENT : CONTENT_VERDICT.UNKNOWN,
            algorithm,
        };
    }
    return { verdict: CONTENT_VERDICT.UNKNOWN };
}

/**
 * Compares objects under a source prefix against a destination prefix. Every source object must
 * exist at the destination with an equal size AND provably equal content (contentVerdict: equal
 * ETags from the listing, else HeadObject checksums); extra destination objects are ignored.
 * Anything short of proven equality fails, so the submission is not reconciled.
 *
 * Mirrors apps/backend/utility/synced-copy-compare.js, with one deliberate difference: an empty
 * source listing is a FAILURE here, where the backend treats it as a pass. The backend's source
 * prefix comes from a recorded `sourceFolder`, so empty means an empty folder. This script may
 * derive the prefix from `rootPath`, so empty more likely means the prefix is wrong — and this
 * script's output authorises deletion. Do not "fix" the inconsistency without reading both.
 *
 * @param {object} s3 Injected S3 adapter
 * @param {string} sourceBucket Source bucket
 * @param {string} sourcePrefix Source prefix
 * @param {string} destBucket Destination bucket
 * @param {string} destPrefix Destination prefix
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function compareListings(s3, sourceBucket, sourcePrefix, destBucket, destPrefix) {
    if (!sourceBucket || !destBucket) {
        return { ok: false, reason: 'NoDestinationBucket' };
    }
    const sourceObjects = (await s3.listObjects(sourceBucket, sourcePrefix))
        .filter((object) => !isFolderPlaceholder(object));
    if (sourceObjects.length === 0) {
        return { ok: false, reason: `EmptySourceListing at ${sourcePrefix}` };
    }
    const destObjects = (await s3.listObjects(destBucket, destPrefix))
        .filter((object) => !isFolderPlaceholder(object));

    const destByRelative = new Map();
    for (const object of destObjects) {
        destByRelative.set(relativeKey(object.Key, destPrefix), object);
    }
    for (const object of sourceObjects) {
        const rel = relativeKey(object.Key, sourcePrefix);
        const destObject = destByRelative.get(rel);
        if (!destObject) {
            return { ok: false, reason: `missing destination object ${rel}` };
        }
        if (destObject.Size !== object.Size) {
            return { ok: false, reason: `size mismatch for ${rel}: source ${object.Size} dest ${destObject.Size}` };
        }
        if (etagsMatch(object.ETag, destObject.ETag)) {
            continue;
        }
        const sourceMeta = await s3.headObjectChecksums(sourceBucket, object.Key);
        const destMeta = await s3.headObjectChecksums(destBucket, destObject.Key);
        const { verdict, algorithm } = contentVerdict(sourceMeta, destMeta);
        if (verdict === CONTENT_VERDICT.DIFFERENT) {
            return { ok: false, reason: `content mismatch for ${rel} (${algorithm})` };
        }
        if (verdict !== CONTENT_VERDICT.EQUAL) {
            return { ok: false, reason: `ContentUnverifiable for ${rel}` };
        }
    }
    return { ok: true };
}

/**
 * Destination metadata prefix ending in `-<submissionID>`, without a trailing slash.
 * When a submission was released more than once the latest timestamp wins; the prefix format
 * `<ISO timestamp>-<submissionID>` sorts chronologically.
 * @param {string[]} commonPrefixes Top-level prefixes from the metadata bucket
 * @param {string} submissionID Submission ID
 * @returns {string|null}
 */
function findMetadataDestPrefix(commonPrefixes, submissionID) {
    const suffix = `-${submissionID}`;
    const matches = commonPrefixes
        .map((prefix) => String(prefix).replace(/\/+$/, ''))
        .filter((prefix) => prefix.endsWith(suffix))
        .sort();
    return matches.length > 0 ? matches[matches.length - 1] : null;
}

/**
 * Source prefix derived from the submission root. Returns null when `rootPath` is unusable, so
 * the caller fails rather than listing a prefix like `undefined/metadata/release` — which would
 * come back empty and look like a pass.
 * @param {object} submission Submission document
 * @param {string} type DataSync type
 * @returns {string|null}
 */
function deriveSourcePrefix(submission, type) {
    const rootPath = typeof submission.rootPath === 'string' ? submission.rootPath.trim() : '';
    if (!rootPath) {
        return null;
    }
    return `${rootPath.replace(/\/+$/, '')}/${SOURCE_SUFFIX[type]}`;
}

/**
 * Latest DataSync record of ANY status for a submission and type. This is exactly the backend's
 * `DataSyncDAO.findLatestBySubmissionIDAndType`, which the archive gate reads: whatever this
 * returns is what decides whether the submission can be archived.
 * @param {object} dataSyncCollection Mongo dataSync collection
 * @param {string} submissionID Submission ID
 * @param {string} type DataSync type
 * @returns {Promise<object|null>}
 */
async function latestRecord(dataSyncCollection, submissionID, type) {
    return dataSyncCollection.findOne(
        { submissionID, type },
        { sort: { startTime: -1 } }
    );
}

/**
 * Latest succeeded DataSync record — used only to find the folders of the last real copy. Records
 * that did not succeed are skipped: the export validator writes a Failed record carrying real
 * folder values when an export never reached the transfer, and those folders are not evidence of
 * a copy.
 * @param {object} dataSyncCollection Mongo dataSync collection
 * @param {string} submissionID Submission ID
 * @param {string} type DataSync type
 * @returns {Promise<object|null>}
 */
async function latestSucceededRecord(dataSyncCollection, submissionID, type) {
    return dataSyncCollection.findOne(
        { submissionID, type, status: SUCCEEDED },
        { sort: { startTime: -1 } }
    );
}

/**
 * True when the validator's monitor still owns the record, i.e. a transfer may still be moving
 * data (same criteria as `find_unfinished_data_syncs`, minus `cleanupAfter`: a cleanup time on a
 * finished record only means AWS resources are awaiting deletion, not that data is moving).
 * @param {object} record DataSync record
 * @returns {boolean}
 */
function isActiveRecord(record) {
    return record.status === IN_PROGRESS || record.listPending === true || record.rollupPending === true;
}

/**
 * Verifies one DataSync type for a submission against its destination copy.
 * @param {object} params
 * @returns {Promise<{ok: boolean, reason?: string, sourcePrefix?: string, destPrefix?: string|null}>}
 */
async function verifySyncType({ submission, type, collections, lookups, s3 }) {
    if (!submission.bucketName) {
        return { ok: false, reason: 'MissingSubmissionBucket' };
    }

    const latest = await latestRecord(collections.dataSync, submission._id, type);
    if (latest && isActiveRecord(latest)) {
        // Never reconcile over a transfer that is still running: its outcome will set the status.
        return { ok: false, reason: 'ActiveTransfer' };
    }
    // When the latest record is a terminal failure, compare against the last real copy (or
    // rediscover it), and on a pass insert a new record so the backend gate stops reading the
    // failure. Never use the failed record's own folders.
    const record = latest?.status === SUCCEEDED
        ? latest
        : await latestSucceededRecord(collections.dataSync, submission._id, type);
    const sourcePrefix = record?.sourceFolder || deriveSourcePrefix(submission, type);
    if (!sourcePrefix) {
        return { ok: false, reason: 'MissingRootPath' };
    }

    const destBucket = type === METADATA_TYPE
        ? await lookups.metadataBucket(submission.dataCommons)
        : await lookups.dmBucket();
    if (!destBucket) {
        return { ok: false, reason: 'NoDestinationBucket' };
    }

    let destPrefix = record?.targetFolder || null;
    if (!destPrefix) {
        if (type === METADATA_TYPE) {
            const commonPrefixes = await lookups.commonPrefixes(destBucket);
            destPrefix = findMetadataDestPrefix(commonPrefixes, submission._id);
            if (!destPrefix) {
                return { ok: false, reason: 'NoMetadataCopy' };
            }
        } else {
            destPrefix = submission.studyID;
            if (!destPrefix) {
                return { ok: false, reason: 'MissingStudyID' };
            }
        }
    }

    const compare = await compareListings(
        s3,
        submission.bucketName,
        sourcePrefix,
        destBucket,
        destPrefix
    );
    if (!compare.ok) {
        return { ok: false, reason: compare.reason, destPrefix };
    }
    return { ok: true, sourcePrefix, destPrefix };
}

/**
 * Inserts a terminal DataSync record for a verified copy, unless the latest record (any status)
 * is already Succeeded. The backend gate reads the latest record, not just the submission's rollup
 * status, so without this a reconciled submission would still be retained every night — including
 * when an older Succeeded record is shadowed by a newer Failed one. The new record's `startTime`
 * is now, so it becomes the latest.
 *
 * `listPending`, `rollupPending` and `cleanupAfter` are deliberately omitted: any of them would
 * make the export validator's monitor adopt this record (see find_unfinished_data_syncs). AWS ARN
 * fields are omitted because no transfer was involved.
 *
 * @param {object} dataSyncCollection Mongo dataSync collection
 * @param {object} params
 * @returns {Promise<boolean>} true when a record was inserted
 */
async function insertSyntheticRecord(dataSyncCollection, { submissionID, type, sourceFolder, targetFolder, now }) {
    const latest = await latestRecord(dataSyncCollection, submissionID, type);
    if (latest?.status === SUCCEEDED) {
        return false;
    }
    await dataSyncCollection.insertOne({
        _id: randomUUID(),
        submissionID,
        type,
        sourceFolder,
        targetFolder,
        status: SUCCEEDED,
        startTime: now,
        endTime: now,
        reconciledAt: now
    });
    return true;
}

/**
 * Submissions to process. Normal mode selects candidates failing the archive status criteria;
 * verify-only mode re-checks submissions this script previously reconciled.
 * @returns {Promise<object[]>}
 */
async function selectSubmissions({ collections, submissionID, limit, verifyOnly }) {
    let submissions;
    if (verifyOnly) {
        const reconciled = await collections.dataSync
            .find({ reconciledAt: { $exists: true } })
            .toArray();
        let ids = [...new Set(reconciled.map((record) => record.submissionID))];
        if (submissionID) {
            ids = ids.filter((id) => id === submissionID);
        }
        submissions = ids.length === 0
            ? []
            : await collections.submissions.find({ _id: { $in: ids } }).toArray();
    } else {
        const filter = {
            status: COMPLETED,
            archived: { $ne: true },
            $or: [
                { metadataDataSyncStatus: { $ne: SUCCEEDED } },
                { dataType: METADATA_AND_DATA_FILES, fileDataSyncStatus: { $ne: SUCCEEDED } },
            ],
        };
        if (submissionID) {
            filter._id = submissionID;
        }
        submissions = await collections.submissions.find(filter).toArray();
    }
    if (limit !== undefined) {
        submissions = submissions.slice(0, limit);
    }
    return submissions;
}

/**
 * Per-run caches so bucket listings and configuration lookups happen once, not once per
 * submission.
 * @param {object} configurationCollection Mongo configuration collection
 * @param {object} s3 Injected S3 adapter
 */
function createLookups(configurationCollection, s3) {
    const metadataBuckets = new Map();
    const commonPrefixes = new Map();
    let dmBucket;
    let dmBucketLoaded = false;

    return {
        async metadataBucket(dataCommons) {
            if (!metadataBuckets.has(dataCommons)) {
                const config = await configurationCollection.findOne({
                    type: METADATA_BUCKET_TYPE,
                    dataCommons,
                });
                metadataBuckets.set(dataCommons, config?.bucketName);
            }
            return metadataBuckets.get(dataCommons);
        },
        async dmBucket() {
            if (!dmBucketLoaded) {
                const config = await configurationCollection.findOne({ type: DM_BUCKET_TYPE });
                dmBucket = config?.keys?.dm_bucket;
                dmBucketLoaded = true;
            }
            return dmBucket;
        },
        async commonPrefixes(bucket) {
            if (!commonPrefixes.has(bucket)) {
                commonPrefixes.set(bucket, await s3.listCommonPrefixes(bucket));
            }
            return commonPrefixes.get(bucket);
        },
    };
}

/**
 * Reconciles submission DataSync rollup statuses against the S3 copies.
 *
 * Writes only when `apply` is true and the source-to-copy comparison passed. For each verified
 * type it inserts a DataSync record **before** updating the submission's status fields: the two
 * writes are not atomic, and in that order a partial failure leaves the submission still selected
 * on the next run, so it converges. The reverse order would drop it out of the selection filter
 * with no record and strand it permanently.
 *
 * Never writes `updatedAt` — that field drives the archive retention window.
 *
 * @param {object} params
 * @param {{collection: Function}} params.db Database handle
 * @param {{listCommonPrefixes: Function, listObjects: Function}} params.s3 Injected S3 adapter
 * @param {boolean} [params.apply=false] Persist updates when true
 * @param {boolean} [params.verifyOnly=false] Re-check previously reconciled submissions, never write
 * @param {string} [params.submissionID] Limit to one submission
 * @param {number} [params.limit] Maximum submissions to process
 * @returns {Promise<{processed: number, written: number, recordsWritten: number, report: object[]}>}
 */
export async function reconcileDataSyncStatus({
    db,
    s3,
    apply = false,
    verifyOnly = false,
    submissionID,
    limit,
} = {}) {
    if (limit !== undefined && !(Number.isSafeInteger(limit) && limit >= 0)) {
        throw new Error(`limit must be a non-negative integer, received ${JSON.stringify(limit)}`);
    }
    const collections = {
        submissions: db.collection('submissions'),
        configuration: db.collection('configuration'),
        dataSync: db.collection('dataSync'),
    };
    const lookups = createLookups(collections.configuration, s3);
    const persist = apply && !verifyOnly;

    const submissions = await selectSubmissions({ collections, submissionID, limit, verifyOnly });

    const report = [];
    let written = 0;
    let recordsWritten = 0;

    for (const submission of submissions) {
        const row = {
            submissionID: submission._id,
            verdict: 'Failed',
            reason: null,
            destPrefix: null,
            reconciledAt: null,
        };
        try {
            const types = [METADATA_TYPE];
            if (submission.dataType === METADATA_AND_DATA_FILES) {
                types.push(FILE_TYPE);
            } else if (submission.dataType !== METADATA_ONLY) {
                row.reason = `unsupported dataType ${submission.dataType}`;
                report.push(row);
                continue;
            }

            const verified = [];
            let failed = false;
            for (const type of types) {
                const result = await verifySyncType({ submission, type, collections, lookups, s3 });
                if (type === METADATA_TYPE) {
                    row.destPrefix = result.destPrefix ?? null;
                }
                if (!result.ok) {
                    row.reason = `${type} ${result.reason}`;
                    failed = true;
                    break;
                }
                verified.push({
                    type,
                    sourceFolder: result.sourcePrefix,
                    targetFolder: result.destPrefix,
                });
            }
            if (failed) {
                report.push(row);
                continue;
            }

            row.verdict = 'Passed';

            if (persist) {
                const now = new Date();
                // DataSync records first: see the ordering note on this function.
                for (const entry of verified) {
                    const inserted = await insertSyntheticRecord(collections.dataSync, {
                        submissionID: submission._id,
                        type: entry.type,
                        sourceFolder: entry.sourceFolder,
                        targetFolder: entry.targetFolder,
                        now,
                    });
                    if (inserted) {
                        recordsWritten += 1;
                    }
                }
                const $set = { metadataDataSyncStatus: SUCCEEDED };
                if (submission.dataType === METADATA_AND_DATA_FILES) {
                    $set.fileDataSyncStatus = SUCCEEDED;
                }
                await collections.submissions.updateOne({ _id: submission._id }, { $set });
                written += 1;
                row.reconciledAt = now.toISOString();
            }

            report.push(row);
        } catch (error) {
            row.verdict = 'Failed';
            row.reason = `error: ${error.message}`;
            report.push(row);
        }
    }

    return { processed: submissions.length, written, recordsWritten, report };
}

/**
 * S3 adapter over the AWS SDK. Listing methods paginate. The SDK is passed in rather than
 * imported here so the logic can be unit tested without installing it.
 * @param {object} params
 * @param {{send: Function}} params.client S3 client
 * @param {Function} params.ListObjectsV2Command Command constructor
 * @param {Function} [params.HeadObjectCommand] Command constructor (required for headObjectChecksums)
 * @returns {{listCommonPrefixes: Function, listObjects: Function, headObjectChecksums: Function}}
 */
export function createS3Adapter({ client, ListObjectsV2Command, HeadObjectCommand }) {
    return {
        async listCommonPrefixes(bucket) {
            const prefixes = [];
            let token;
            do {
                const response = await client.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Delimiter: '/',
                    ContinuationToken: token
                }));
                for (const entry of response.CommonPrefixes ?? []) {
                    prefixes.push(entry.Prefix);
                }
                token = response.IsTruncated ? response.NextContinuationToken : undefined;
            } while (token);
            return prefixes;
        },
        async listObjects(bucket, prefix) {
            const normalized = String(prefix).replace(/\/+$/, '');
            const objects = [];
            let token;
            do {
                const response = await client.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: `${normalized}/`,
                    ContinuationToken: token
                }));
                for (const entry of response.Contents ?? []) {
                    objects.push({ Key: entry.Key, Size: entry.Size, ETag: entry.ETag });
                }
                token = response.IsTruncated ? response.NextContinuationToken : undefined;
            } while (token);
            return objects;
        },
        async headObjectChecksums(bucket, key) {
            const response = await client.send(new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
                ChecksumMode: 'ENABLED'
            }));
            const checksums = {};
            for (const algorithm of CHECKSUM_ALGORITHMS) {
                const value = response[`Checksum${algorithm}`];
                if (value) {
                    checksums[algorithm] = value;
                }
            }
            return {
                etag: normalizeETag(response.ETag),
                checksumType: response.ChecksumType ?? null,
                checksums
            };
        }
    };
}

/**
 * Loads the AWS SDK on demand and builds the adapter plus a disposer.
 * @returns {Promise<{s3: object, destroy: () => void}>}
 */
async function createS3AdapterFromEnv() {
    const { S3Client, ListObjectsV2Command, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION });
    return {
        s3: createS3Adapter({ client, ListObjectsV2Command, HeadObjectCommand }),
        destroy: () => client.destroy()
    };
}

/** @param {unknown} value */
function csvCell(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {string} filePath
 * @param {object[]} report
 */
async function writeReport(filePath, report) {
    const header = 'Submission ID,Verdict,Reason,Destination Prefix,Reconciled At';
    const rows = report.map((row) => [
        csvCell(row.submissionID),
        csvCell(row.verdict),
        csvCell(row.reason),
        csvCell(row.destPrefix),
        csvCell(row.reconciledAt)
    ].join(','));
    await writeFile(filePath, `${[header, ...rows].join('\n')}\n`, 'utf8');
}

/**
 * @param {object} params
 */
function logRunConfig({ databaseName, apply, verifyOnly, submissionID, limit, logPath }) {
    let mode = 'dry run (no writes)';
    if (verifyOnly) {
        mode = 'verify only (re-check reconciled submissions, no writes)';
    } else if (apply) {
        mode = 'APPLY (writes DataSync records and status fields)';
    }
    console.log('======== Run configuration ========');
    console.log(`  Database:    ${databaseName}`);
    console.log(`  Mode:        ${mode}`);
    console.log(`  Submission:  ${submissionID ?? 'all candidates'}`);
    console.log(`  Limit:       ${limit ?? 'none'}`);
    console.log(`  Log file:    ${logPath ?? '(none)'}`);
    console.log('====================================');
}

/** @param {{processed: number, written: number, recordsWritten: number, report: object[]}} result */
function logSummary(result) {
    const passed = result.report.filter((row) => row.verdict === 'Passed').length;
    const failed = result.report.length - passed;
    console.log('-------- Summary --------');
    console.log(`  Processed:           ${result.processed}`);
    console.log(`  Passed comparison:   ${passed}`);
    console.log(`  Failed comparison:   ${failed}`);
    console.log(`  Submissions updated: ${result.written}`);
    console.log(`  DataSync records:    ${result.recordsWritten}`);
    console.log('-------------------------');
    for (const row of result.report.filter((r) => r.verdict === 'Failed')) {
        console.warn(`  Retained ${row.submissionID}: ${row.reason}`);
    }
}

/**
 * Parses `--limit`. The whole value must be decimal digits and a safe integer: `parseInt` would
 * accept `1.5` or `1oops`, and a negative cap would silently process every candidate.
 * @param {string|undefined} raw Raw option value
 * @returns {number|undefined}
 */
export function parseLimit(raw) {
    if (raw === undefined) {
        return undefined;
    }
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
        throw new Error(`--limit must be a non-negative integer, received ${JSON.stringify(raw)}`);
    }
    return value;
}

/**
 * Parses and validates the command line. Throws before anything is opened or connected.
 * @param {string[]} argv Arguments after the script path
 * @returns {{apply: boolean, verifyOnly: boolean, submissionID?: string, limit?: number, report?: string, output?: string}}
 */
export function parseCliArgs(argv) {
    const { values } = parseArgs({ args: argv, options, allowPositionals: true });
    const apply = values.apply;
    const verifyOnly = values['verify-only'];
    if (apply && verifyOnly) {
        throw new Error('--apply and --verify-only are mutually exclusive');
    }
    return {
        apply,
        verifyOnly,
        submissionID: values.submission,
        limit: parseLimit(values.limit),
        report: values.report,
        output: values.output,
    };
}

async function main() {
    const values = parseCliArgs(process.argv.slice(2));
    const { apply, verifyOnly, submissionID, limit } = values;

    let logPath;
    let endConsoleFileMirror = null;
    if (values.output) {
        const out = await openDatedConsoleFileMirror(values.output);
        endConsoleFileMirror = out.endConsoleFileMirror;
        logPath = out.logPath;
    }

    const s3Client = await createS3AdapterFromEnv();
    const { client, db } = await connectDatabaseFromEnv();
    let result = null;

    try {
        logRunConfig({ databaseName: db.databaseName, apply, verifyOnly, submissionID, limit, logPath });
        result = await reconcileDataSyncStatus({
            db,
            s3: s3Client.s3,
            apply,
            verifyOnly,
            submissionID,
            limit
        });
        logSummary(result);
        if (!apply && !verifyOnly) {
            console.log('Dry run: nothing was written. Re-run with --apply to persist.');
        }
    } finally {
        // Written here so a run that aborted partway still reports what it had already done.
        if (values.report && result) {
            await writeReport(values.report, result.report);
            console.log(`Report written to ${values.report}`);
        }
        await client.close();
        s3Client.destroy();
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
