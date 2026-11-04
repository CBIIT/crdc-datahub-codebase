const SubmissionDAO = require('../../dao/submission');
const { COMPLETED, DATA_TYPE } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

/**
 * Archive candidate queries. These assert the Mongo filter handed to findMany, since the DAO
 * builds a query rather than evaluating documents. The eligibility truth table lives in
 * test/utility/archive-eligibility.test.js.
 */

let dao;
let findManySpy;

/** @returns {object} the filter passed to findMany */
async function captureFilter(retentionDays = 30) {
    await dao.getToBeArchivedSubmissions(retentionDays);
    return findManySpy.mock.calls[0][0];
}

const WORKLIST_PROJECTION = {
    _id: 1,
    dataCommons: 1,
    dataType: 1,
    studyID: 1,
    bucketName: 1,
    rootPath: 1,
    updatedAt: 1,
};

/**
 * @param {object[]} orBranches
 * @param {string} dataType
 * @returns {object|undefined}
 */
const branchFor = (orBranches, dataType) => orBranches.find((b) => b.dataType === dataType);

describe('SubmissionDAO.getToBeArchivedSubmissions archive gate', () => {

    beforeEach(() => {
        dao = new SubmissionDAO();
        findManySpy = jest.spyOn(dao, 'findMany').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('filters on completed status and the retention cutoff', async () => {
        const filter = await captureFilter(30);

        expect(filter.status).toBe(COMPLETED);
        expect(filter.updatedAt).toEqual({ $lte: expect.any(Date) });
    });

    it('excludes already-archived submissions at the top level of the query', async () => {
        const filter = await captureFilter();

        expect(filter.archived).toEqual({ $ne: true });
        for (const branch of filter.$or) {
            expect(Object.keys(branch)).not.toContain('archived');
        }
    });

    it('has the two sync-status branches and a manual-approval branch', async () => {
        const filter = await captureFilter();
        const syncBranches = filter.$or.filter((branch) => branch.dataType);

        expect(filter.$or).toHaveLength(3);
        expect(syncBranches).toHaveLength(2);
        for (const branch of syncBranches) {
            expect(branch.metadataDataSyncStatus).toBe(DATA_SYNC_STATUS.SUCCEEDED);
        }
        expect(filter.$or).toContainEqual({
            'manualArchiveApproval.approved': true,
        });
    });

    it('requires a succeeded metadata sync and nothing else on the Metadata Only branch', async () => {
        const filter = await captureFilter();
        const branch = branchFor(filter.$or, DATA_TYPE.METADATA_ONLY);

        expect(branch).toEqual({
            dataType: DATA_TYPE.METADATA_ONLY,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        });
        expect(Object.keys(branch)).not.toContain('fileDataSyncStatus');
    });

    it('requires both syncs to have succeeded on the Metadata and Data Files branch', async () => {
        const filter = await captureFilter();
        const branch = branchFor(filter.$or, DATA_TYPE.METADATA_AND_DATA_FILES);

        expect(branch).toEqual({
            dataType: DATA_TYPE.METADATA_AND_DATA_FILES,
            metadataDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        });
    });

    it('shares the base filter with the manual-verification worklist and has no sync-status condition there', async () => {
        const base = { status: COMPLETED, archived: { $ne: true }, updatedAt: { $lte: new Date('2020-01-01') } };
        const baseSpy = jest.spyOn(dao, '_archiveBaseFilter').mockReturnValue(base);

        await dao.getToBeArchivedSubmissions(30);
        await dao.getPastRetentionUnapprovedSubmissions(30);

        expect(baseSpy).toHaveBeenNthCalledWith(1, 30);
        expect(baseSpy).toHaveBeenNthCalledWith(2, 30);
        expect(findManySpy.mock.calls[0][0]).toEqual(expect.objectContaining(base));

        const [worklistFilter, worklistOptions] = findManySpy.mock.calls[1];
        expect(worklistFilter).toEqual({
            ...base,
            'manualArchiveApproval.approved': { $ne: true },
        });
        expect(JSON.stringify(worklistFilter)).not.toContain('DataSyncStatus');
        expect(worklistFilter.$or).toBeUndefined();
        expect(worklistOptions).toEqual({ projection: WORKLIST_PROJECTION });
    });

    it('returns an empty array when the worklist query rejects', async () => {
        findManySpy.mockRejectedValue(new Error('db down'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(dao.getPastRetentionUnapprovedSubmissions(30)).resolves.toEqual([]);
    });

});
