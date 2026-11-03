const SubmissionDAO = require('../../dao/submission');
const { COMPLETED, DATA_TYPE } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

/**
 * getToBeArchivedSubmissions builds the archive candidate query. These assert the Mongo filter
 * handed to findMany, since the DAO builds a query rather than evaluating documents. The
 * eligibility truth table lives in test/utility/archive-eligibility.test.js.
 */

let dao;
let findManySpy;

/** @returns {object} the filter passed to findMany */
async function captureFilter(retentionDays = 30) {
    await dao.getToBeArchivedSubmissions(retentionDays);
    return findManySpy.mock.calls[0][0];
}

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

    it('has exactly two eligibility branches, each requiring a succeeded metadata sync', async () => {
        const filter = await captureFilter();

        expect(filter.$or).toHaveLength(2);
        for (const branch of filter.$or) {
            expect(branch.metadataDataSyncStatus).toBe(DATA_SYNC_STATUS.SUCCEEDED);
        }
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

});
