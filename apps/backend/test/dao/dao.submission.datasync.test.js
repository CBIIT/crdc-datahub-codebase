const SubmissionDAO = require('../../dao/submission');
const SubmissionModel = require('../../mongoose/models/submission');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { COMPLETED, DATA_TYPE } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

let dao;

describe('SubmissionDAO data sync', () => {

    beforeEach(() => {
        dao = new SubmissionDAO();
        jest.clearAllMocks();
    });

    describe('verify initialization', () => {

        it('should extend MongooseGenericDAO and use the Submission model', () => {
            expect(dao).toBeInstanceOf(MongooseGenericDAO);
            expect(dao.model).toBe(SubmissionModel);
            expect(dao.model.modelName).toBe('Submission');
        });

        it('should have expected methods defined', () => {
            expect(dao.getToBeArchivedSubmissions).toBeDefined();
            expect(dao.updateDataSyncStatus).toBeUndefined();
            expect(dao._assertDataSyncRollupStatus).toBeUndefined();
        });

    });

    describe('getToBeArchivedSubmissions', () => {

        it('requires a succeeded file sync or a metadata-only submission', async () => {
            const findManySpy = jest.spyOn(dao, 'findMany').mockResolvedValue([]);

            const submissions = await dao.getToBeArchivedSubmissions(30);
            expect(submissions).toEqual([]);
            expect(findManySpy).toHaveBeenCalledWith({
                status: COMPLETED,
                updatedAt: { $lte: expect.any(Date) },
                $or: [
                    { dataType: DATA_TYPE.METADATA_ONLY },
                    { fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED },
                ],
            });
        });

        it('returns an empty array when findMany rejects', async () => {
            jest.spyOn(dao, 'findMany').mockRejectedValue(new Error('db down'));
            jest.spyOn(console, 'error').mockImplementation(() => {});

            await expect(dao.getToBeArchivedSubmissions(30)).resolves.toEqual([]);
        });

    });

});
