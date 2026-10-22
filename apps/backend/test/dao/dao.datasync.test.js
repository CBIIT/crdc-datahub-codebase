const DataSyncDAO = require('../../dao/dataSync');
const DataSyncModel = require('../../mongoose/models/data-sync');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { DATA_SYNC_STATUS, DATA_SYNC_TYPE } = require('../../constants/data-sync-constants');

describe('DataSyncDAO', () => {
    let dataSyncDAO;

    beforeEach(() => {
        dataSyncDAO = new DataSyncDAO();
        jest.clearAllMocks();
    });

    describe('verify DataSyncDAO initialization', () => {
        it('should extend MongooseGenericDAO and use the DataSync model', () => {
            expect(dataSyncDAO).toBeInstanceOf(MongooseGenericDAO);
            expect(dataSyncDAO.model).toBe(DataSyncModel);
            expect(dataSyncDAO.model.modelName).toBe('DataSync');
        });
    });

    describe('find queries', () => {

        it('finds the latest record by submission and type', async () => {
            const findFirstSpy = jest.spyOn(dataSyncDAO, 'findFirst').mockResolvedValue(null);

            await dataSyncDAO.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            expect(findFirstSpy).toHaveBeenCalledWith(
                { submissionID: '123', type: DATA_SYNC_TYPE.METADATA },
                { sort: { startTime: -1 } }
            );
        });

        it('finds in-progress records by submission and type', async () => {
            const findManySpy = jest.spyOn(dataSyncDAO, 'findMany').mockResolvedValue([]);

            await dataSyncDAO.findInProgressBySubmissionIDAndType('123', DATA_SYNC_TYPE.FILE);
            expect(findManySpy).toHaveBeenCalledWith({
                submissionID: '123',
                type: DATA_SYNC_TYPE.FILE,
                status: DATA_SYNC_STATUS.IN_PROGRESS,
            });
        });

    });
});