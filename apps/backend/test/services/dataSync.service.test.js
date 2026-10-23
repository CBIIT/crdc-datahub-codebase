const { DataSyncService } = require('../../services/dataSync.service');
const DataSyncDAO = require('../../dao/dataSync');
const { DATA_SYNC_STATUS, DATA_SYNC_TYPE } = require('../../constants/data-sync-constants');
const ERROR = require('../../constants/error-constants');
const { replaceErrorString } = require('../../utility/string-util');

let dataSyncService;

const TEST_DATE = new Date('2026-01-01T00:00:00.000Z');
const ALL_TEST_TYPES = {
    int: 0,
    string: 'str',
    boolean: false,
    date: TEST_DATE,
    object: {},
    array: [],
};

const FULL_DATA_SYNC = {
    _id: '123',
    type: DATA_SYNC_TYPE.METADATA,
    submissionID: 'sub-1',
    sourceFolder: 'source',
    targetFolder: 'target',
    startTime: TEST_DATE,
    endTime: TEST_DATE,
    status: DATA_SYNC_STATUS.SUCCEEDED,
    taskArn: 'taskArn',
    taskExecutionArn: 'taskExecutionArn',
};

describe('Data Sync service tests', () => {

    beforeEach(() => {
        dataSyncService = new DataSyncService();
    });

    describe('verify initialization', () => {

        it('should hold a DataSyncDAO', () => {
            expect(dataSyncService.dataSyncDAO).toBeInstanceOf(DataSyncDAO);
        });

        it('should have expected methods defined', () => {
            expect(dataSyncService.listBySubmissionID).toBeDefined();
            expect(dataSyncService.findLatestBySubmissionIDAndType).toBeDefined();
        });

        it('should not expose data sync writes', () => {
            expect(dataSyncService.createDataSync).toBeUndefined();
            expect(dataSyncService.updateDataSync).toBeUndefined();
            expect(dataSyncService.findInProgressBySubmissionIDAndType).toBeUndefined();
        });

    });

    describe('validate listBySubmissionID inputs', () => {

        it('validate submissionID', async () => {
            for (const missingValue of [undefined, null, '']) {
                await expect(dataSyncService.listBySubmissionID(
                    missingValue,
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'submissionID')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('submissionID').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.listBySubmissionID(
                    invalidTypes[type],
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'submissionID')
                );
            }
        });

        it('validate type', async () => {
            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('type').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.listBySubmissionID(
                    'sub-1',
                    invalidTypes[type]
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'type')
                );
            }

            const enumValues = dataSyncService.dataSyncDAO.model.schema.path('type').enumValues;
            await expect(dataSyncService.listBySubmissionID(
                'sub-1',
                `${enumValues[0]}-invalid`
            )).rejects.toThrow(
                replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_ENUM, 'type')
            );
        });

        it('allow an omitted type', async () => {
            const listSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'listBySubmissionID').mockResolvedValue([]);

            for (const omittedType of [undefined, null, '']) {
                await expect(dataSyncService.listBySubmissionID('sub-1', omittedType)).resolves.toEqual([]);
                expect(listSpy).toHaveBeenLastCalledWith('sub-1', undefined);
            }
        });

    });

    describe('validate listBySubmissionID response', () => {

        it('return the data sync records unchanged', async () => {
            const secondDataSync = { ...FULL_DATA_SYNC, _id: '456', type: DATA_SYNC_TYPE.FILE };
            const daoResult = [FULL_DATA_SYNC, secondDataSync];
            const listSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'listBySubmissionID').mockResolvedValue(daoResult);

            const dataSyncs = await dataSyncService.listBySubmissionID('sub-1');
            expect(dataSyncs).toBe(daoResult);
            expect(dataSyncs[0]).toBe(FULL_DATA_SYNC);
            expect(dataSyncs[0]).toEqual(expect.objectContaining({
                taskArn: 'taskArn',
                taskExecutionArn: 'taskExecutionArn',
                sourceFolder: 'source',
                targetFolder: 'target',
            }));
            expect(listSpy).toHaveBeenCalledWith('sub-1', undefined);
        });

        it('forward the type filter', async () => {
            const daoResult = [FULL_DATA_SYNC];
            const listSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'listBySubmissionID').mockResolvedValue(daoResult);

            const dataSyncs = await dataSyncService.listBySubmissionID('sub-1', DATA_SYNC_TYPE.METADATA);
            expect(dataSyncs).toBe(daoResult);
            expect(listSpy).toHaveBeenCalledWith('sub-1', DATA_SYNC_TYPE.METADATA);
        });

        it('return an empty array when no records match', async () => {
            const emptyResult = [];
            jest.spyOn(dataSyncService.dataSyncDAO, 'listBySubmissionID').mockResolvedValue(emptyResult);

            const dataSyncs = await dataSyncService.listBySubmissionID('sub-1', DATA_SYNC_TYPE.FILE);
            expect(dataSyncs).toBe(emptyResult);
        });

    });

    describe('validate findLatestBySubmissionIDAndType inputs', () => {

        it('validate submissionID', async () => {
            for (const missingValue of [undefined, null, '']) {
                await expect(dataSyncService.findLatestBySubmissionIDAndType(
                    missingValue,
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'submissionID')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('submissionID').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.findLatestBySubmissionIDAndType(
                    invalidTypes[type],
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'submissionID')
                );
            }
        });

        it('validate type', async () => {
            for (const missingValue of [undefined, null, '']) {
                await expect(dataSyncService.findLatestBySubmissionIDAndType(
                    'sub-1',
                    missingValue
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'type')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('type').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.findLatestBySubmissionIDAndType(
                    'sub-1',
                    invalidTypes[type]
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'type')
                );
            }

            const enumValues = dataSyncService.dataSyncDAO.model.schema.path('type').enumValues;
            await expect(dataSyncService.findLatestBySubmissionIDAndType(
                'sub-1',
                `${enumValues[0]}-invalid`
            )).rejects.toThrow(
                replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_ENUM, 'type')
            );
        });

    });

    describe('validate findLatestBySubmissionIDAndType response', () => {

        it('return the latest data sync record unchanged', async () => {
            const latestDataSync = { ...FULL_DATA_SYNC, _id: 'latest' };
            const findSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockResolvedValue(latestDataSync);

            const dataSync = await dataSyncService.findLatestBySubmissionIDAndType('sub-1', DATA_SYNC_TYPE.FILE);
            expect(dataSync).toBe(latestDataSync);
            expect(dataSync).toEqual(expect.objectContaining({
                taskArn: 'taskArn',
                taskExecutionArn: 'taskExecutionArn',
                sourceFolder: 'source',
                targetFolder: 'target',
            }));
            expect(findSpy).toHaveBeenCalledWith('sub-1', DATA_SYNC_TYPE.FILE);
        });

        it('return null when no record matches', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockResolvedValue(null);

            const dataSync = await dataSyncService.findLatestBySubmissionIDAndType('sub-1', DATA_SYNC_TYPE.METADATA);
            expect(dataSync).toBeNull();
        });

    });

    describe('propagate DAO failures', () => {
        const FAILED_TO_LIST_DATA_SYNC = 'Failed to find many DataSync';
        const FAILED_TO_FIND_LATEST_DATA_SYNC = 'Failed to find first DataSync';

        it('listBySubmissionID rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'listBySubmissionID').mockRejectedValue(new Error(FAILED_TO_LIST_DATA_SYNC));

            await expect(dataSyncService.listBySubmissionID('sub-1', DATA_SYNC_TYPE.METADATA)).rejects.toThrow(FAILED_TO_LIST_DATA_SYNC);
        });

        it('findLatestBySubmissionIDAndType rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockRejectedValue(new Error(FAILED_TO_FIND_LATEST_DATA_SYNC));

            await expect(dataSyncService.findLatestBySubmissionIDAndType('sub-1', DATA_SYNC_TYPE.METADATA)).rejects.toThrow(FAILED_TO_FIND_LATEST_DATA_SYNC);
        });
    });

});
