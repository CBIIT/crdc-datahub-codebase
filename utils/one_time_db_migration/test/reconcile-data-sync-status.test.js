import assert from 'node:assert';
import { test, afterEach } from 'node:test';

import {
    reconcileDataSyncStatus,
    createS3Adapter,
    contentVerdict,
    parseLimit,
    parseCliArgs,
} from '../scripts/reconcile-data-sync-status.js';

/**
 * reconcileDataSyncStatus({ db, s3, apply, verifyOnly, submissionID, limit })
 *   -> { processed, written, recordsWritten, report: [{ submissionID, verdict, reason, destPrefix, reconciledAt }] }
 *
 * Writes `Succeeded` only when a source-to-copy comparison passes and only under `apply`. For each
 * verified type it inserts a DataSync record before updating the submission's status fields, so the
 * backend archive gate — which requires a record — can re-verify independently.
 *
 * The injected `s3` adapter keeps the AWS SDK out of these tests:
 *   s3.listCommonPrefixes(bucket)      -> string[]        top-level prefixes
 *   s3.listObjects(bucket, prefix)     -> {Key, Size, ETag}[]
 *   s3.headObjectChecksums(bucket, key) -> {etag, checksumType, checksums}
 */

const SUBMISSION_BUCKET = 'submission-bucket';
const METADATA_BUCKET = 'metadata-bucket';
const DM_BUCKET = 'dm-bucket';
const DATA_COMMONS = 'TestCommons';
const METADATA_PREFIX = '2026-01-02T03:04:05-sub-1';

/**
 * Listing entry. The default ETag derives from the size, so equal-size fixtures model a faithful
 * copy; pass an explicit ETag to model different content.
 */
const obj = (Key, Size, ETag = `"etag-${Size}"`) => ({ Key, Size, ETag });

/** Normalized HeadObject checksum metadata. */
const head = (checksums = {}, checksumType = null) => ({ etag: null, checksumType, checksums });

const filesSubmission = (overrides = {}) => ({
    _id: 'sub-1',
    status: 'Completed',
    dataType: 'Metadata and Data Files',
    dataCommons: DATA_COMMONS,
    studyID: 'study-1',
    bucketName: SUBMISSION_BUCKET,
    rootPath: 'submissions/sub-1',
    metadataDataSyncStatus: 'Not Started',
    fileDataSyncStatus: 'Not Started',
    ...overrides,
});

const metadataOnlySubmission = (overrides = {}) => ({
    _id: 'sub-1',
    status: 'Completed',
    dataType: 'Metadata Only',
    dataCommons: DATA_COMMONS,
    studyID: 'study-1',
    bucketName: SUBMISSION_BUCKET,
    rootPath: 'submissions/sub-1',
    metadataDataSyncStatus: 'Not Started',
    ...overrides,
});

/** Listings where both copies match their source. */
const matchingListings = () => ({
    [`${SUBMISSION_BUCKET}|submissions/sub-1/metadata/release`]: [obj('submissions/sub-1/metadata/release/study.tsv', 100)],
    [`${METADATA_BUCKET}|${METADATA_PREFIX}`]: [obj(`${METADATA_PREFIX}/study.tsv`, 100)],
    [`${SUBMISSION_BUCKET}|submissions/sub-1/file`]: [obj('submissions/sub-1/file/a.fastq', 500)],
    [`${DM_BUCKET}|study-1`]: [obj('study-1/a.fastq', 500)],
});

/**
 * Matches the subset of Mongo filter syntax these tests use.
 * @param {object} doc
 * @param {object} filter
 */
function matchesFilter(doc, filter) {
    return Object.entries(filter).every(([key, condition]) => {
        if (key === '$or') {
            return condition.some((branch) => matchesFilter(doc, branch));
        }
        if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
            if ('$exists' in condition) {
                return (doc[key] !== undefined) === condition.$exists;
            }
            if ('$in' in condition) {
                return condition.$in.includes(doc[key]);
            }
            if ('$ne' in condition) {
                return doc[key] !== condition.$ne;
            }
        }
        return doc[key] === condition;
    });
}

/**
 * @param {object} options
 * @param {object[]} [options.submissions]
 * @param {object|null} [options.dmBucketConfig]
 * @param {object|null} [options.metadataBucketConfig]
 * @param {object[]} [options.dataSyncRecords]
 */
function makeDb({
    submissions = [],
    dmBucketConfig = { type: 'DM_BUCKET_NAME', keys: { dm_bucket: DM_BUCKET } },
    metadataBucketConfig = { type: 'Metadata Bucket', dataCommons: DATA_COMMONS, bucketName: METADATA_BUCKET },
    dataSyncRecords = [],
} = {}) {
    const updates = [];
    const findFilters = [];
    const inserted = [];
    const writeOrder = [];
    const records = [...dataSyncRecords];

    return {
        updates,
        findFilters,
        inserted,
        writeOrder,
        records,
        collection(name) {
            if (name === 'submissions') {
                return {
                    find(filter) {
                        findFilters.push(filter);
                        return {
                            toArray: async () => submissions.filter((doc) => matchesFilter(doc, filter)),
                        };
                    },
                    async updateOne(filter, update) {
                        updates.push({ filter, update });
                        writeOrder.push('submission');
                        return { matchedCount: 1, modifiedCount: 1 };
                    },
                };
            }
            if (name === 'configuration') {
                return {
                    async findOne(filter) {
                        if (filter.type === 'DM_BUCKET_NAME') return dmBucketConfig;
                        if (filter.type === 'Metadata Bucket') return metadataBucketConfig;
                        return null;
                    },
                };
            }
            if (name === 'dataSync') {
                return {
                    async findOne(filter, queryOptions = {}) {
                        const matched = records.filter((doc) => matchesFilter(doc, filter));
                        if (queryOptions.sort?.startTime === -1) {
                            matched.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                        }
                        return matched[0] ?? null;
                    },
                    find(filter) {
                        return {
                            toArray: async () => records.filter((doc) => matchesFilter(doc, filter)),
                        };
                    },
                    async insertOne(doc) {
                        records.push(doc);
                        inserted.push(doc);
                        writeOrder.push('dataSync');
                        return { acknowledged: true, insertedId: doc._id };
                    },
                };
            }
            throw new Error(`unexpected collection: ${name}`);
        },
    };
}

/**
 * S3 double. Throws on an unknown `bucket|prefix` so a test cannot pass against a prefix the
 * production code never should have asked for.
 * @param {object} options
 * @param {string[]} [options.commonPrefixes]
 * @param {Record<string, object[]>} [options.listings] keyed by `bucket|prefix`
 */
function makeS3({ commonPrefixes = [`${METADATA_PREFIX}/`], listings = matchingListings(), heads = {} } = {}) {
    const listObjectCalls = [];
    const commonPrefixCalls = [];
    const headCalls = [];
    return {
        listObjectCalls,
        commonPrefixCalls,
        headCalls,
        get callCount() {
            return listObjectCalls.length + commonPrefixCalls.length + headCalls.length;
        },
        async headObjectChecksums(bucket, key) {
            const id = `${bucket}|${key}`;
            headCalls.push(id);
            if (!(id in heads)) {
                throw new Error(`unexpected head request: ${id}`);
            }
            return heads[id];
        },
        async listCommonPrefixes(bucket) {
            commonPrefixCalls.push(bucket);
            return commonPrefixes;
        },
        async listObjects(bucket, prefix) {
            const normalized = String(prefix).replace(/\/+$/, '');
            const key = `${bucket}|${normalized}`;
            listObjectCalls.push({ bucket, prefix: normalized });
            if (!(key in listings)) {
                throw new Error(`unexpected listing request: ${key}`);
            }
            return listings[key];
        },
    };
}

let restoreConsole = null;

function stubConsole() {
    const originals = { log: console.log, error: console.error, warn: console.warn, debug: console.debug };
    for (const key of Object.keys(originals)) {
        console[key] = () => {};
    }
    return () => Object.assign(console, originals);
}

afterEach(() => {
    if (restoreConsole) {
        restoreConsole();
        restoreConsole = null;
    }
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

test('selects Completed, unarchived submissions whose sync status is not Succeeded', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [] });

    await reconcileDataSyncStatus({ db, s3: makeS3() });

    assert.strictEqual(db.findFilters.length, 1);
    const filter = db.findFilters[0];
    assert.strictEqual(filter.status, 'Completed');
    assert.deepStrictEqual(filter.archived, { $ne: true });
    assert.ok(
        JSON.stringify(filter).includes('metadataDataSyncStatus'),
        'filter must constrain metadataDataSyncStatus'
    );
});

test('limits to one submission when submissionID is given', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), submissionID: 'sub-1' });

    assert.strictEqual(db.findFilters[0]._id, 'sub-1');
});

test('caps the number of submissions processed when limit is given', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [
            metadataOnlySubmission({ _id: 'sub-1' }),
            metadataOnlySubmission({ _id: 'sub-2' }),
            metadataOnlySubmission({ _id: 'sub-3' }),
        ],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), limit: 2 });

    assert.strictEqual(result.processed, 2);
});

// ---------------------------------------------------------------------------
// Destination discovery
// ---------------------------------------------------------------------------

test('uses the metadata bucket prefix ending in -<submissionID> when no dataSync record exists', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });
    const s3 = makeS3({
        commonPrefixes: ['2025-05-05T00:00:00-sub-other/', `${METADATA_PREFIX}/`],
    });

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.strictEqual(result.report[0].destPrefix, METADATA_PREFIX);
    assert.ok(
        s3.listObjectCalls.some((c) => c.bucket === METADATA_BUCKET && c.prefix === METADATA_PREFIX),
        'must list the matched destination prefix'
    );
});

test('uses the latest prefix when a submission was released more than once', async () => {
    restoreConsole = stubConsole();
    const latest = '2026-03-03T03:03:03-sub-1';
    const listings = matchingListings();
    listings[`${METADATA_BUCKET}|${latest}`] = [obj(`${latest}/study.tsv`, 100)];
    const db = makeDb({ submissions: [metadataOnlySubmission()] });
    const s3 = makeS3({ commonPrefixes: [`${latest}/`, `${METADATA_PREFIX}/`], listings });

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.strictEqual(result.report[0].destPrefix, latest);
});

test('records NoMetadataCopy and writes nothing when no prefix matches', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });
    const s3 = makeS3({ commonPrefixes: ['2025-05-05T00:00:00-sub-other/'] });

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.match(result.report[0].reason, /NoMetadataCopy/);
    assert.strictEqual(db.updates.length, 0);
});

test('records NoDestinationBucket and writes nothing when the data commons has no metadata bucket', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()], metadataBucketConfig: null });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.match(result.report[0].reason, /NoDestinationBucket/);
    assert.strictEqual(db.updates.length, 0);
});

test('lists a metadata bucket prefix set once per run, not once per submission', async () => {
    restoreConsole = stubConsole();
    const secondPrefix = '2026-01-02T03:04:06-sub-2';
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|submissions/sub-2/metadata/release`] = [obj('submissions/sub-2/metadata/release/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|${secondPrefix}`] = [obj(`${secondPrefix}/study.tsv`, 100)];
    const db = makeDb({
        submissions: [
            metadataOnlySubmission({ _id: 'sub-1' }),
            metadataOnlySubmission({ _id: 'sub-2', rootPath: 'submissions/sub-2' }),
        ],
    });
    const s3 = makeS3({ commonPrefixes: [`${METADATA_PREFIX}/`, `${secondPrefix}/`], listings });

    await reconcileDataSyncStatus({ db, s3 });

    assert.strictEqual(s3.commonPrefixCalls.length, 1);
});

// ---------------------------------------------------------------------------
// Existing dataSync records
// ---------------------------------------------------------------------------

test('uses an existing succeeded record\'s folders and does not scan the bucket', async () => {
    restoreConsole = stubConsole();
    const recordedTarget = 'recorded-target-folder';
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|recorded/source`] = [obj('recorded/source/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|${recordedTarget}`] = [obj(`${recordedTarget}/study.tsv`, 100)];
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [{
            _id: 'rec-1',
            submissionID: 'sub-1',
            type: 'metadata',
            status: 'Succeeded',
            sourceFolder: 'recorded/source',
            targetFolder: recordedTarget,
            startTime: '2026-01-01T00:00:00Z',
        }],
    });
    const s3 = makeS3({ listings });

    const result = await reconcileDataSyncStatus({ db, s3 });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(result.report[0].destPrefix, recordedTarget);
    assert.strictEqual(s3.commonPrefixCalls.length, 0);
});

test('ignores a Failed record and falls back to destination discovery', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [{
            _id: 'rec-failed',
            submissionID: 'sub-1',
            type: 'metadata',
            status: 'Failed',
            sourceFolder: 'bogus/source',
            targetFolder: 'bogus-target',
            startTime: '2026-01-01T00:00:00Z',
        }],
    });
    const s3 = makeS3();

    const result = await reconcileDataSyncStatus({ db, s3 });

    assert.strictEqual(result.report[0].destPrefix, METADATA_PREFIX);
    assert.ok(s3.commonPrefixCalls.length > 0, 'must fall back to discovery');
});

test('uses the record with the latest startTime when several succeeded', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|older/source`] = [obj('older/source/study.tsv', 100)];
    listings[`${SUBMISSION_BUCKET}|newer/source`] = [obj('newer/source/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|older-target`] = [obj('older-target/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|newer-target`] = [obj('newer-target/study.tsv', 100)];
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [
            {
                _id: 'rec-old', submissionID: 'sub-1', type: 'metadata', status: 'Succeeded',
                sourceFolder: 'older/source', targetFolder: 'older-target',
                startTime: '2026-01-01T00:00:00Z',
            },
            {
                _id: 'rec-new', submissionID: 'sub-1', type: 'metadata', status: 'Succeeded',
                sourceFolder: 'newer/source', targetFolder: 'newer-target',
                startTime: '2026-02-02T00:00:00Z',
            },
        ],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }) });

    assert.strictEqual(result.report[0].destPrefix, 'newer-target');
});

// ---------------------------------------------------------------------------
// Fail-closed guards
// ---------------------------------------------------------------------------

test('fails with MissingRootPath when rootPath is blank', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission({ rootPath: '   ' })] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.match(result.report[0].reason, /MissingRootPath/);
    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('fails with MissingRootPath when rootPath is absent', async () => {
    restoreConsole = stubConsole();
    const submission = metadataOnlySubmission();
    delete submission.rootPath;
    const db = makeDb({ submissions: [submission] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.match(result.report[0].reason, /MissingRootPath/);
    assert.strictEqual(db.updates.length, 0);
});

test('fails with EmptySourceListing rather than passing on an empty source prefix', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|submissions/sub-1/metadata/release`] = [];
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.match(result.report[0].reason, /EmptySourceListing/);
    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('reports an S3 error for one submission and continues to the next', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|submissions/sub-2/metadata/release`] = [obj('submissions/sub-2/metadata/release/study.tsv', 100)];
    const secondPrefix = '2026-01-02T03:04:06-sub-2';
    listings[`${METADATA_BUCKET}|${secondPrefix}`] = [obj(`${secondPrefix}/study.tsv`, 100)];
    // sub-1's destination listing is deliberately absent, so the double throws for it.
    delete listings[`${METADATA_BUCKET}|${METADATA_PREFIX}`];
    const db = makeDb({
        submissions: [
            metadataOnlySubmission({ _id: 'sub-1' }),
            metadataOnlySubmission({ _id: 'sub-2', rootPath: 'submissions/sub-2' }),
        ],
    });
    const s3 = makeS3({ commonPrefixes: [`${METADATA_PREFIX}/`, `${secondPrefix}/`], listings });

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.strictEqual(result.report.length, 2);
    assert.strictEqual(result.report[0].verdict, 'Failed');
    assert.match(result.report[0].reason, /error:/);
    assert.strictEqual(result.report[1].verdict, 'Passed');
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

test('sets only the metadata status for a passing Metadata Only submission', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.strictEqual(db.updates.length, 1);
    const { update } = db.updates[0];
    assert.strictEqual(update.$set.metadataDataSyncStatus, 'Succeeded');
    assert.ok(!('fileDataSyncStatus' in update.$set), 'must not write fileDataSyncStatus');
});

test('sets both statuses for a passing Metadata and Data Files submission', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.strictEqual(db.updates.length, 1);
    const { update } = db.updates[0];
    assert.strictEqual(update.$set.metadataDataSyncStatus, 'Succeeded');
    assert.strictEqual(update.$set.fileDataSyncStatus, 'Succeeded');
});

test('writes neither status when metadata passes but the data files differ', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 499)];
    const db = makeDb({ submissions: [filesSubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('writes nothing and records a reason when the comparison fails', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${METADATA_BUCKET}|${METADATA_PREFIX}`] = [];
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(result.report[0].verdict, 'Failed');
    assert.ok(result.report[0].reason, 'a failure must carry a reason');
});

test('writes only status fields and never updatedAt', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    const { update } = db.updates[0];
    assert.deepStrictEqual(Object.keys(update), ['$set']);
    assert.deepStrictEqual(
        Object.keys(update.$set).sort(),
        ['fileDataSyncStatus', 'metadataDataSyncStatus']
    );
    assert.ok(!JSON.stringify(update).includes('updatedAt'), 'must never write updatedAt');
});

test('writes nothing but still produces a report on the default dry run', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3() });

    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(result.report.length, 1);
    assert.strictEqual(result.report[0].verdict, 'Passed');
});

test('ignores folder placeholder keys on both sides of the comparison', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|submissions/sub-1/metadata/release`] = [
        obj('submissions/sub-1/metadata/release/', 0),
        obj('submissions/sub-1/metadata/release/study.tsv', 100),
    ];
    listings[`${METADATA_BUCKET}|${METADATA_PREFIX}`] = [
        obj(`${METADATA_PREFIX}/`, 0),
        obj(`${METADATA_PREFIX}/study.tsv`, 100),
    ];
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.updates.length, 1);
});

// ---------------------------------------------------------------------------
// DataSync record insertion (what unblocks the backend gate)
// ---------------------------------------------------------------------------

test('inserts one terminal DataSync record per verified type', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.strictEqual(db.inserted.length, 2);
    assert.strictEqual(result.recordsWritten, 2);
    assert.deepStrictEqual(db.inserted.map((r) => r.type).sort(), ['file', 'metadata']);
    for (const record of db.inserted) {
        assert.strictEqual(record.submissionID, 'sub-1');
        assert.strictEqual(record.status, 'Succeeded');
        assert.ok(record._id, 'record needs an _id');
        assert.ok(record.startTime instanceof Date, 'startTime is required by the schema');
        assert.ok(record.reconciledAt instanceof Date, 'provenance marker');
    }
});

test('the inserted record carries the folders that were actually compared', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    const metadata = db.inserted.find((r) => r.type === 'metadata');
    const file = db.inserted.find((r) => r.type === 'file');
    assert.strictEqual(metadata.sourceFolder, 'submissions/sub-1/metadata/release');
    assert.strictEqual(metadata.targetFolder, METADATA_PREFIX);
    assert.strictEqual(file.sourceFolder, 'submissions/sub-1/file');
    assert.strictEqual(file.targetFolder, 'study-1');
});

test('the inserted record carries no fields that would wake the validator monitor', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    const record = db.inserted[0];
    assert.ok(!('listPending' in record), 'listPending would make the monitor adopt the record');
    assert.ok(!('rollupPending' in record), 'rollupPending would make the monitor adopt the record');
    assert.ok(!('cleanupAfter' in record), 'cleanupAfter would make the monitor adopt the record');
    assert.ok(!('taskArn' in record), 'no AWS transfer was involved');
});

test('inserts the DataSync record before updating the submission status', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.deepStrictEqual(db.writeOrder, ['dataSync', 'submission']);
});

test('inserts no DataSync record when the comparison fails', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${METADATA_BUCKET}|${METADATA_PREFIX}`] = [];
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(db.inserted.length, 0);
});

test('inserts no DataSync record on a dry run', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3() });

    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(result.recordsWritten, 0);
});

test('does not duplicate a record it already inserted on a previous run', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });
    await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.strictEqual(db.inserted.length, 1);
});

test('does not overwrite an existing succeeded record written by the validator', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|recorded/source`] = [obj('recorded/source/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|recorded-target`] = [obj('recorded-target/study.tsv', 100)];
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [{
            _id: 'rec-real',
            submissionID: 'sub-1',
            type: 'metadata',
            status: 'Succeeded',
            sourceFolder: 'recorded/source',
            targetFolder: 'recorded-target',
            startTime: '2026-01-01T00:00:00Z',
        }],
    });

    await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(db.records.length, 1);
    assert.strictEqual(db.records[0]._id, 'rec-real');
});

// ---------------------------------------------------------------------------
// verify-only mode
// ---------------------------------------------------------------------------

test('verify-only re-checks previously reconciled submissions and writes nothing', async () => {
    restoreConsole = stubConsole();
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|recorded/source`] = [obj('recorded/source/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|recorded-target`] = [obj('recorded-target/study.tsv', 100)];
    const db = makeDb({
        submissions: [metadataOnlySubmission({ metadataDataSyncStatus: 'Succeeded' })],
        dataSyncRecords: [{
            _id: 'rec-synthetic',
            submissionID: 'sub-1',
            type: 'metadata',
            status: 'Succeeded',
            sourceFolder: 'recorded/source',
            targetFolder: 'recorded-target',
            startTime: new Date('2026-01-01T00:00:00Z'),
            reconciledAt: new Date('2026-01-01T00:00:00Z'),
        }],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), verifyOnly: true });

    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('verify-only ignores submissions that were never reconciled', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), verifyOnly: true });

    assert.strictEqual(result.processed, 0);
});

// ---------------------------------------------------------------------------
// S3 adapter
// ---------------------------------------------------------------------------

/**
 * Minimal stand-in for the AWS SDK: records the inputs each command was built with and
 * replays a fixed sequence of responses.
 * @param {object[]} responses
 */
function makeAwsDouble(responses) {
    const commands = [];
    let index = 0;
    const ListObjectsV2Command = function (input) {
        commands.push(input);
        return { input };
    };
    const client = {
        async send() {
            return responses[index++];
        },
    };
    return { client, ListObjectsV2Command, commands };
}

test('the S3 adapter pages through every object', async () => {
    const aws = makeAwsDouble([
        { Contents: [{ Key: 'study-1/a.txt', Size: 1 }], IsTruncated: true, NextContinuationToken: 't1' },
        { Contents: [{ Key: 'study-1/b.txt', Size: 2 }], IsTruncated: false },
    ]);
    const adapter = createS3Adapter(aws);

    const objects = await adapter.listObjects('dm-bucket', 'study-1');

    assert.deepStrictEqual(objects, [
        { Key: 'study-1/a.txt', Size: 1, ETag: undefined },
        { Key: 'study-1/b.txt', Size: 2, ETag: undefined },
    ]);
    assert.strictEqual(aws.commands[0].Prefix, 'study-1/');
    assert.strictEqual(aws.commands[1].ContinuationToken, 't1');
});

test('the S3 adapter pages through every common prefix with a delimiter', async () => {
    const aws = makeAwsDouble([
        { CommonPrefixes: [{ Prefix: 'a-sub-1/' }], IsTruncated: true, NextContinuationToken: 't1' },
        { CommonPrefixes: [{ Prefix: 'b-sub-2/' }], IsTruncated: false },
    ]);
    const adapter = createS3Adapter(aws);

    const prefixes = await adapter.listCommonPrefixes('metadata-bucket');

    assert.deepStrictEqual(prefixes, ['a-sub-1/', 'b-sub-2/']);
    assert.strictEqual(aws.commands[0].Delimiter, '/');
});

test('the S3 adapter tolerates an empty listing', async () => {
    const aws = makeAwsDouble([{ IsTruncated: false }]);
    const adapter = createS3Adapter(aws);

    assert.deepStrictEqual(await adapter.listObjects('dm-bucket', 'study-1'), []);
});

test('the S3 adapter keeps the ETag from the listing', async () => {
    const aws = makeAwsDouble([
        { Contents: [{ Key: 'study-1/a.txt', Size: 1, ETag: '"abc"' }], IsTruncated: false },
    ]);
    const adapter = createS3Adapter(aws);

    const objects = await adapter.listObjects('dm-bucket', 'study-1');

    assert.deepStrictEqual(objects, [{ Key: 'study-1/a.txt', Size: 1, ETag: '"abc"' }]);
});

test('the S3 adapter requests checksum mode and maps the stored checksums', async () => {
    const commands = [];
    const HeadObjectCommand = function (input) {
        commands.push(input);
        return { input };
    };
    const client = {
        async send() {
            return {
                ETag: '"abc-2"',
                ChecksumCRC64NVME: 'n==',
                ChecksumCRC32: 'c==',
                ChecksumType: 'FULL_OBJECT',
                ContentLength: 5,
            };
        },
    };
    const adapter = createS3Adapter({ client, ListObjectsV2Command: function () {}, HeadObjectCommand });

    const meta = await adapter.headObjectChecksums('dm-bucket', 'study-1/a.fastq');

    assert.deepStrictEqual(commands, [{ Bucket: 'dm-bucket', Key: 'study-1/a.fastq', ChecksumMode: 'ENABLED' }]);
    assert.deepStrictEqual(meta, {
        etag: 'abc-2',
        checksumType: 'FULL_OBJECT',
        checksums: { CRC64NVME: 'n==', CRC32: 'c==' },
    });
});

test('the S3 adapter reports no checksums for an object stored without one', async () => {
    const client = { async send() { return { ETag: '"e"' }; } };
    const adapter = createS3Adapter({ client, ListObjectsV2Command: function () {}, HeadObjectCommand: function () {} });

    const meta = await adapter.headObjectChecksums('b', 'k');

    assert.deepStrictEqual(meta, { etag: 'e', checksumType: null, checksums: {} });
});

// ---------------------------------------------------------------------------
// Content equality (review finding: same-size overwrite of a shared study key)
// ---------------------------------------------------------------------------

/**
 * contentVerdict decision table. KEEP IN SYNC with the copy in
 * apps/backend/test/utility/synced-copy-compare.test.js: this script duplicates the backend rule
 * (ESM cannot import the CommonJS module), and these shared vectors keep the two from drifting.
 */
const CONTENT_VERDICT_VECTORS = [
    { name: 'equal ETags', source: { etag: 'abc' }, dest: { etag: 'abc' }, verdict: 'equal' },
    { name: 'equal ETags, quoting differs', source: { etag: '"abc"' }, dest: { etag: 'abc' }, verdict: 'equal' },
    { name: 'different ETags, no checksums', source: { etag: 'a' }, dest: { etag: 'b' }, verdict: 'unknown' },
    { name: 'no metadata at all', source: {}, dest: {}, verdict: 'unknown' },
    { name: 'full-object CRC64NVME equal', source: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, verdict: 'equal' },
    { name: 'full-object CRC64NVME different', source: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC64NVME: 'y' }, checksumType: 'FULL_OBJECT' }, verdict: 'different' },
    { name: 'full-object inferred from missing suffix, different', source: { checksums: { SHA256: 'x' } }, dest: { checksums: { SHA256: 'y' } }, verdict: 'different' },
    { name: 'checksum on one side only', source: { checksums: { CRC64NVME: 'x' } }, dest: {}, verdict: 'unknown' },
    { name: 'different algorithms', source: { checksums: { CRC32: 'x' } }, dest: { checksums: { CRC64NVME: 'x' } }, verdict: 'unknown' },
    { name: 'composite equal', source: { checksums: { CRC32: 'x-3' } }, dest: { checksums: { CRC32: 'x-3' } }, verdict: 'equal' },
    { name: 'composite different', source: { checksums: { CRC32: 'x-3' } }, dest: { checksums: { CRC32: 'y-4' } }, verdict: 'unknown' },
    { name: 'explicit COMPOSITE type, different', source: { checksums: { CRC32C: 'x' }, checksumType: 'COMPOSITE' }, dest: { checksums: { CRC32C: 'y' }, checksumType: 'COMPOSITE' }, verdict: 'unknown' },
    { name: 'full-object vs composite', source: { checksums: { CRC32: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC32: 'x-3' } }, verdict: 'unknown' },
    { name: 'CRC64NVME preferred over a differing composite CRC32', source: { checksums: { CRC64NVME: 'n', CRC32: 'a-2' } }, dest: { checksums: { CRC64NVME: 'n', CRC32: 'b-3' } }, verdict: 'equal' },
    { name: 'equal ETags win over differing checksums', source: { etag: 'e', checksums: { CRC64NVME: 'x' } }, dest: { etag: 'e', checksums: { CRC64NVME: 'y' } }, verdict: 'equal' },
];

for (const { name, source, dest, verdict } of CONTENT_VERDICT_VECTORS) {
    test(`contentVerdict: ${name} -> ${verdict}`, () => {
        assert.strictEqual(contentVerdict(source, dest).verdict, verdict);
    });
}

/** Files submission whose data file has the same size at the destination but a different ETag. */
function overwrittenStudyKey(sourceHead, destHead) {
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|submissions/sub-1/file`] = [obj('submissions/sub-1/file/a.fastq', 500, '"original"')];
    listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 500, '"overwritten"')];
    return makeS3({
        listings,
        heads: {
            [`${SUBMISSION_BUCKET}|submissions/sub-1/file/a.fastq`]: sourceHead,
            [`${DM_BUCKET}|study-1/a.fastq`]: destHead,
        },
    });
}

test('fails and writes nothing when a later submission overwrote the shared study key with same-length bytes', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });
    const s3 = overwrittenStudyKey(
        head({ CRC64NVME: 'orig==' }, 'FULL_OBJECT'),
        head({ CRC64NVME: 'new==' }, 'FULL_OBJECT'),
    );

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.strictEqual(result.report[0].verdict, 'Failed');
    assert.match(result.report[0].reason, /^file content mismatch for a\.fastq \(CRC64NVME\)$/);
    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('passes when ETags differ but the full-object checksums are equal', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });
    const s3 = overwrittenStudyKey(
        head({ CRC64NVME: 'same==' }, 'FULL_OBJECT'),
        head({ CRC64NVME: 'same==' }, 'FULL_OBJECT'),
    );

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.deepStrictEqual(s3.headCalls, [
        `${SUBMISSION_BUCKET}|submissions/sub-1/file/a.fastq`,
        `${DM_BUCKET}|study-1/a.fastq`,
    ]);
});

test('fails as ContentUnverifiable and writes nothing when equality cannot be established', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });
    const s3 = overwrittenStudyKey(head(), head());

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.match(result.report[0].reason, /^file ContentUnverifiable for a\.fastq$/);
    assert.strictEqual(db.updates.length, 0);
    assert.strictEqual(db.inserted.length, 0);
});

test('makes no HeadObject calls when every ETag matches', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });
    const s3 = makeS3();

    await reconcileDataSyncStatus({ db, s3 });

    assert.deepStrictEqual(s3.headCalls, []);
});

test('reports a HeadObject error as a failure and writes nothing', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [filesSubmission()] });
    const s3 = overwrittenStudyKey(head(), head());
    s3.headObjectChecksums = async () => {
        throw new Error('AccessDenied');
    };

    const result = await reconcileDataSyncStatus({ db, s3, apply: true });

    assert.match(result.report[0].reason, /error: AccessDenied/);
    assert.strictEqual(db.updates.length, 0);
});

// ---------------------------------------------------------------------------
// --limit validation (review finding: negative / partial values)
// ---------------------------------------------------------------------------

for (const raw of ['-1', '1.5', '1oops', '', ' 1', '1 ', '+1', '1e3', '0x10', '9007199254740993', 'abc']) {
    test(`parseLimit rejects ${JSON.stringify(raw)}`, () => {
        assert.throws(() => parseLimit(raw), /--limit must be a non-negative integer/);
    });
}

for (const [raw, expected] of [['0', 0], ['5', 5], ['007', 7], [undefined, undefined]]) {
    test(`parseLimit accepts ${JSON.stringify(raw)}`, () => {
        assert.strictEqual(parseLimit(raw), expected);
    });
}

test('parseCliArgs rejects --apply --limit=-1', () => {
    assert.throws(() => parseCliArgs(['--apply', '--limit=-1']), /--limit must be a non-negative integer/);
});

test('parseCliArgs rejects --apply with --verify-only', () => {
    assert.throws(() => parseCliArgs(['--apply', '--verify-only']), /mutually exclusive/);
});

test('parseCliArgs returns the parsed options', () => {
    assert.deepStrictEqual(parseCliArgs(['--apply', '--limit', '3', '--submission', 'sub-1']), {
        apply: true,
        verifyOnly: false,
        submissionID: 'sub-1',
        limit: 3,
        report: undefined,
        output: undefined,
    });
});

for (const limit of [-1, 1.5, Number.NaN, '2']) {
    test(`reconcileDataSyncStatus rejects limit ${String(limit)} before touching the database`, async () => {
        const db = makeDb({ submissions: [metadataOnlySubmission()] });
        const s3 = makeS3();

        await assert.rejects(
            reconcileDataSyncStatus({ db, s3, apply: true, limit }),
            /limit must be a non-negative integer/
        );
        assert.strictEqual(db.findFilters.length, 0);
        assert.strictEqual(db.updates.length, 0);
        assert.strictEqual(s3.callCount, 0);
    });
}

test('limit 0 processes nothing', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({ submissions: [metadataOnlySubmission()] });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true, limit: 0 });

    assert.strictEqual(result.processed, 0);
    assert.strictEqual(db.updates.length, 0);
});

// ---------------------------------------------------------------------------
// Latest record regardless of status (review finding: newer Failed shadows older Succeeded)
// ---------------------------------------------------------------------------

const OLD_SUCCEEDED = {
    _id: 'rec-old-ok',
    submissionID: 'sub-1',
    type: 'metadata',
    status: 'Succeeded',
    sourceFolder: 'recorded/source',
    targetFolder: 'recorded-target',
    startTime: new Date('2026-01-01T00:00:00Z'),
};

const NEW_FAILED = {
    _id: 'rec-new-failed',
    submissionID: 'sub-1',
    type: 'metadata',
    status: 'Failed',
    sourceFolder: 'failed/source',
    targetFolder: 'failed-target',
    startTime: new Date('2026-02-01T00:00:00Z'),
};

/** Listings for the folders of OLD_SUCCEEDED; the Failed record's folders are deliberately absent. */
function recordedListings() {
    const listings = matchingListings();
    listings[`${SUBMISSION_BUCKET}|recorded/source`] = [obj('recorded/source/study.tsv', 100)];
    listings[`${METADATA_BUCKET}|recorded-target`] = [obj('recorded-target/study.tsv', 100)];
    return listings;
}

/**
 * What the backend archive gate reads: DataSyncDAO.findLatestBySubmissionIDAndType.
 * @param {object} db
 * @param {string} type
 */
function backendLatest(db, type) {
    return db.collection('dataSync').findOne({ submissionID: 'sub-1', type }, { sort: { startTime: -1 } });
}

test('older Succeeded + newer Failed: inserts a new Succeeded record that the backend gate reads as latest', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [OLD_SUCCEEDED, NEW_FAILED],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings: recordedListings() }), apply: true });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.inserted.length, 1);
    assert.strictEqual(db.updates.length, 1);
    const latest = await backendLatest(db, 'metadata');
    assert.strictEqual(latest.status, 'Succeeded');
    assert.strictEqual(latest._id, db.inserted[0]._id);
    assert.ok(latest.startTime > NEW_FAILED.startTime, 'new record must sort above the Failed one');
});

test('older Succeeded + newer Failed: compares the Succeeded record\'s folders, never the Failed record\'s', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [OLD_SUCCEEDED, NEW_FAILED],
    });
    const s3 = makeS3({ listings: recordedListings() });

    await reconcileDataSyncStatus({ db, s3, apply: true });

    const prefixes = s3.listObjectCalls.map((c) => c.prefix);
    assert.deepStrictEqual(prefixes, ['recorded/source', 'recorded-target']);
    assert.strictEqual(db.inserted[0].sourceFolder, 'recorded/source');
    assert.strictEqual(db.inserted[0].targetFolder, 'recorded-target');
});

test('older Succeeded + newer Failed: a failing comparison writes nothing, so the submission stays selectable', async () => {
    restoreConsole = stubConsole();
    const listings = recordedListings();
    listings[`${METADATA_BUCKET}|recorded-target`] = [];
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [OLD_SUCCEEDED, NEW_FAILED],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings }), apply: true });

    assert.strictEqual(result.report[0].verdict, 'Failed');
    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(db.updates.length, 0);
});

test('older Succeeded + newer Failed: a dry run passes but writes nothing', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [OLD_SUCCEEDED, NEW_FAILED],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings: recordedListings() }) });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(db.updates.length, 0);
});

test('latest Failed with no Succeeded record: discovers the copy and inserts a record on a pass', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [NEW_FAILED],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.inserted.length, 1);
    assert.strictEqual(db.inserted[0].targetFolder, METADATA_PREFIX);
    assert.strictEqual((await backendLatest(db, 'metadata')).status, 'Succeeded');
});

for (const [label, overrides] of [
    ['In Progress', { status: 'In Progress' }],
    ['listPending', { status: 'Succeeded', listPending: true }],
    ['rollupPending', { status: 'Failed', rollupPending: true }],
]) {
    test(`retains with ActiveTransfer, without S3 calls or writes, when the latest record is ${label}`, async () => {
        restoreConsole = stubConsole();
        const db = makeDb({
            submissions: [metadataOnlySubmission()],
            dataSyncRecords: [OLD_SUCCEEDED, { ...NEW_FAILED, ...overrides }],
        });
        const s3 = makeS3({ listings: recordedListings() });

        const result = await reconcileDataSyncStatus({ db, s3, apply: true });

        assert.strictEqual(result.report[0].verdict, 'Failed');
        assert.match(result.report[0].reason, /^metadata ActiveTransfer$/);
        assert.strictEqual(s3.callCount, 0);
        assert.strictEqual(db.inserted.length, 0);
        assert.strictEqual(db.updates.length, 0);
    });
}

test('a Failed record with only cleanupAfter set is not treated as an active transfer', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [metadataOnlySubmission()],
        dataSyncRecords: [OLD_SUCCEEDED, { ...NEW_FAILED, cleanupAfter: new Date('2026-03-01T00:00:00Z') }],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3({ listings: recordedListings() }), apply: true });

    assert.strictEqual(result.report[0].verdict, 'Passed');
    assert.strictEqual(db.inserted.length, 1);
});

test('per type: retains the file sync on an active transfer even when metadata verifies', async () => {
    restoreConsole = stubConsole();
    const db = makeDb({
        submissions: [filesSubmission()],
        dataSyncRecords: [{
            _id: 'rec-file-running', submissionID: 'sub-1', type: 'file', status: 'In Progress',
            sourceFolder: 'submissions/sub-1/file', targetFolder: 'study-1',
            startTime: new Date('2026-02-01T00:00:00Z'),
        }],
    });

    const result = await reconcileDataSyncStatus({ db, s3: makeS3(), apply: true });

    assert.match(result.report[0].reason, /^file ActiveTransfer$/);
    assert.strictEqual(db.inserted.length, 0);
    assert.strictEqual(db.updates.length, 0);
});

test('invariant: every rollup set to Succeeded has a latest-by-startTime Succeeded record per type', async () => {
    restoreConsole = stubConsole();
    const scenarios = [
        { submission: metadataOnlySubmission(), records: [] },
        { submission: metadataOnlySubmission(), records: [NEW_FAILED] },
        { submission: metadataOnlySubmission(), records: [OLD_SUCCEEDED, NEW_FAILED] },
        { submission: metadataOnlySubmission(), records: [OLD_SUCCEEDED] },
        { submission: filesSubmission(), records: [] },
        {
            submission: filesSubmission(),
            records: [
                OLD_SUCCEEDED,
                NEW_FAILED,
                { ...NEW_FAILED, _id: 'rec-file-failed', type: 'file' },
            ],
        },
    ];

    for (const { submission, records } of scenarios) {
        const db = makeDb({ submissions: [submission], dataSyncRecords: records.map((r) => ({ ...r })) });
        await reconcileDataSyncStatus({ db, s3: makeS3({ listings: recordedListings() }), apply: true });

        for (const { update } of db.updates) {
            const types = [];
            if (update.$set.metadataDataSyncStatus === 'Succeeded') types.push('metadata');
            if (update.$set.fileDataSyncStatus === 'Succeeded') types.push('file');
            for (const type of types) {
                const latest = await backendLatest(db, type);
                assert.strictEqual(
                    latest?.status,
                    'Succeeded',
                    `${submission.dataType} with records [${records.map((r) => r._id)}]: latest ${type} record must be Succeeded`
                );
            }
        }
        assert.strictEqual(db.updates.length, 1, `scenario [${records.map((r) => r._id)}] should reconcile`);
    }
});
