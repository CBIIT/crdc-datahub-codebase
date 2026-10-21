const SubmissionDAO = require('../../dao/submission');
const SubmissionModel = require('../../mongoose/models/submission');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { COMPLETED, DATA_TYPE } = require('../../constants/submission-constants');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');
const ERROR = require('../../constants/error-constants');
const { replaceErrorString } = require('../../utility/string-util');

let dao;

const TEST_DATE = new Date('2026-01-01T00:00:00.000Z');
const ALL_TEST_TYPES = {
    int: 0,
    string: 'str',
    boolean: false,
    date: TEST_DATE,
    object: {},
    array: [],
};

const FAILED_TO_UPDATE_SUBMISSION = 'Failed to update Submission';
const UPDATED_SUBMISSION = { _id: 'sub-1', fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED };

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
            expect(dao.updateDataSyncStatus).toBeDefined();
            expect(dao.getToBeArchivedSubmissions).toBeDefined();
        });

    });

    describe('validate updateDataSyncStatus inputs', () => {

        it('validate submissionID', async () => {
            for (const missingID of [undefined, null, '']) {
                await expect(dao.updateDataSyncStatus(
                    missingID,
                    DATA_SYNC_STATUS.SUCCEEDED,
                    undefined
                )).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_SUBMISSION_DATA_SYNC_MISSING_FIELD, 'submissionID')
                );
            }

            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes.string;
            for (const type in invalidTypes) {
                await expect(dao.updateDataSyncStatus(
                    invalidTypes[type],
                    DATA_SYNC_STATUS.SUCCEEDED,
                    undefined
                )).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_SUBMISSION_DATA_SYNC_INVALID_TYPE, 'submissionID')
                );
            }
        });

        function statusArgs(field, value) {
            return field === 'metadataDataSyncStatus'
                ? ['sub-1', value, undefined]
                : ['sub-1', undefined, value];
        }

        async function expectInvalidFieldTypesToThrowError(field) {
            const invalidTypes = { ...ALL_TEST_TYPES };
            delete invalidTypes[dao.model.schema.path(field).instance.toLowerCase()];
            for (const type in invalidTypes) {
                await expect(dao.updateDataSyncStatus(...statusArgs(field, invalidTypes[type]))).rejects.toThrow(
                    replaceErrorString(ERROR.UPDATE_SUBMISSION_DATA_SYNC_INVALID_TYPE, field)
                );
            }
        }

        async function expectInvalidEnumToThrowError(field) {
            const enumValues = dao.model.schema.path(field).enumValues;
            await expect(dao.updateDataSyncStatus(
                ...statusArgs(field, `${enumValues[0]}-invalid`)
            )).rejects.toThrow(
                replaceErrorString(ERROR.UPDATE_SUBMISSION_DATA_SYNC_INVALID_ENUM, field)
            );
        }

        const statusFields = [
            'metadataDataSyncStatus',
            'fileDataSyncStatus',
        ];

        for (const field of statusFields) {
            it(`validate ${field}`, async () => {
                for (const emptyValue of [null, '']) {
                    await expect(dao.updateDataSyncStatus(...statusArgs(field, emptyValue))).rejects.toThrow(
                        replaceErrorString(ERROR.UPDATE_SUBMISSION_DATA_SYNC_EMPTY_FIELD, field)
                    );
                }
                await expectInvalidFieldTypesToThrowError(field);
                if (dao.model.schema.path(field).enumValues?.length) {
                    await expectInvalidEnumToThrowError(field);
                }
            });
        }

        it('reject a call with neither status', async () => {
            const updateSpy = jest.spyOn(dao, 'update').mockResolvedValue(UPDATED_SUBMISSION);

            await expect(dao.updateDataSyncStatus('sub-1', undefined, undefined)).rejects.toThrow(
                ERROR.UPDATE_SUBMISSION_DATA_SYNC_NO_FIELDS
            );
            expect(updateSpy).not.toHaveBeenCalled();
        });

    });

    describe('validate updateDataSyncStatus response', () => {

        it('return the updated submission', async () => {
            const updateSpy = jest.spyOn(dao, 'update').mockResolvedValue(UPDATED_SUBMISSION);

            const submission = await dao.updateDataSyncStatus('sub-1', undefined, DATA_SYNC_STATUS.SUCCEEDED);
            expect(submission).toEqual(UPDATED_SUBMISSION);
            expect(updateSpy).toHaveBeenCalledWith('sub-1', {
                fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            }, false);
        });

        it('forward only provided status fields', async () => {
            const updateSpy = jest.spyOn(dao, 'update').mockResolvedValue(UPDATED_SUBMISSION);

            await dao.updateDataSyncStatus('sub-1', DATA_SYNC_STATUS.IN_PROGRESS, DATA_SYNC_STATUS.SUCCEEDED);
            expect(updateSpy).toHaveBeenCalledWith('sub-1', {
                metadataDataSyncStatus: DATA_SYNC_STATUS.IN_PROGRESS,
                fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
            }, false);
        });

        it('rejects with the DAO error', async () => {
            jest.spyOn(dao, 'update').mockRejectedValue(new Error(FAILED_TO_UPDATE_SUBMISSION));

            await expect(dao.updateDataSyncStatus(
                'sub-1',
                DATA_SYNC_STATUS.FAILED,
                undefined
            )).rejects.toThrow(FAILED_TO_UPDATE_SUBMISSION);
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
