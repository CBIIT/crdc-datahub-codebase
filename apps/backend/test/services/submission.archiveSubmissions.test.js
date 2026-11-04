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
 *   _hasSucceededDataSyncRecords(submission) -> {ok, reason}, never throws
 *   archiveSubmissions()                     -> deletes when records succeeded,
 *                                              or when a manual archive approval is set
 *                                              and a required type has no record
 */

const SUBMISSION_BUCKET = 'submission-bucket';
const DATA_COMMONS = 'TestCommons';

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
    ...overrides,
});

const fileRecord = (overrides = {}) => ({
    type: DATA_SYNC_TYPE.FILE,
    status: DATA_SYNC_STATUS.SUCCEEDED,
    ...overrides,
});

/** Both required types recorded for a Metadata and Data Files submission. */
const bothRecordedTypes = (submissionID) => new Map([
    [submissionID, new Set([DATA_SYNC_TYPE.METADATA, DATA_SYNC_TYPE.FILE])],
]);

/**
 * s3Service double. listFileInDir throws on any call so an unexpected
 * destination read fails the test instead of looking like an empty prefix.
 */
function makeS3Service() {
    return {
        listFileInDir: jest.fn(async (bucket, prefix) => {
            throw new Error(`unexpected listing request: ${bucket}|${prefix}`);
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
    service.s3Service = makeS3Service();
    service.dataSyncService = {
        findLatestBySubmissionIDAndType: jest.fn(async (_submissionID, type) => (
            type === DATA_SYNC_TYPE.METADATA ? metadataRecord() : fileRecord()
        )),
        findRecordedTypesBySubmissionIDs: jest.fn().mockResolvedValue(new Map()),
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

describe('_hasSucceededDataSyncRecords', () => {

    it('passes when required metadata and file records succeeded', async () => {
        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result.ok).toBe(true);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it('passes for Metadata Only when the metadata record succeeded', async () => {
        const result = await service._hasSucceededDataSyncRecords(metadataOnlySubmission());

        expect(result.ok).toBe(true);
        expect(service.dataSyncService.findLatestBySubmissionIDAndType)
            .not.toHaveBeenCalledWith(expect.anything(), DATA_SYNC_TYPE.FILE);
    });

    it('fails when no dataSync record exists for a required type', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockResolvedValue(null);

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('NoDataSyncRecord'));
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it.each([
        DATA_SYNC_STATUS.FAILED,
        DATA_SYNC_STATUS.IN_PROGRESS,
        DATA_SYNC_STATUS.NOT_STARTED,
    ])('fails when the dataSync record status is %s', async (status) => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn()
            .mockResolvedValue(metadataRecord({ status }));

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('DataSyncNotSucceeded'));
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
    });

    it('returns a reason on every failure path', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockRejectedValue(new Error('boom'));

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result.ok).toBe(false);
        expect(result.reason).toBeTruthy();
    });

    it('uses the error code when a thrown error has no message', async () => {
        const error = new Error();
        error.message = null;
        error.code = 'AccessDenied';
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockRejectedValue(error);

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result).toEqual({ ok: false, reason: 'AccessDenied' });
    });

    it('uses String(error) when a non-Error string is thrown', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockRejectedValue('test error');

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result).toEqual({ ok: false, reason: 'test error' });
    });

    it('uses a fallback reason when the thrown value has no message or code', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn().mockRejectedValue(null);

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result).toEqual({ ok: false, reason: 'Unknown error' });
    });

    it('rejects Metadata and Data Files when metadata succeeded and the file record failed', async () => {
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn(async (_submissionID, type) => (
            type === DATA_SYNC_TYPE.METADATA
                ? metadataRecord()
                : fileRecord({ status: DATA_SYNC_STATUS.FAILED })
        ));

        const result = await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(result).toEqual({
            ok: false,
            reason: `${DATA_SYNC_TYPE.FILE} DataSyncNotSucceeded: ${DATA_SYNC_STATUS.FAILED}`,
        });
    });

    it('loads both metadata and file records for Metadata and Data Files', async () => {
        await service._hasSucceededDataSyncRecords(filesSubmission());

        expect(service.dataSyncService.findLatestBySubmissionIDAndType)
            .toHaveBeenCalledWith('sub-1', DATA_SYNC_TYPE.METADATA);
        expect(service.dataSyncService.findLatestBySubmissionIDAndType)
            .toHaveBeenCalledWith('sub-1', DATA_SYNC_TYPE.FILE);
    });

    it('returns UnknownDataType when dataType is neither known value', async () => {
        const result = await service._hasSucceededDataSyncRecords({
            ...filesSubmission(),
            dataType: 'Other',
        });

        expect(result).toEqual({ ok: false, reason: 'UnknownDataType' });
        expect(service.dataSyncService.findLatestBySubmissionIDAndType).not.toHaveBeenCalled();
    });

});

describe('archiveSubmissions', () => {

    it('archives the submission when the record gate passes', async () => {
        const submission = filesSubmission();
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([submission]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.dataRecordService.archiveMetadataByFilter).toHaveBeenCalledWith({ submissionID: 'sub-1' });
        expect(service.batchDAO.deleteBatchesBySubmissionID).toHaveBeenCalledWith('sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
    });

    it('does not delete the S3 directory when the record gate fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: false, reason: 'NoDataSyncRecord for metadata' });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('does not archive records or delete batches when the record gate fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: false, reason: 'NoDataSyncRecord for metadata' });

        await service.archiveSubmissions();

        expect(service.dataRecordService.archiveMetadataByFilter).not.toHaveBeenCalled();
        expect(service.batchDAO.deleteBatchesBySubmissionID).not.toHaveBeenCalled();
    });

    it('does not mark the submission archived when the record gate fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: false, reason: 'NoDataSyncRecord for metadata' });

        await service.archiveSubmissions();

        expect(service.submissionDAO.update).not.toHaveBeenCalled();
    });

    it('runs the record gate for a Metadata Only submission rather than exempting it', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([metadataOnlySubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._hasSucceededDataSyncRecords).toHaveBeenCalledWith(expect.objectContaining({ _id: 'sub-2' }));
    });

    it('runs the record gate before deleting anything', async () => {
        const order = [];
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn(async () => {
            order.push('records');
            return { ok: true };
        });
        service.s3Service.deleteDirectory = jest.fn(async () => {
            order.push('delete');
            return true;
        });

        await service.archiveSubmissions();

        expect(order).toEqual(['records', 'delete']);
    });

    it('names the retained submission in the summary when the record gate fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: false, reason: 'NoDataSyncRecord for metadata' });

        const summary = await service.archiveSubmissions();

        expect(summary).toEqual(expect.stringContaining('sub-1'));
        expect(summary).not.toEqual('successful!');
    });

    it('distinguishes a retained submission from a failed S3 delete in the summary', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: false, reason: 'NoDataSyncRecord for metadata' });

        const retainedSummary = await service.archiveSubmissions();

        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });
        service.s3Service.deleteDirectory = jest.fn().mockRejectedValue(new Error('access denied'));

        const deleteSummary = await service.archiveSubmissions();

        expect(retainedSummary).not.toEqual(deleteSummary);
    });

    it('reports success when every candidate is archived', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');
    });

    it('skips a candidate that does not meet the data sync status criteria', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
        }]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('archives without listing or HeadObject when DataSync records succeeded', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);

        await service.archiveSubmissions();

        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
    });

    it('skips an already-archived candidate without verifying, deleting, or reporting it', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), archived: true },
        ]);
        const verify = jest.spyOn(service, '_hasSucceededDataSyncRecords');

        const summary = await service.archiveSubmissions();

        expect(verify).not.toHaveBeenCalled();
        expect(service.dataSyncService.findLatestBySubmissionIDAndType).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
        expect(summary).toEqual('successful!');
    });

    it('still archives the other candidates when one is already archived', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), _id: 'sub-old', rootPath: 'submissions/sub-old', archived: true },
            filesSubmission(),
        ]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._hasSucceededDataSyncRecords).toHaveBeenCalledTimes(1);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
    });

    it('keeps archiving the remaining candidates after one fails the record gate', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([
            { ...filesSubmission(), _id: 'sub-a', rootPath: 'submissions/sub-a' },
            { ...filesSubmission(), _id: 'sub-b', rootPath: 'submissions/sub-b' },
            { ...filesSubmission(), _id: 'sub-c', rootPath: 'submissions/sub-c' },
        ]);
        service._hasSucceededDataSyncRecords = jest.fn(async (sub) => (
            sub._id === 'sub-b' ? { ok: false, reason: 'NoDataSyncRecord for metadata' } : { ok: true }
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
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy dataCommons=TestCommons dataType=Metadata and Data Files studyID=study-legacy bucket=submission-bucket rootPath=submissions/sub-legacy updatedAt=2024-01-15T00:00:00.000Z reason=NoDataSyncRecord',
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy-2 dataCommons=TestCommons dataType=Metadata Only studyID=study-2 bucket=other-bucket rootPath=submissions/sub-legacy-2 updatedAt=2024-01-15T00:00:00.000Z reason=NoDataSyncRecord',
            '[ARCHIVE_MANUAL_VERIFY] total=2',
        ]);
        expect(service.dataSyncService.findRecordedTypesBySubmissionIDs).toHaveBeenCalledTimes(1);
        expect(service.dataSyncService.findRecordedTypesBySubmissionIDs).toHaveBeenCalledWith(['sub-legacy', 'sub-legacy-2']);
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(archive).not.toHaveBeenCalled();
    });

    it('logs a missing required type and omits a submission whose required records are present', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([
            legacyCandidate({ _id: 'sub-partial' }),
            legacyCandidate({ _id: 'sub-none' }),
            legacyCandidate({
                _id: 'sub-complete',
                metadataDataSyncStatus: DATA_SYNC_STATUS.FAILED,
                fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            }),
        ]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(new Map([
            ['sub-partial', new Set([DATA_SYNC_TYPE.METADATA])],
            ['sub-complete', new Set([DATA_SYNC_TYPE.METADATA, DATA_SYNC_TYPE.FILE])],
        ]));

        await service.archiveSubmissions();

        const lines = warnLines().filter((line) => line.startsWith('[ARCHIVE_MANUAL_VERIFY] submission='));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('submission=sub-partial');
        expect(lines[0]).toContain('reason=MissingRecordForType:file');
        expect(lines[1]).toContain('submission=sub-none');
        expect(lines[1]).toContain('reason=NoDataSyncRecord');
        expect(lines.some((line) => line.includes('submission=sub-complete'))).toBe(false);
        expect(warnLines()).toContain('[ARCHIVE_MANUAL_VERIFY] total=2');
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
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

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
            '[ARCHIVE_MANUAL_VERIFY] submission=sub-legacy dataCommons=TestCommons dataType=Metadata and Data Files studyID=study-legacy bucket=submission-bucket rootPath=submissions/sub-legacy updatedAt=2024-01-15T00:00:00.000Z reason=NoDataSyncRecord',
            '[ARCHIVE_MANUAL_VERIFY] total=1',
        ]);
        expect(archive).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();

        jest.clearAllMocks();
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([]);
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(new Map());

        await service.archiveSubmissions();

        expect(warnLines()).toEqual(['[ARCHIVE_MANUAL_VERIFY] total=0']);
    });

    it('keeps archiving when the worklist query or the record lookup rejects', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockRejectedValue(new Error('worklist down'));
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('worklist down'));
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);

        jest.clearAllMocks();
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([legacyCandidate()]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockRejectedValue(new Error('lookup down'));
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });
        service.s3Service.deleteDirectory.mockResolvedValue(true);

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('lookup down'));
        expect(warnLines().some((line) => String(line).startsWith('[ARCHIVE_MANUAL_VERIFY]'))).toBe(false);
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledTimes(1);
    });

    it('keeps archiving when the worklist throws a non-Error', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockRejectedValue(null);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await expect(service.archiveSubmissions()).resolves.toEqual('successful!');

        expect(console.error).toHaveBeenCalledWith(
            'Failed to log submissions needing manual archive verification: Unknown error'
        );
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
        const verify = jest.spyOn(service, '_hasSucceededDataSyncRecords');
        const archive = jest.spyOn(service, '_archiveSubmission');

        await service.archiveSubmissions();

        expect(verify).not.toHaveBeenCalled();
        expect(service.dataSyncService.findLatestBySubmissionIDAndType).not.toHaveBeenCalled();
        expect(service.s3Service.listFileInDir).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-42 verified copy outcome=archived reason=NoDataSyncRecord'
        );
        expect(service.dataSyncService.findRecordedTypesBySubmissionIDs).toHaveBeenCalledWith(['sub-1']);
        expect(archive).toHaveBeenCalledWith('sub-1', SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ archived: true }));
    });

    it('ignores an approval when every required record exists and a failed rollup is retained', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            manualArchiveApproval: { approved: true, note: 'ticket-42 verified copy' },
        }]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(bothRecordedTypes('sub-1'));
        const verify = jest.spyOn(service, '_hasSucceededDataSyncRecords');

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-42 verified copy outcome=ignored reason=DataSyncRecordsComplete'
        );
        expect(verify).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
    });

    it('ignores an approval when every required record exists and still runs the record gate for a succeeded rollup', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            manualArchiveApproval: { approved: true, note: 'ticket-7' },
        }]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(bothRecordedTypes('sub-1'));
        const recordCheck = jest.spyOn(service, '_hasSucceededDataSyncRecords').mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-7 outcome=ignored reason=DataSyncRecordsComplete'
        );
        expect(recordCheck).toHaveBeenCalledWith(expect.objectContaining({ _id: 'sub-1' }));
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
    });

    it('retains Metadata and Data Files when the study has an in-progress file DataSync', async () => {
        service.dataSyncService.findSubmissionIDsWithInProgressFileRecords.mockResolvedValue(['sub-other']);
        service.submissionDAO.findMany.mockResolvedValue([{ _id: 'sub-other', studyID: 'study-1' }]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

        await service.archiveSubmissions();

        expect(service._hasSucceededDataSyncRecords).not.toHaveBeenCalled();
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('logs manual approval as ignored when the study has an in-progress file DataSync', async () => {
        service.dataSyncService.findSubmissionIDsWithInProgressFileRecords.mockResolvedValue(['sub-other']);
        service.submissionDAO.findMany.mockResolvedValue([{ _id: 'sub-other', studyID: 'study-1' }]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            manualArchiveApproval: { approved: true, note: 'ticket-9' },
        }]);

        const summary = await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-9 outcome=ignored reason=StudyFileDataSyncInProgress'
        );
        expect(summary).toEqual(expect.stringContaining('data retained for submission(s): sub-1'));
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
        service.dataSyncService.findRecordedTypesBySubmissionIDs
            .mockResolvedValueOnce(new Map())
            .mockRejectedValueOnce(new Error('approval lookup down'));
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });

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

    it('honors an approval when a metadata record exists and the file record does not', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            manualArchiveApproval: { approved: true, note: 'ticket-partial' },
        }]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(new Map([
            ['sub-1', new Set([DATA_SYNC_TYPE.METADATA])],
        ]));
        const verify = jest.spyOn(service, '_hasSucceededDataSyncRecords');

        await service.archiveSubmissions();

        expect(verify).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-partial outcome=archived reason=MissingRecordForType:file'
        );
        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
    });

    it('does not delete when the file record failed and the record gate is not stubbed', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service.dataSyncService.findLatestBySubmissionIDAndType = jest.fn(async (_submissionID, type) => (
            type === DATA_SYNC_TYPE.FILE
                ? fileRecord({ status: DATA_SYNC_STATUS.FAILED })
                : metadataRecord()
        ));

        const summary = await service.archiveSubmissions();

        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
        expect(summary).toEqual(expect.stringContaining('sub-1'));
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining(
            `${DATA_SYNC_TYPE.FILE} DataSyncNotSucceeded: ${DATA_SYNC_STATUS.FAILED}`
        ));
    });

    it('names the post-delete step when archive metadata fails', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([filesSubmission()]);
        service._hasSucceededDataSyncRecords = jest.fn().mockResolvedValue({ ok: true });
        service.dataRecordService.archiveMetadataByFilter.mockRejectedValue(new Error('mongo down'));

        await service.archiveSubmissions();

        expect(console.error).toHaveBeenCalledWith(
            'Failed to archive completed submission: sub-1 with error: archiveMetadataByFilter failed for submission sub-1: mongo down.'
        );
        expect(service.batchDAO.deleteBatchesBySubmissionID).not.toHaveBeenCalled();
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
    });

    it('logs UnknownDataType on the worklist and ignores approval for an unknown dataType', async () => {
        const unknown = {
            ...legacyCandidate({ _id: 'sub-unknown', dataType: 'Other' }),
        };
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([unknown]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...unknown,
            manualArchiveApproval: { approved: true, note: 'ticket-unknown' },
        }]);

        await service.archiveSubmissions();

        expect(warnLines().some((line) => line.includes('submission=sub-unknown') && line.includes('reason=UnknownDataType'))).toBe(true);
        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-unknown note=ticket-unknown outcome=ignored reason=UnknownDataType'
        );
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('does not log the worklist when the record lookup resolves to a non-Map', async () => {
        service.submissionDAO.getPastRetentionUnapprovedSubmissions.mockResolvedValue([legacyCandidate()]);
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(undefined);

        await service.archiveSubmissions();

        expect(console.error).toHaveBeenCalledWith(
            'Failed to log submissions needing manual archive verification: DataSync record lookup returned an invalid result'
        );
        expect(warnLines().filter((line) => line.startsWith('[ARCHIVE_MANUAL_VERIFY]'))).toEqual([]);
    });

    it('ignores approval when the approval record lookup resolves to a non-Map', async () => {
        service.submissionDAO.getToBeArchivedSubmissions.mockResolvedValue([{
            ...filesSubmission(),
            metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
            fileDataSyncStatus: DATA_SYNC_STATUS.FAILED,
            manualArchiveApproval: { approved: true, note: 'ticket-map' },
        }]);
        service.dataSyncService.findRecordedTypesBySubmissionIDs.mockResolvedValue(undefined);

        await service.archiveSubmissions();

        expect(console.warn).toHaveBeenCalledWith(
            '[ARCHIVE_MANUAL] submission=sub-1 note=ticket-map outcome=ignored reason=DataSyncLookupFailed'
        );
        expect(service.s3Service.deleteDirectory).not.toHaveBeenCalled();
    });

    it('preserves the original error as cause when a post-delete step fails', async () => {
        const original = new Error('mongo down');
        service.dataRecordService.archiveMetadataByFilter.mockRejectedValue(original);

        await expect(
            service._archiveSubmission('sub-1', SUBMISSION_BUCKET, 'submissions/sub-1')
        ).rejects.toMatchObject({
            message: expect.stringContaining('archiveMetadataByFilter failed for submission sub-1'),
            cause: original,
        });
    });

});

describe('deleteInactiveSubmissions', () => {

    it('records a failed delete when deleteDirectory returns false', async () => {
        service.emailParams.inactiveSubmissionDays = 90;
        service.submissionDAO.getToBeDeletedSubmissions = jest.fn().mockResolvedValue([filesSubmission()]);
        service.dataRecordService.deleteMetadataByFilter = jest.fn().mockResolvedValue({});
        service.s3Service.deleteDirectory.mockResolvedValue(false);

        const summary = await service.deleteInactiveSubmissions();

        expect(summary).toEqual(expect.stringContaining('Failed to delete files under submissions: sub-1'));
        expect(console.error).toHaveBeenCalledWith(
            'Failed to delete files under inactive submission: sub-1: S3 delete did not succeed.'
        );
        expect(service.submissionDAO.update).not.toHaveBeenCalled();
        expect(service.dataRecordService.deleteMetadataByFilter).not.toHaveBeenCalled();
        expect(service.batchDAO.deleteBatchesBySubmissionID).not.toHaveBeenCalled();
    });

    it('continues deleting other inactive submissions when deleteDirectory throws a non-Error', async () => {
        service.emailParams.inactiveSubmissionDays = 90;
        service.submissionDAO.getToBeDeletedSubmissions = jest.fn().mockResolvedValue([
            { ...filesSubmission(), _id: 'sub-a', rootPath: 'submissions/sub-a' },
            { ...filesSubmission(), _id: 'sub-b', rootPath: 'submissions/sub-b' },
        ]);
        service.dataRecordService.deleteMetadataByFilter = jest.fn().mockResolvedValue({});
        jest.spyOn(service, '_sendEmailsDeletedSubmissions').mockResolvedValue(undefined);
        service.s3Service.deleteDirectory
            .mockRejectedValueOnce(null)
            .mockResolvedValueOnce(true);

        const summary = await service.deleteInactiveSubmissions();

        expect(summary).toEqual(expect.stringContaining('Failed to delete files under submissions: sub-a'));
        expect(console.error).toHaveBeenCalledWith(
            'Failed to delete files under inactive submission: sub-a with error: Unknown error.'
        );
        expect(service.submissionDAO.update).toHaveBeenCalledWith('sub-b', expect.objectContaining({ status: 'Deleted' }));
        expect(service.submissionDAO.update).not.toHaveBeenCalledWith('sub-a', expect.anything());
    });

});

describe('_archiveCancelSubmission', () => {

    it('deletes without a DataSync record check on the Canceled path', async () => {
        const recordCheck = jest.spyOn(service, '_hasSucceededDataSyncRecords');

        await service._archiveCancelSubmission(ACTIONS.CANCEL, 'sub-1', SUBMISSION_BUCKET, 'submissions/sub-1');

        expect(service.s3Service.deleteDirectory).toHaveBeenCalledWith(SUBMISSION_BUCKET, 'submissions/sub-1');
        expect(recordCheck).not.toHaveBeenCalled();
    });

});
