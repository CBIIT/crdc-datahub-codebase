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

const MINIMAL_DATA_SYNC = {
    type: DATA_SYNC_TYPE.METADATA,
    submissionID: '123',
    sourceFolder: 'source',
    targetFolder: 'target',
    startTime: TEST_DATE,
    status: DATA_SYNC_STATUS.IN_PROGRESS,
}

const FULL_DATA_SYNC = {
    ...MINIMAL_DATA_SYNC,
    taskArn: 'taskArn',
    taskExecutionArn: 'taskExecutionArn',
    endTime: TEST_DATE,
    _id: '123',
}

describe('Data Sync service tests', () => {

    beforeEach(() => {
        dataSyncService = new DataSyncService();
    });

    describe('verify initialization', () => {

        it('should hold a DataSyncDAO', () => {
            expect(dataSyncService.dataSyncDAO).toBeInstanceOf(DataSyncDAO);
        });

        it('should have expected methods defined', () => {
            expect(dataSyncService.createDataSync).toBeDefined();
            expect(dataSyncService.updateDataSync).toBeDefined();
            expect(dataSyncService.findLatestBySubmissionIDAndType).toBeDefined();
            expect(dataSyncService.findInProgressBySubmissionIDAndType).toBeDefined();
        });

    });

    describe('validate required fields before creating a record', () => {
        
        async function expectInvalidFieldTypesToThrowError(record, field) {
            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path(field).instance.toLowerCase()];
            for (const type in invalidTypes) {
                record[field] = invalidTypes[type];
                await expect(dataSyncService.createDataSync(record)).rejects.toThrow(
                    replaceErrorString(ERROR.CREATE_DATA_SYNC_INVALID_TYPE, field)
                );
            }
        }

        async function expectInvalidEnumToThrowError(record, field) {
            const enumValues = dataSyncService.dataSyncDAO.model.schema.path(field).enumValues;
            record[field] = `${enumValues[0]}-invalid`;
            await expect(dataSyncService.createDataSync(record)).rejects.toThrow(
                replaceErrorString(ERROR.CREATE_DATA_SYNC_INVALID_ENUM, field)
            );
        }

        const requiredFields = [
            'type',
            'submissionID',
            'sourceFolder',
            'targetFolder',
            'startTime',
            'status',
        ];

        for (const field of requiredFields) {
            it(`validate ${field}`, async () => {
                const missingFieldsDataSync = {
                    ... FULL_DATA_SYNC,
                };
                for (const missingValue of [undefined, null, '']) {
                    missingFieldsDataSync[field] = missingValue;
                    await expect(dataSyncService.createDataSync(missingFieldsDataSync)).rejects.toThrow(
                        replaceErrorString(ERROR.CREATE_DATA_SYNC_MISSING_FIELD, field)
                    );
                }
                await expectInvalidFieldTypesToThrowError(missingFieldsDataSync, field);
                if (dataSyncService.dataSyncDAO.model.schema.path(field).enumValues?.length) {
                    await expectInvalidEnumToThrowError(missingFieldsDataSync, field);
                }
            });
        }
    });

    describe('validate updateDataSync inputs', () => {

        it('validate dataSyncID', async () => {
            for (const missingID of [undefined, null, '']) {
                await expect(dataSyncService.updateDataSync(
                    missingID,
                    { status: DATA_SYNC_STATUS.SUCCEEDED }
                )).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_DATA_SYNC_MISSING_FIELD, 'dataSyncID')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes.string;
            for (const type in invalidTypes) {
                await expect(dataSyncService.updateDataSync(
                    invalidTypes[type],
                    { status: DATA_SYNC_STATUS.SUCCEEDED }
                )).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_DATA_SYNC_INVALID_TYPE, 'dataSyncID')
                );
            }
        });

        async function expectInvalidFieldTypesToThrowError(updates, field) {
            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path(field).instance.toLowerCase()];
            for (const type in invalidTypes) {
                updates[field] = invalidTypes[type];
                await expect(dataSyncService.updateDataSync('sync-1', updates)).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_DATA_SYNC_INVALID_TYPE, field)
                );
            }
        }

        async function expectInvalidEnumToThrowError(updates, field) {
            const enumValues = dataSyncService.dataSyncDAO.model.schema.path(field).enumValues;
            updates[field] = `${enumValues[0]}-invalid`;
            await expect(dataSyncService.updateDataSync('sync-1', updates)).rejects.toThrow(
                replaceErrorString(ERROR.UPDATE_DATA_SYNC_INVALID_ENUM, field)
            );
        }

        const updatableFields = [
            'status',
            'endTime',
            'taskArn',
            'taskExecutionArn',
        ];

        for (const field of updatableFields) {
            it(`validate ${field}`, async () => {
                for (const missingValue of [null, '']) {
                    await expect(dataSyncService.updateDataSync('sync-1', { [field]: missingValue })).rejects.toThrow(
                        replaceErrorString(ERROR.UPDATE_DATA_SYNC_EMPTY_FIELD, field)
                    );
                }
                const updates = {};
                await expectInvalidFieldTypesToThrowError(updates, field);
                if (dataSyncService.dataSyncDAO.model.schema.path(field).enumValues?.length) {
                    await expectInvalidEnumToThrowError(updates, field);
                }
            });
        }

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

    describe('validate findInProgressBySubmissionIDAndType inputs', () => {

        it('validate submissionID', async () => {
            for (const missingValue of [undefined, null, '']) {
                await expect(dataSyncService.findInProgressBySubmissionIDAndType(
                    missingValue,
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'submissionID')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('submissionID').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.findInProgressBySubmissionIDAndType(
                    invalidTypes[type],
                    DATA_SYNC_TYPE.METADATA
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'submissionID')
                );
            }
        });

        it('validate type', async () => {
            for (const missingValue of [undefined, null, '']) {
                await expect(dataSyncService.findInProgressBySubmissionIDAndType(
                    'sub-1',
                    missingValue
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_MISSING_FIELD, 'type')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path('type').instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dataSyncService.findInProgressBySubmissionIDAndType(
                    'sub-1',
                    invalidTypes[type]
                )).rejects.toThrow(
                    replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_TYPE, 'type')
                );
            }

            const enumValues = dataSyncService.dataSyncDAO.model.schema.path('type').enumValues;
            await expect(dataSyncService.findInProgressBySubmissionIDAndType(
                'sub-1',
                `${enumValues[0]}-invalid`
            )).rejects.toThrow(
                replaceErrorString(ERROR.FIND_DATA_SYNC_INVALID_ENUM, 'type')
            );
        });

    });

    describe('validate createDataSync response', () => {

        it('return the created data sync record', async () => {
            const createdDataSync = { ...FULL_DATA_SYNC, _id: 'from-dao' };
            jest.spyOn(dataSyncService.dataSyncDAO, 'create').mockResolvedValue(createdDataSync);

            const dataSync = await dataSyncService.createDataSync(FULL_DATA_SYNC);
            expect(dataSync).toEqual(createdDataSync);
        });

    });

    describe('validate updateDataSync response', () => {

        it('return the updated data sync record', async () => {
            const updateSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'update').mockResolvedValue(FULL_DATA_SYNC);
            const updates = { status: DATA_SYNC_STATUS.SUCCEEDED };

            const dataSync = await dataSyncService.updateDataSync('123', updates);
            expect(dataSync).toEqual(FULL_DATA_SYNC);
            expect(updateSpy).toHaveBeenCalledWith('123', updates, false);
        });

        it('forward only whitelisted update fields', async () => {
            const updateSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'update').mockResolvedValue(FULL_DATA_SYNC);

            await dataSyncService.updateDataSync('123', {
                status: DATA_SYNC_STATUS.SUCCEEDED,
                endTime: undefined,
                submissionID: 'should-not-forward',
            });
            expect(updateSpy).toHaveBeenCalledWith(
                '123',
                { status: DATA_SYNC_STATUS.SUCCEEDED },
                false
            );
        });

    });

    describe('validate findLatestBySubmissionIDAndType response', () => {

        it('return the latest data sync record', async () => {
            const findSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockResolvedValue(FULL_DATA_SYNC);

            const dataSync = await dataSyncService.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            expect(dataSync).toEqual(FULL_DATA_SYNC);
            expect(findSpy).toHaveBeenCalledWith('123', DATA_SYNC_TYPE.METADATA);
        });

        it('return null when no record matches', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockResolvedValue(null);

            const dataSync = await dataSyncService.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            expect(dataSync).toBeNull();
        });

    });

    describe('validate findInProgressBySubmissionIDAndType response', () => {

        it('return an array of data sync records', async () => {
            const secondDataSync = { ...FULL_DATA_SYNC, _id: '456' };
            const findSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'findInProgressBySubmissionIDAndType').mockResolvedValue([FULL_DATA_SYNC, secondDataSync]);

            const dataSyncs = await dataSyncService.findInProgressBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            expect(dataSyncs).toEqual([FULL_DATA_SYNC, secondDataSync]);
            expect(findSpy).toHaveBeenCalledWith('123', DATA_SYNC_TYPE.METADATA);
        });

        it('return an empty array when no records match', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findInProgressBySubmissionIDAndType').mockResolvedValue([]);

            const dataSyncs = await dataSyncService.findInProgressBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA);
            expect(dataSyncs).toEqual([]);
        });

    });

    describe('propagate DAO failures', () => {
        const FAILED_TO_CREATE_DATA_SYNC = 'Failed to create DataSync';
        const FAILED_TO_UPDATE_DATA_SYNC = 'Failed to update DataSync';
        const FAILED_TO_FIND_LATEST_DATA_SYNC = 'Failed to find first DataSync';
        const FAILED_TO_FIND_IN_PROGRESS_DATA_SYNC = 'Failed to find many DataSync';

        it('createDataSync rejects with the generic create message', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'create').mockRejectedValue(new Error(FAILED_TO_CREATE_DATA_SYNC));

            await expect(dataSyncService.createDataSync(FULL_DATA_SYNC)).rejects.toThrow(FAILED_TO_CREATE_DATA_SYNC);
        });

        it('updateDataSync rejects with the generic update message', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'update').mockRejectedValue(new Error(FAILED_TO_UPDATE_DATA_SYNC));

            await expect(dataSyncService.updateDataSync('123', { status: DATA_SYNC_STATUS.SUCCEEDED })).rejects.toThrow(FAILED_TO_UPDATE_DATA_SYNC);
        });

        it('findLatestBySubmissionIDAndType rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findLatestBySubmissionIDAndType').mockRejectedValue(new Error(FAILED_TO_FIND_LATEST_DATA_SYNC));

            await expect(dataSyncService.findLatestBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA)).rejects.toThrow(FAILED_TO_FIND_LATEST_DATA_SYNC);
        });

        it('findInProgressBySubmissionIDAndType rejects with the DAO error', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'findInProgressBySubmissionIDAndType').mockRejectedValue(new Error(FAILED_TO_FIND_IN_PROGRESS_DATA_SYNC));

            await expect(dataSyncService.findInProgressBySubmissionIDAndType('123', DATA_SYNC_TYPE.METADATA)).rejects.toThrow(FAILED_TO_FIND_IN_PROGRESS_DATA_SYNC);
        });
    });

    describe('validate optional create fields', () => {

        const optionalFields = [
            'taskArn',
            'taskExecutionArn',
            'endTime',
            '_id',
        ];

        for (const field of optionalFields) {
            it(`reject null or empty ${field}`, async () => {
                for (const emptyValue of [null, '']) {
                    const record = { ...FULL_DATA_SYNC, [field]: emptyValue };
                    await expect(dataSyncService.createDataSync(record)).rejects.toThrow(
                        replaceErrorString(ERROR.CREATE_DATA_SYNC_EMPTY_FIELD, field)
                    );
                }
            });

            it(`reject invalid type for ${field}`, async () => {
                const invalidTypes = { ...ALL_TEST_TYPES };
                delete invalidTypes[dataSyncService.dataSyncDAO.model.schema.path(field).instance.toLowerCase()];
                for (const type in invalidTypes) {
                    const record = { ...FULL_DATA_SYNC, [field]: invalidTypes[type] };
                    await expect(dataSyncService.createDataSync(record)).rejects.toThrow(
                        replaceErrorString(ERROR.CREATE_DATA_SYNC_INVALID_TYPE, field)
                    );
                }
            });
        }

    });

    describe('create payload and null writes', () => {

        it('does not forward unknown keys', async () => {
            const createdDataSync = { ...FULL_DATA_SYNC, _id: 'from-dao' };
            const createSpy = jest.spyOn(dataSyncService.dataSyncDAO, 'create').mockResolvedValue(createdDataSync);

            await dataSyncService.createDataSync({ ...FULL_DATA_SYNC, notAField: 'ignored' });
            expect(createSpy).toHaveBeenCalledWith(FULL_DATA_SYNC);
        });

        it('create resolving to null rejects with the generic create message', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'create').mockResolvedValue(null);

            await expect(dataSyncService.createDataSync(FULL_DATA_SYNC)).rejects.toThrow('Failed to create DataSync');
        });

        it('update resolving to null rejects with the generic update message', async () => {
            jest.spyOn(dataSyncService.dataSyncDAO, 'update').mockResolvedValue(null);

            await expect(dataSyncService.updateDataSync('123', { status: DATA_SYNC_STATUS.SUCCEEDED })).rejects.toThrow('Failed to update DataSync');
        });

    });

});