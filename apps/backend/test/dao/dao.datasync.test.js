const DataSyncDAO = require('../../dao/dataSync');
const DataSyncModel = require('../../mongoose/models/data-sync');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { DATA_SYNC_TYPE, DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

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

        it('should have expected methods defined', () => {
            expect(dataSyncDAO.listBySubmissionID).toBeDefined();
            expect(dataSyncDAO.findLatestBySubmissionIDAndType).toBeDefined();
            expect(dataSyncDAO.findSubmissionIDsWithRecords).toBeDefined();
            expect(dataSyncDAO.findSubmissionIDsWithInProgressFileRecords).toBeDefined();
            expect(dataSyncDAO.findInProgressBySubmissionIDAndType).toBeUndefined();
        });
    });

    describe('listBySubmissionID', () => {
        let findManySpy;

        beforeEach(() => {
            findManySpy = jest.spyOn(dataSyncDAO, 'findMany').mockResolvedValue([]);
        });

        it('filters by submissionID', async () => {
            await dataSyncDAO.listBySubmissionID('123', DATA_SYNC_TYPE.FILE);
            const [filter] = findManySpy.mock.lastCall;
            expect(filter).toHaveProperty('submissionID', '123');
        });

        it('filters by type when provided', async () => {
            await dataSyncDAO.listBySubmissionID('123', DATA_SYNC_TYPE.FILE);
            const [filter] = findManySpy.mock.lastCall;
            expect(filter).toHaveProperty('type', DATA_SYNC_TYPE.FILE);
        });

        it('does not filter by type when omitted', async () => {
            for (const omittedType of [undefined, null, '']) {
                await dataSyncDAO.listBySubmissionID('123', omittedType);
                const [filter] = findManySpy.mock.lastCall;
                expect(filter).not.toHaveProperty('type');
            }
        });

        it('sorts by most recent startTime', async () => {
            await dataSyncDAO.listBySubmissionID('123', DATA_SYNC_TYPE.FILE);
            const [, option] = findManySpy.mock.lastCall;
            expect(option).toHaveProperty('sort.startTime', -1);
        });

    });

    describe('findLatestBySubmissionIDAndType', () => {
        let findFirstSpy;

        beforeEach(() => {
            findFirstSpy = jest.spyOn(dataSyncDAO, 'findFirst').mockResolvedValue(null);
        });

        it('filters by submissionID', async () => {
            await dataSyncDAO.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            const [filter] = findFirstSpy.mock.lastCall;
            expect(filter).toHaveProperty('submissionID', '123');
        });

        it('filters by type', async () => {
            await dataSyncDAO.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            const [filter] = findFirstSpy.mock.lastCall;
            expect(filter).toHaveProperty('type', DATA_SYNC_TYPE.METADATA);
        });

        it('sorts by most recent startTime', async () => {
            await dataSyncDAO.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            const [, option] = findFirstSpy.mock.lastCall;
            expect(option).toHaveProperty('sort.startTime', -1);
        });

    });

    describe('findSubmissionIDsWithInProgressFileRecords', () => {
        let distinctSpy;

        beforeEach(() => {
            distinctSpy = jest.spyOn(dataSyncDAO, 'distinct').mockResolvedValue([]);
        });

        it('queries distinct submission IDs for in-progress file syncs', async () => {
            distinctSpy.mockResolvedValue(['sub-1']);

            await expect(dataSyncDAO.findSubmissionIDsWithInProgressFileRecords()).resolves.toEqual(['sub-1']);

            expect(distinctSpy).toHaveBeenCalledWith('submissionID', {
                type: DATA_SYNC_TYPE.FILE,
                status: DATA_SYNC_STATUS.IN_PROGRESS,
            });
        });
    });

    describe('findSubmissionIDsWithRecords', () => {
        let distinctSpy;

        beforeEach(() => {
            distinctSpy = jest.spyOn(dataSyncDAO, 'distinct').mockResolvedValue([]);
        });

        it('returns an empty array without querying when given no ids', async () => {
            await expect(dataSyncDAO.findSubmissionIDsWithRecords([])).resolves.toEqual([]);
            await expect(dataSyncDAO.findSubmissionIDsWithRecords(undefined)).resolves.toEqual([]);

            expect(distinctSpy).not.toHaveBeenCalled();
        });

        it('queries distinct submission IDs that have a record of any type', async () => {
            distinctSpy.mockResolvedValue(['sub-1']);

            await expect(dataSyncDAO.findSubmissionIDsWithRecords(['sub-1', 'sub-2'])).resolves.toEqual(['sub-1']);

            expect(distinctSpy).toHaveBeenCalledTimes(1);
            expect(distinctSpy).toHaveBeenCalledWith('submissionID', {
                submissionID: { $in: ['sub-1', 'sub-2'] },
            });
        });
    });
});
