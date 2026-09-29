jest.mock('../../mongoose/models/data-record', () => ({
    modelName: 'DataRecord',
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
}));

const DataRecordDAO = require('../../dao/dataRecords');
const DataRecordModel = require('../../mongoose/models/data-record');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { VALIDATION_STATUS } = require('../../constants/submission-constants');

describe('DataRecordDAO', () => {
    let dataRecordDAO;

    beforeEach(() => {
        dataRecordDAO = new DataRecordDAO();
        jest.clearAllMocks();
    });

    it('extends MongooseGenericDAO and uses the DataRecord model', () => {
        expect(dataRecordDAO).toBeInstanceOf(MongooseGenericDAO);
        expect(dataRecordDAO.model).toBe(DataRecordModel);
        expect(dataRecordDAO.model.modelName).toBe('DataRecord');
    });

    describe('getStats', () => {
        it('aggregates per-node-type status counts into the expected shape', async () => {
            DataRecordModel.aggregate.mockResolvedValue([
                { submissionID: 'sub-1', nodeType: 'participant', status: VALIDATION_STATUS.NEW, count: 2 },
                { submissionID: 'sub-1', nodeType: 'participant', status: VALIDATION_STATUS.PASSED, count: 3 },
                { submissionID: 'sub-1', nodeType: 'sample', status: VALIDATION_STATUS.ERROR, count: 1 },
            ]);

            const result = await dataRecordDAO.getStats('sub-1', [
                VALIDATION_STATUS.NEW,
                VALIDATION_STATUS.PASSED,
                VALIDATION_STATUS.WARNING,
                VALIDATION_STATUS.ERROR,
            ]);

            expect(DataRecordModel.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    $match: {
                        submissionID: 'sub-1',
                        status: {
                            $in: [
                                VALIDATION_STATUS.NEW,
                                VALIDATION_STATUS.PASSED,
                                VALIDATION_STATUS.WARNING,
                                VALIDATION_STATUS.ERROR,
                            ],
                        },
                    },
                }),
            ]));
            expect(result).toEqual([
                {
                    submissionID: 'sub-1',
                    stats: [
                        { nodeName: 'participant', new: 2, passed: 3, warning: 0, error: 0, total: 5 },
                        { nodeName: 'sample', new: 0, passed: 0, warning: 0, error: 1, total: 1 },
                    ],
                },
            ]);
        });
    });

    describe('getSubmissionNodes', () => {
        it('runs split count and results aggregates', async () => {
            DataRecordModel.aggregate
                .mockResolvedValueOnce([{ total: 2 }])
                .mockResolvedValueOnce([
                    { nodeID: 'n1', nodeType: 'participant' },
                    { nodeID: 'n2', nodeType: 'participant' },
                ]);

            const result = await dataRecordDAO.getSubmissionNodes(
                'sub-1',
                'participant',
                10,
                0,
                'nodeID',
                'asc'
            );

            expect(DataRecordModel.aggregate).toHaveBeenCalledTimes(2);
            expect(result).toEqual({
                total: 2,
                results: [
                    { nodeID: 'n1', nodeType: 'participant' },
                    { nodeID: 'n2', nodeType: 'participant' },
                ],
            });
        });
    });

    describe('getDistinctParentRelationshipKeys', () => {
        it('returns distinct parent relationship keys', async () => {
            DataRecordModel.aggregate.mockResolvedValue([
                { keys: ['sample.sample_id', 'participant.study_participant_id'] },
            ]);
            const q = { submissionID: 's1', nodeType: 'study_diagnosis' };
            const keys = await dataRecordDAO.getDistinctParentRelationshipKeys(q);
            expect(keys).toEqual(['sample.sample_id', 'participant.study_participant_id']);
            expect(DataRecordModel.aggregate).toHaveBeenCalledTimes(1);
            expect(DataRecordModel.aggregate.mock.calls[0][0][0].$match).toEqual(q);
        });

        it('returns empty array for invalid query without aggregating', async () => {
            expect(await dataRecordDAO.getDistinctParentRelationshipKeys(null)).toEqual([]);
            expect(await dataRecordDAO.getDistinctParentRelationshipKeys([])).toEqual([]);
            expect(DataRecordModel.aggregate).not.toHaveBeenCalled();
        });
    });

    describe('getDistinctPropsTopLevelKeys', () => {
        it('returns distinct top-level props keys', async () => {
            DataRecordModel.aggregate.mockResolvedValue([
                { keys: ['study_diagnosis_id', 'site_id'] },
            ]);
            const q = { submissionID: 's1', nodeType: 'study_diagnosis' };
            const keys = await dataRecordDAO.getDistinctPropsTopLevelKeys(q);
            expect(keys).toEqual(['study_diagnosis_id', 'site_id']);
            expect(DataRecordModel.aggregate).toHaveBeenCalledTimes(1);
            expect(DataRecordModel.aggregate.mock.calls[0][0][0].$match).toEqual(q);
        });

        it('returns empty array for invalid query without aggregating', async () => {
            expect(await dataRecordDAO.getDistinctPropsTopLevelKeys(null)).toEqual([]);
            expect(DataRecordModel.aggregate).not.toHaveBeenCalled();
        });
    });

    describe('resetDataRecords', () => {
        const fileStatusUpdate = {
            $set: {
                status: VALIDATION_STATUS.NEW,
                updatedAt: expect.any(Date),
                's3FileInfo.status': VALIDATION_STATUS.NEW
            }
        };
        const recordStatusUpdate = {
            $set: {
                status: VALIDATION_STATUS.NEW,
                updatedAt: expect.any(Date)
            }
        };

        it('sets both statuses on file records and top-level status on the complement', async () => {
            DataRecordModel.updateMany
                .mockResolvedValueOnce({ acknowledged: true, modifiedCount: 2, matchedCount: 2 })
                .mockResolvedValueOnce({ acknowledged: true, modifiedCount: 8, matchedCount: 8 });

            const result = await dataRecordDAO.resetDataRecords('sub-1', VALIDATION_STATUS.NEW);

            expect(result).toEqual({ acknowledged: true, matchedCount: 10, modifiedCount: 10 });
            expect(DataRecordModel.updateMany).toHaveBeenNthCalledWith(
                1,
                {
                    submissionID: 'sub-1',
                    's3FileInfo.status': { $exists: true, $ne: null }
                },
                fileStatusUpdate
            );
            expect(DataRecordModel.updateMany).toHaveBeenNthCalledWith(
                2,
                {
                    submissionID: 'sub-1',
                    's3FileInfo.status': null
                },
                recordStatusUpdate
            );
            expect(Array.isArray(DataRecordModel.updateMany.mock.calls[0][1])).toBe(false);
            expect(Array.isArray(DataRecordModel.updateMany.mock.calls[1][1])).toBe(false);
        });

        it('returns acknowledged false when either update is not acknowledged', async () => {
            DataRecordModel.updateMany
                .mockResolvedValueOnce({ acknowledged: true, modifiedCount: 2, matchedCount: 2 })
                .mockResolvedValueOnce({ acknowledged: false, modifiedCount: 0, matchedCount: 8 });

            const result = await dataRecordDAO.resetDataRecords('sub-1', VALIDATION_STATUS.NEW);

            expect(result).toEqual({ acknowledged: false, matchedCount: 10, modifiedCount: 2 });
        });

        it('throws the generic update error when an update fails', async () => {
            DataRecordModel.updateMany.mockRejectedValue(new Error('db down'));

            await expect(dataRecordDAO.resetDataRecords('sub-1', VALIDATION_STATUS.NEW))
                .rejects.toThrow('Failed to update many DataRecord');
        });
    });

    describe('resetS3FileLinkedMetadataStatusToNew', () => {
        it('updates selected file links with a standard update document', async () => {
            const updateResult = { acknowledged: true, modifiedCount: 2, matchedCount: 2 };
            DataRecordModel.updateMany.mockResolvedValue(updateResult);

            const result = await dataRecordDAO.resetS3FileLinkedMetadataStatusToNew(
                'sub-1',
                ['a.txt', 'b.txt']
            );

            expect(result).toEqual(updateResult);
            expect(DataRecordModel.updateMany).toHaveBeenCalledWith(
                {
                    submissionID: 'sub-1',
                    s3FileInfo: { $exists: true, $ne: null },
                    's3FileInfo.fileName': { $in: ['a.txt', 'b.txt'] }
                },
                {
                    $set: {
                        updatedAt: expect.any(Date),
                        's3FileInfo.status': VALIDATION_STATUS.NEW
                    }
                }
            );
            expect(Array.isArray(DataRecordModel.updateMany.mock.calls[0][1])).toBe(false);
        });

        it('updates every linked file when fileNames is null', async () => {
            DataRecordModel.updateMany.mockResolvedValue({
                acknowledged: true,
                modifiedCount: 5,
                matchedCount: 5
            });

            await dataRecordDAO.resetS3FileLinkedMetadataStatusToNew('sub-1', null);

            expect(DataRecordModel.updateMany).toHaveBeenCalledWith(
                {
                    submissionID: 'sub-1',
                    s3FileInfo: { $exists: true, $ne: null }
                },
                {
                    $set: {
                        updatedAt: expect.any(Date),
                        's3FileInfo.status': VALIDATION_STATUS.NEW
                    }
                }
            );
        });

        it('updates every linked file when fileNames is omitted', async () => {
            DataRecordModel.updateMany.mockResolvedValue({
                acknowledged: true,
                modifiedCount: 5,
                matchedCount: 5
            });

            await dataRecordDAO.resetS3FileLinkedMetadataStatusToNew('sub-1');

            expect(DataRecordModel.updateMany).toHaveBeenCalledWith(
                {
                    submissionID: 'sub-1',
                    s3FileInfo: { $exists: true, $ne: null }
                },
                {
                    $set: {
                        updatedAt: expect.any(Date),
                        's3FileInfo.status': VALIDATION_STATUS.NEW
                    }
                }
            );
        });

        it('returns an acknowledged no-op for an empty fileNames array', async () => {
            const result = await dataRecordDAO.resetS3FileLinkedMetadataStatusToNew('sub-1', []);

            expect(result).toEqual({ acknowledged: true, modifiedCount: 0, matchedCount: 0 });
            expect(DataRecordModel.updateMany).not.toHaveBeenCalled();
        });
    });

    describe('deleteManyWithResult', () => {
        it('delegates to the model and returns the native delete result', async () => {
            DataRecordModel.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 4 });
            const result = await dataRecordDAO.deleteManyWithResult({ submissionID: 'sub-1' });
            expect(DataRecordModel.deleteMany).toHaveBeenCalledWith({ submissionID: 'sub-1' });
            expect(result).toEqual({ acknowledged: true, deletedCount: 4 });
        });
    });
});
