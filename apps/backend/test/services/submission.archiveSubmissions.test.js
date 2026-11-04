jest.mock('sanitize-html', () => jest.fn((value) => value));
jest.mock('../../dao/submission');
jest.mock('../../dao/program');
jest.mock('../../dao/user');
jest.mock('../../dao/approvedStudy');
jest.mock('../../dao/validation');
jest.mock('../../dao/dataRecords');
jest.mock('../../dao/pendingPV');
jest.mock('../../services/user');
jest.mock('../../services/data-record-service');
jest.mock('../../services/batch-service');
jest.mock('../../services/user-initialization-service');
jest.mock('../../services/notify-user');
jest.mock('../../services/s3-service');
jest.mock('../../services/aws-request');
jest.mock('../../services/configurationService');
jest.mock('../../services/data-model-service');
jest.mock('../../services/authorization-service');
jest.mock('../../services/qc-result-service');
jest.mock('../../utility/data-commons-remapper', () => ({
    getDataCommonsDisplayNamesForSubmission: jest.fn(submission => submission),
    getDataCommonsDisplayNamesForListSubmissions: jest.fn(res => res),
}));
jest.mock('../../utility/validation-handler');
jest.mock('../../verifier/user-info-verifier');
jest.mock('../../verifier/submission-verifier');
jest.mock('../../domain/history-event');
jest.mock('../../domain/user-scope');

const { Submission } = require('../../services/submission');
const { DATA_TYPE, ACTIONS } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS, DATA_SYNC_TYPE } = require('../../constants/data-sync-constants');

/**
 * Units under test:
 *   _verifySyncedCopies(submission) -> {ok, reason}, never throws
 *   archiveSubmissions()            -> deletes only when verification passes,
 *                                      or when a manual archive approval is set
 */

const SUBMISSION_BUCKET = 'submission-bucket';
const METADATA_BUCKET = 'metadata-bucket';
const DM_BUCKET = 'dm-bucket';
const DATA_COMMONS = 'TestCommons';

const METADATA_TARGET = '2026-11-03T14:25:02-sub-1';
const METADATA_ONLY_TARGET = '2026-11-03T14:30:00-sub-2';

/** Listing entry. The default ETag derives from the size, so equal-size fixtures model a faithful copy. */
const obj = (Key, Size, ETag = `"etag-${Size}"`) => ({ Key, Size, ETag });

/** Normalized HeadObject checksum metadata. */
const head = (checksums = {}, checksumType = null, etag = null, size = null) => ({
    etag,
    checksumType,
    checksums,
    size,
});

const filesSubmission = () => ({
    _id: 'sub-1',
    dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
    dataCommons: DATA_COMMONS,
    studyID: 'study-1',
    bucketName: SUBMISSION_BUCKET,
    rootPath: 'submissions/sub-1',
    metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
    fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
});

/** Past-retention submission returned by the manual-verification worklist query. */
const legacyCandidate = (overrides = {}) => ({
    _id: 'sub-legacy',
    dataCommons: DATA_COMMONS,
    dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
    studyID: 'study-legacy',
    bucketName: SUBMISSION_BUCKET,
    rootPath: 'submissions/sub-legacy',
    updatedAt: new Date('2024-01-15T00:00:00.000Z'),
    ...overrides,
});

/** @returns {string[]} console.warn lines from the current test */
const warnLines = () => console.warn.mock.calls.map(([line]) => line);

const metadataOnlySubmission = () => ({
    _id: 'sub-2',
    dataType: DATA_TYPE.METADATA_ONLY,
    dataCommons: DATA_COMMONS,
    studyID: 'study-2',
    bucketName: SUBMISSION_BUCKET,
    rootPath: 'submissions/sub-2',
    metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
});

const metadataRecord = (overrides = {}) => ({
    type: DATA_SYNC_TYPE.METADATA,
    status: DATA_SYNC_STATUS.SUCCEEDED,
    sourceFolder: 'submissions/sub-1/metadata/release',
    targetFolder: METADATA_TARGET,
    ...overrides,
});

const fileRecord = (overrides = {}) => ({
    type: DATA_SYNC_TYPE.FILE,
    status: DATA_SYNC_STATUS.SUCCEEDED,
    sourceFolder: 'submissions/sub-1/file',
    targetFolder: 'study-1',
    ...overrides,
});

/** Listings where both the metadata and file copies match their source. */
const matchingListings = () => ({
    [`${SUBMISSION_BUCKET}|submissions/sub-1/metadata/release`]: [obj('submissions/sub-1/metadata/release/study.tsv', 100)],
    [`${METADATA_BUCKET}|${METADATA_TARGET}`]: [obj(`${METADATA_TARGET}/study.tsv`, 100)],
    [`${SUBMISSION_BUCKET}|submissions/sub-1/file`]: [obj('submissions/sub-1/file/a.fastq', 500)],
    [`${DM_BUCKET}|study-1`]: [obj('study-1/a.fastq', 500)],
});

/**
 * @param {{ETag?: string, Size: number}} entry S3 listing entry
 * @returns {{etag: string|null, size: number, checksumType: null, checksums: object}}
 */
function listingEntryToHead(entry) {
    let etag = null;
    if (entry.ETag != null) {
        const text = String(entry.ETag).trim().replace(/^"+|"+$/g, '');
        etag = text === '' ? null : text;
    }
    return { etag, size: entry.Size, checksumType: null, checksums: {} };
}

/**
 * Builds HeadObject fixtures from listing entries (source and destination objects).
 * @param {Record<string, object[]>} listings keyed by `bucket|prefix`
 * @returns {Record<string, object>}
 */
function headsFromListingEntries(listings) {
    const heads = {};
    for (const [bucketPrefix, objects] of Object.entries(listings)) {
        const bucket = bucketPrefix.split('|')[0];
        for (const object of objects) {
            heads[`${bucket}|${object.Key}`] = listingEntryToHead(object);
        }
    }
    return heads;
}

/**
 * s3Service double. Only source prefixes are listed. HeadObject lookups are keyed by `bucket|key`.
 * @param {Record<string, object[]>} listings keyed by `bucket|prefix`
 * @param {Record<string, object>} [heads] keyed by `bucket|key`
 */
function makeS3Service(listings, heads = {}) {
    const mergedHeads = { ...headsFromListingEntries(listings), ...heads };
    return {
        headObjectChecksums: jest.fn(async (bucket, key) => {
            const id = `${bucket}|${key}`;
            if (!(id in mergedHeads)) {
                const err = new Error('NotFound');
                err.code = 'NotFound';
                throw err;
            }
            return mergedHeads[id];
        }),
        listFileInDir: jest.fn(async (bucket, prefix) => {
            const key = `${bucket}|${String(prefix).replace(/\/+$/, '')}`;
            if (!(key in listings)) {
                throw new Error(`unexpected listing request: ${key}`);
            }
            return listings[key];
        }),
        deleteDirectory: jest.fn().mockResolvedValue(true),
    };
}

/**
 * Builds a Submission service with every collaborator this suite touches replaced by a double.
 */
function makeService() {
    const service = new Submission(
        { insert: jest.fn() },  // logCollection
        {},                     // submissionCollection
        {},                     // batchService
        {},                     // userService
        {},                     // programService
        {},                     // notificationService
        {},                     // dataRecordService
        jest.fn(),              // fetchDataModelInfo
        {},                     // awsService
        'metadata-queue',
        {},                     // s3Service
        {},                     // emailParams
        [DATA_COMMONS],         // dataCommonsList
        [],                     // hiddenDataCommonsList
        'sqs-loader-queue',
        {},                     // qcResultsService
        {},                     // uploaderCLIConfigs
        SUBMISSION_BUCKET,
        {},                     // configurationService
        {},                     // uploadingMonitor
        new Map(),              // dataCommonsBucketMap
        {},                     // authorizationService
        {},                     // dataModelService
        {},                     // dataSyncService
    );

    service.emailParams = { completedSubmissionDays: 30 };
    service.s3Service = makeS3Service(matchingListings());
    service.dataCommonsBucketMap = new Map([[DATA_COMMONS, METADATA_BUCKET]]);
    service.configurationService = {
        findByType: jest.fn().mockResolvedValue({ keys: { dm_bucket: DM_BUCKET } }),
    };
    service.dataSyncService = {
        findLatestBySubmissionIDAndType: jest.fn(async (_submissionID, type) => (
            type === DATA_SYNC_TYPE.METADATA ? metadataRecord() : fileRecord()
        )),
        findSubmissionIDsWithRecords: jest.fn().mockResolvedValue([]),
        findSubmissionIDsWithInProgressFileRecords: jest.fn().mockResolvedValue([]),
    };
    service.submissionDAO = {
        getToBeArchivedSubmissions: jest.fn().mockResolvedValue([]),
        getPastRetentionUnapprovedSubmissions: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
    };
    service.batchDAO = { deleteBatchesBySubmissionID: jest.fn().mockResolvedValue({}) };
    service.dataRecordService = { archiveMetadataByFilter: jest.fn().mockResolvedValue({}) };

    return service;
}

let service;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    service = makeService();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('_verifySyncedCopies', () => {

    it('passes for a Metadata Only submission whose metadata copy matches', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn(async () => metadataRecord({
            sourceFolder: 'submissions/sub-2/metadata/release',
            targetFolder: METADATA_ONLY_TARGET,
        }));
        service.s3Service = makeS3Service({
            [`${SUBMISSION_BUCKET}|submissions/sub-2/metadata/release`]: [obj('submissions/sub-2/metadata/release/study.tsv', 100)],
            [`${METADATA_BUCKET}|${METADATA_ONLY_TARGET}`]: [obj(`${METADATA_ONLY_TARGET}/study.tsv`, 100)],
        });

        const result = await service._verifySyncedCopies(metadataOnlySubmission());

        expect(result.ok).toBe(true);
    });

    it('does not compare data files for a Metadata Only submission', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn(async () => metadataRecord({
            sourceFolder: 'submissions/sub-2/metadata/release',
            targetFolder: METADATA_ONLY_TARGET,
        }));
        service.s3Service = makeS3Service({
            [`${SUBMISSION_BUCKET}|submissions/sub-2/metadata/release`]: [obj('submissions/sub-2/metadata/release/study.tsv', 100)],
            [`${METADATA_BUCKET}|${METADATA_ONLY_TARGET}`]: [obj(`${METADATA_ONLY_TARGET}/study.tsv`, 100)],
        });

        await service._verifySyncedCopies(metadataOnlySubmission());

        const bucketsListed = service.s3Service.listFileInDir.mock.calls.map(([bucket]) => bucket);
        expect(bucketsListed).not.toContain(DM_BUCKET);
        expect(service.dataSyncService.findLatestBySubmissionIDAndType)
            .not.toHaveBeenCalledWith(expect.anything(), DATA_SYNC_TYPE.FILE);
    });

    it('passes for Metadata and Data Files when both copies match', async () => {
        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(true);
    });

    it('fails and identifies the file sync when the data file copy differs', async () => {
        const listings = matchingListings();
        listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 499)];
        service.s3Service = makeS3Service(listings);

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringMatching(/file/i));
    });

    it('fails and identifies the metadata sync when the metadata copy differs', async () => {
        const listings = matchingListings();
        listings[`${METADATA_BUCKET}|${METADATA_TARGET}`] = [];
        service.s3Service = makeS3Service(listings);

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringMatching(/metadata/i));
    });

    it('fails when a later submission overwrote the shared study key with same-length different bytes', async () => {
        const listings = matchingListings();
        listings[`${SUBMISSION_BUCKET}|submissions/sub-1/file`] = [obj('submissions/sub-1/file/a.fastq', 500, '"original"')];
        listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 500, '"overwritten"')];
        service.s3Service = makeS3Service(listings, {
            [`${SUBMISSION_BUCKET}|submissions/sub-1/file/a.fastq`]: head({ CRC64NVME: 'orig==' }, 'FULL_OBJECT', null, 500),
            [`${DM_BUCKET}|study-1/a.fastq`]: head({ CRC64NVME: 'new==' }, 'FULL_OBJECT', null, 500),
        });

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result).toEqual({ ok: false, reason: expect.stringContaining('file content mismatch for a.fastq') });
    });

    it('fails as unverifiable when content equality cannot be established', async () => {
        const listings = matchingListings();
        listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 500, '"multipart-etag-2"')];
        service.s3Service = makeS3Service(listings, {
            [`${SUBMISSION_BUCKET}|submissions/sub-1/file/a.fastq`]: head({}, null, 'source-etag', 500),
            [`${DM_BUCKET}|study-1/a.fastq`]: head({}, null, 'dest-etag', 500),
        });

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result).toEqual({ ok: false, reason: expect.stringContaining('file ContentUnverifiable for a.fastq') });
    });

    it('fails rather than throwing when HeadObject rejects', async () => {
        const listings = matchingListings();
        listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 500, '"different"')];
        service.s3Service = makeS3Service(listings);
        service.s3Service.headObjectChecksums.mockRejectedValue(new Error('AccessDenied: kms:Decrypt'));

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result).toEqual({ ok: false, reason: expect.stringContaining('AccessDenied') });
    });

    it('fails when no dataSync record exists for a required type', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockResolvedValue(null);

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('NoDataSyncRecord'));
    });

    it('makes no S3 calls when the dataSync record is missing', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockResolvedValue(null);

        await service._verifySyncedCopies(filesSubmission());

        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it.each([
        DATA_SYNC_STATUS.FAILED,
        DATA_SYNC_STATUS.IN_PROGRESS,
        DATA_SYNC_STATUS.NOT_STARTED,
    ])('fails without listing when the dataSync record status is %s', async (status) => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn()
            .mockResolvedValue(metadataRecord({ status }));

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it.each([
        ['sourceFolder', { sourceFolder: '' }],
        ['sourceFolder', { sourceFolder: undefined }],
        ['targetFolder', { targetFolder: '' }],
        ['targetFolder', { targetFolder: undefined }],
    ])('fails without listing when the dataSync record has no %s', async (_field, overrides) => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn()
            .mockResolvedValue(metadataRecord(overrides));

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it('fails with NoDestinationBucket when the data commons has no metadata bucket', async () => {
        service.dataCommonsBucketMap = new Map();

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('NoDestinationBucket'));
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it('fails with NoDestinationBucket when the DM bucket config is missing', async () => {
        service.configurationService.findByType = jest.fn().mockResolvedValue(null);

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('NoDestinationBucket'));
    });

    it('never lists with an undefined bucket when the DM bucket does not resolve', async () => {
        service.configurationService.findByType = jest.fn().mockResolvedValue({ keys: {} });

        await service._verifySyncedCopies(filesSubmission());

        const bucketsListed = service.s3Service.listFileInDir.mock.calls.map(([bucket]) => bucket);
        expect(bucketsListed).not.toContain(undefined);
    });

    it('fails when the submission has no bucketName', async () => {
        const result = await service._verifySyncedCopies({ ...filesSubmission(), bucketName: undefined });

        expect(result.ok).toBe(false);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it('returns a reason on every failure path', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockRejectedValue(new Error('boom'));

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toBeTruthy();
    });

    it('fails rather than throwing when an S3 listing rejects', async () => {
        service.s3Service.listFileInDir = jest.fn().mockRejectedValue(new Error('AccessDenied'));

        const result = await service._verifySyncedCopies(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('AccessDenied'));
    });

});

describe('archiveSubmissions', () => {

    it('archives the submission when verification passes', async () => {
        const submission = filesSubmission();
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([submission]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.dataRecordService.archiveMetadataByFilter).toHaveBeenCalledWith({ submissionID: 'sub-1' });
        expect(service.batchDAO.deleteBatchesBySubmissionID).toHaveBeenCalledWith('sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
    });

    it('does not delete the S3 directory when verification fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: false, reason: 'size mismatch' });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('does not archive records or delete batches when verification fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: false, reason: 'size mismatch' });

        await service.archiveSubmissions();

        expect(service.dataRecordService.archiveMetadataByFilter).not.toHaveBeenCalled();
        expect(service.batchDAO.deleteBatchesBySubmissionID).not.toHaveBeenCalled();
    });

    it('does not mark the submission archived when verification fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: false, reason: 'size mismatch' });

        await service.archiveSubmissions();

        expect(service.submissionDAO.update).not.toHaveBeenCalled();
    });

    it('verifies a Metadata Only submission rather than exempting it', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([metadataOnlySubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._verifySyncedCopies).toHaveBeenCalledWith(expect.objectContaining({ _id: 'sub-2' }));
    });

    it('verifies before deleting anything', async () => {
        const order = [];
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn(async () => {
            order.push('verify');
            return { ok: true };
        });
        service.s3Service.deleteDirectory = jest.fn(async () => {
            order.push('delete');
            return true;
        });

        await service.archiveSubmissions();

        expect(order).toEqual(['verify', 'delete']);
    });

    it('names the retained submission in the summary when verification fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: false, reason: 'size mismatch' });

        const summary = await service.archiveSubmissions();

        expect(summary).toEqual(expect.stringContaining('sub-1'));
        expect(summary).not.toEqual('successful!');
    });

    it('distinguishes a failed comparison from a failed S3 delete in the summary', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: false, reason: 'size mismatch' });

        const comparisonSummary = await service.archiveSubmissions();

        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });
        service.s3Service.deleteDirectory = jest.fn().mockRejectedValue(new Error('access denied'));

        const deleteSummary = await service.archiveSubmissions();

        expect(comparisonSummary).not.toEqual(deleteSummary);
    });

    it('reports success when every candidate is archived', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');
    });

    it('skips a candidate that does not meet the data sync status criteria', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
        }]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('retains the source when the shared study copy was overwritten with different content', async () => {
        const listings = matchingListings();
        listings[`${DM_BUCKET}|study-1`] = [obj('study-1/a.fastq', 500, '"overwritten"')];
        service.s3Service = makeS3Service(listings, {
            [`${SUBMISSION_BUCKET}|submissions/sub-1/file/a.fastq`]: head({ CRC64NVME: 'orig==' }, 'FULL_OBJECT', null, 500),
            [`${DM_BUCKET}|study-1/a.fastq`]: head({ CRC64NVME: 'new==' }, 'FULL_OBJECT', null, 500),
        });
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);

        const summary = await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
        expect(summary).toEqual(expect.stringContaining('data retained for submission(s): sub-1'));
    });

    it('skips an already-archived candidate without verifying, deleting, or reporting it', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), archived: true },
        ]);
        const verify = jest.spyOn(service, '_verifySyncedCopies');

        const summary = await service.archiveSubmissions();

        expect(verify).not.toHaveBeenCalled();
        expect(service.dataSyncService.findLatestBySubmissionIDAndType).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.headObjectChecksums).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
        expect(summary).toEqual('successful!');
    });

    it('still archives the other candidates when one is already archived', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), _id: 'sub-old', rootPath: 'submissions/sub-old', archived: true },
            filesSubmission(),
        ]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._verifySyncedCopies).toHaveBeenCalledTimes(1);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
    });

    it('keeps archiving the remaining candidates after one fails verification', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), _id: 'sub-a', rootPath: 'submissions/sub-a' },
            { ...filesSubmission(), _id: 'sub-b', rootPath: 'submissions/sub-b' },
            { ...filesSubmission(), _id: 'sub-c', rootPath: 'submissions/sub-c' },
        ]);
        service._verifySyncedCopies = jest.fn(async (sub) => (
            sub._id === 'sub-b' ? { ok: false, reason: 'size mismatch' } : { ok: true }
        ));

        await service.archiveSubmissions();

        const deleted = service.s3Service.deleteDirectory.mock.calls.map(([, rootPath]) => rootPath);
        expect(deleted).toEqual(['submissions/sub-a', 'submissions/sub-c']);
    });

    it('logs one line per past-retention submission with no data sync record', async () => {
        const first = legacyCandidate();
        const second = legacyCandidate({
            _id: 'sub-legacy-2',
            dataType: DATA_TYPE.METADATA_ONLY,
            studyID: 'study-2',
            bucketName: 'other-bucket',
            rootPath: 'submissions/sub-legacy-2',
        });
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([first, second]);
        const archive = jest.spyOn(service, '_archiveSubmission');

        await service.archiveSubmissions();

        expect(warnLines()).toEqual([
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy dataCommons=TestCommons dataType=Metadata and Data Files studyID=study-legacy bucket=submission-bucket rootPath=submissions/sub-legacy updatedAt=2024-01-15T00:00:00.000Z',
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy-2 dataCommons=TestCommons dataType=Metadata Only studyID=study-2 bucket=other-bucket rootPath=submissions/sub-legacy-2 updatedAt=2024-01-15T00:00:00.000Z',
            '[ARCHIVE_MANUAL_VERIFY] total=2',
        ]);
        expect(service.dataSyncService.findSubmissionIDsWithRecords).toHaveBeenCalledTimes(1);
        expect(service.dataSyncService.findSubmissionIDsWithRecords).toHaveBeenCalledWith(['sub-legacy', 'sub-legacy-2']);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.headObjectChecksums).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(archive).not.toHaveBeenCalled();
    });

    it('does not log a submission that has any data sync record, whatever its rollup', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([
            legacyCandidate({ _id: 'sub-succeeded', metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED }),
            legacyCandidate({ _id: 'sub-failed', metadataDataSyncStatus: DATA_SYNC_STATUS.FAILED, fileDataSyncStatus: DATA_SYNC_STATUS.FAILED }),
            legacyCandidate({ _id: 'sub-progress', metadataDataSyncStatus: DATA_SYNC_STATUS.IN_PROGRESS }),
            legacyCandidate({ _id: 'sub-missing', metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED }),
        ]);
        service.dataSyncService.findSubmissionIDsWithRecords.mockResolvedValue([
            'sub-succeeded', 'sub-failed', 'sub-progress',
        ]);

        await service.archiveSubmissions();

        const lines = warnLines().filter((line) => line.startsWith('[ARCHIVE_MANUAL_VERIFY] submission='));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('submission=sub-missing');
        expect(lines[0]).toContain('studyID=study-legacy');
        expect(warnLines()).toContain('[ARCHIVE_MANUAL_VERIFY] total=1');
    });

    it('does not log an approved submission on the manual verification worklist', async () => {
        const approved = {
            ...filesSubmission(),
            manualArchiveApproval: {
                approved: true,
                note: 'ticket-9',
            },
        };
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([legacyCandidate()]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([approved]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        const verifyLines = warnLines().filter((line) => line.startsWith('[ARCHIVE_MANUAL_VERIFY]'));
        expect(verifyLines.some((line) => line.includes('submission=sub-1'))).toBe(false);
        expect(verifyLines.some((line) => line.includes('submission=sub-legacy'))).toBe(true);
        expect(service.submissionDAO.getPastRetentionUnapprovedSubmissions).toHaveBeenCalledWith(30);
    });

    it('logs the worklist even when nothing is eligible to archive, including a zero total', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([]);
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([legacyCandidate()]);
        const archive = jest.spyOn(service, '_archiveSubmission');

        const summary = await service.archiveSubmissions();

        expect(summary).toBe('No completed submissions need to be archived');
        expect(warnLines()).toEqual([
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy dataCommons=TestCommons dataType=Metadata and Data Files studyID=study-legacy bucket=submission-bucket rootPath=submissions/sub-legacy updatedAt=2024-01-15T00:00:00.000Z',
            '[ARCHIVE_MANUAL_VERIFY] total=1',
        ]);
        expect(archive).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();

        jest.clearAllMocks();
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([]);
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([]);
        service.dataSyncService.findSubmissionIDsWithRecords.mockResolvedValue([]);

        await service.archiveSubmissions();

        expect(warnLines()).toEqual(['[ARCHIVE_MANUAL_VERIFY] total=0']);
    });

    it('keeps archiving when the worklist query or the record lookup rejects', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockRejectedValue(new Error('worklist down'));
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('worklist down'));
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([legacyCandidate()]);
        service.dataSyncService.findSubmissionIDsWithRecords.mockRejectedValue(new Error('lookup down'));
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });
        service.s3Service.deleteDirectory.mockResolvedValue(true);

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('lookup down'));
        expect(warnLines().some((line) => String(line).startsWith('[ARCHIVE_MANUAL_VERIFY]'))).toBe(false);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);
    });

    it('archives an approved submission without the data sync gate', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            manualArchiveApproval: {
                approved: true,
                note: 'ticket-42 verified copy',
            },
        }]);
        const verify = jest.spyOn(service, '_verifySyncedCopies');
        const archive = jest.spyOn(service, '_archiveSubmission');

        await service.archiveSubmissions();

        expect(verify).not.toHaveBeenCalled();
        expect(service.dataSyncService.findLatestBySubmissionIDAndType).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-42 verified copy outcome=archived reason=NoDataSyncRecord'
        );
        expect(service.dataSyncService.findSubmissionIDsWithRecords).toHaveBeenCalledWith(['sub-1']);
        expect(archive).toHaveBeenCalledWith('sub-1', SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
    });

    it('ignores an approval when any data sync record exists and a failed rollup is retained', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            manualArchiveApproval: { approved: true, note: 'ticket-42 verified copy' },
        }]);
        service.dataSyncService.findSubmissionIDsWithRecords.mockResolvedValue(['sub-1']);
        const verify = jest.spyOn(service, '_verifySyncedCopies');

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-42 verified copy outcome=ignored reason=DataSyncRecordExists'
        );
        expect(verify).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
    });

    it('ignores an approval when a data sync record exists and still verifies a succeeded rollup', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            manualArchiveApproval: { approved: true, note: 'ticket-7' },
        }]);
        service.dataSyncService.findSubmissionIDsWithRecords.mockResolvedValue(['sub-1']);
        const verify = jest.spyOn(service, '_verifySyncedCopies').mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-7 outcome=ignored reason=DataSyncRecordExists'
        );
        expect(verify).toHaveBeenCalledWith(expect.objectContaining({ _id: 'sub-1' }));
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
    });

    it('retains Metadata and Data Files when the study has an in-progress file DataSync', async () => {
        service.dataSyncService.findSubmissionIDsWithInProgressFileRecords.mockResolvedValue(['sub-other']);
        service.submissionDAO.findMany.mockResolvedValue([{ _id: 'sub-other', studyID: 'study-1' }]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._verifySyncedCopies).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('logs manual approval as ignored when the study has an in-progress file DataSync', async () => {
        service.dataSyncService.findSubmissionIDsWithInProgressFileRecords.mockResolvedValue(['sub-other']);
        service.submissionDAO.findMany.mockResolvedValue([{ _id: 'sub-other', studyID: 'study-1' }]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            manualArchiveApproval: { approved: true, note: 'ticket-9' },
        }]);

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-9 outcome=ignored reason=StudyFileDataSyncInProgress'
        );
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('does not emit outcome=archived when manual approval archive fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            manualArchiveApproval: { approved: true, note: 'ticket-42 verified copy' },
        }]);
        jest.spyOn(service, '_archiveSubmission').mockRejectedValue(new Error('S3 delete failed'));

        const summary = await service.archiveSubmissions();

        expect(warnLines().some((line) => line.includes('outcome=archived'))).toBe(false);
        expect(summary).toEqual(expect.stringContaining('sub-1'));
    });

    it('does not honor approvals when the record lookup rejects, and still archives an eligible candidate', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            {
                ...filesSubmission(),
                _id: 'sub-approved',
                rootPath: 'submissions/sub-approved',
                metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
                fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
                manualArchiveApproval: { approved: true, note: 'nope' },
            },
            filesSubmission(),
        ]);
        service.dataSyncService.findSubmissionIDsWithRecords
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('approval lookup down'));
        service._verifySyncedCopies = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('approval lookup down'));
        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-approved note=nope outcome=ignored reason=DataSyncLookupFailed'
        );
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
        expect(service.submissionDAO.update).not.toHaveBeenCalledWith('sub-approved', expect.anything());
    });

});

describe('_archiveCancelSubmission', () => {

    it('deletes without any verification on the Canceled path', async () => {
        service._verifySyncedCopies = jest.fn();

        await service._archiveCancelSubmission(ACTIONS.CANCEL, 'sub-1', SUBMISSION_BUCKET, 'submissions/sub-1');

        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service._verifySyncedCopies).not.toHaveBeenCalled();
    });

});
