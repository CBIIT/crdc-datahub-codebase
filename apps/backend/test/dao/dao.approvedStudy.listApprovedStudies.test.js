jest.mock('../../mongoose/models/approved-study', () => ({
    modelName: 'ApprovedStudy',
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));
jest.mock('../../crdc-datahub-database-drivers/domain/mongo-pagination');

const ApprovedStudyDAO = require('../../dao/approvedStudy');
const ApprovedStudyModel = require('../../mongoose/models/approved-study');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');
const { ORGANIZATION_COLLECTION, USER_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

describe('ApprovedStudyDAO - listApprovedStudies', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApprovedStudyDAO();
        ApprovedStudyModel.countDocuments.mockResolvedValue(1);
        ApprovedStudyModel.aggregate.mockResolvedValue([]);
        MongoPagination.mockImplementation(() => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                { $sort: { studyName: 1 } },
                { $skip: 0 },
                { $limit: 10 },
            ]),
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic functionality', () => {
        it('should call count and aggregate without $facet', async () => {
            ApprovedStudyModel.countDocuments.mockResolvedValue(1);
            ApprovedStudyModel.aggregate.mockResolvedValue([
                { _id: 'study1', studyName: 'Test Study' },
            ]);

            const result = await dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'studyName', 'asc'
            );

            expect(ApprovedStudyModel.countDocuments).toHaveBeenCalledTimes(1);
            expect(ApprovedStudyModel.aggregate).toHaveBeenCalledTimes(1);
            const pipeline = ApprovedStudyModel.aggregate.mock.calls[0][0];
            expect(pipeline.some((stage) => stage.$facet)).toBe(false);
            expect(result).toEqual([{
                total: 1,
                results: [{ id: 'study1', _id: 'study1', studyName: 'Test Study' }],
            }]);
        });

        it('should return empty results with zero total', async () => {
            ApprovedStudyModel.countDocuments.mockResolvedValue(0);
            ApprovedStudyModel.aggregate.mockResolvedValue([]);

            const result = await dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'studyName', 'asc'
            );

            expect(result).toEqual([{ total: 0, results: [] }]);
        });
    });

    describe('Filtering functionality', () => {
        it('should apply study name filter with case-insensitive regex', async () => {
            await dao.listApprovedStudies(
                'test study', null, null, null, null, 10, 0, 'studyName', 'asc'
            );

            const matches = ApprovedStudyModel.countDocuments.mock.calls[0][0];
            expect(matches.$or).toEqual([
                { studyName: { $regex: 'test study', $options: 'i' } },
                { studyAbbreviation: { $regex: 'test study', $options: 'i' } },
            ]);
            expect(ApprovedStudyModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: matches });
        });

        it('should apply controlled access filter correctly', async () => {
            await dao.listApprovedStudies(
                null, 'Controlled', null, null, null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].controlledAccess).toBe(true);
        });

        it('should apply open access filter correctly', async () => {
            await dao.listApprovedStudies(
                null, 'Open', null, null, null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].openAccess).toBe(true);
        });

        it('should not apply access filter for "All"', async () => {
            await dao.listApprovedStudies(
                null, 'All', null, null, null, 10, 0, 'studyName', 'asc'
            );
            const matches = ApprovedStudyModel.countDocuments.mock.calls[0][0];
            expect(matches.controlledAccess).toBeUndefined();
            expect(matches.openAccess).toBeUndefined();
        });

        it('should apply dbGaPID filter with case-insensitive regex', async () => {
            await dao.listApprovedStudies(
                null, null, 'phs123', null, null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].dbGaPID).toEqual({
                $regex: 'phs123',
                $options: 'i',
            });
        });

        it('escapes regex metacharacters in study and dbGaPID filters', async () => {
            await dao.listApprovedStudies(
                '***', null, '*', null, null, 10, 0, 'studyName', 'asc'
            );
            const matches = ApprovedStudyModel.countDocuments.mock.calls[0][0];
            expect(matches.$or).toEqual([
                { studyName: { $regex: '\\*\\*\\*', $options: 'i' } },
                { studyAbbreviation: { $regex: '\\*\\*\\*', $options: 'i' } },
            ]);
            expect(matches.dbGaPID).toEqual({
                $regex: '\\*',
                $options: 'i',
            });
        });

        it('should apply programID filter when not "All"', async () => {
            await dao.listApprovedStudies(
                null, null, null, 'program-123', null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].programID).toBe('program-123');
        });

        it('should not apply programID filter when "All"', async () => {
            await dao.listApprovedStudies(
                null, null, null, 'All', null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].programID).toBeUndefined();
        });

        it('should apply statuses filter with $in when non-empty', async () => {
            await dao.listApprovedStudies(
                null, null, null, null, ['Active', 'Inactive'], 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].status).toEqual({
                $in: ['Active', 'Inactive'],
            });
        });

        it('should not apply statuses filter when null or empty', async () => {
            await dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[0][0].status).toBeUndefined();

            await dao.listApprovedStudies(
                null, null, null, null, [], 10, 0, 'studyName', 'asc'
            );
            expect(ApprovedStudyModel.countDocuments.mock.calls[1][0].status).toBeUndefined();
        });

        it('should throw error for invalid controlled access value', async () => {
            await expect(dao.listApprovedStudies(
                null, 'Invalid', null, null, null, 10, 0, 'studyName', 'asc'
            )).rejects.toThrow('Invalid controlled access');
        });
    });

    describe('Pipeline structure', () => {
        it('should match before lookups and include enrichment stages', async () => {
            await dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'studyName', 'asc'
            );

            const pipeline = ApprovedStudyModel.aggregate.mock.calls[0][0];
            expect(pipeline[0].$match).toBeDefined();
            expect(pipeline[1].$lookup.from).toBe(ORGANIZATION_COLLECTION);
            expect(pipeline[1].$lookup.localField).toBe('programID');
            expect(pipeline[1].$lookup.foreignField).toBe('_id');
            expect(pipeline[2].$lookup.from).toBe(USER_COLLECTION);
            expect(pipeline[2].$lookup.localField).toBe('primaryContactID');
            expect(pipeline[2].$lookup.foreignField).toBe('_id');
            expect(pipeline[3].$addFields.program).toEqual({ $arrayElemAt: ['$program', 0] });
            expect(pipeline[4].$addFields.primaryContact._id).toEqual({
                $cond: [
                    '$useProgramPC',
                    '$program.conciergeID',
                    '$primaryContact._id',
                ],
            });
        });

        it('should create programSort field for program.name sorting', async () => {
            await dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'program.name', 'asc'
            );

            const pipeline = ApprovedStudyModel.aggregate.mock.calls[0][0];
            const programSortStage = pipeline.find((stage) => stage.$set?.programSort);
            expect(programSortStage.$set.programSort).toEqual({ $toLower: '$program.name' });
            expect(MongoPagination).toHaveBeenCalledWith(10, 0, 'programSort', 'asc');
        });

        it('should pass correct parameters to MongoPagination', async () => {
            await dao.listApprovedStudies(
                'test', 'Controlled', 'phs123', 'program-1', null, 20, 10, 'studyName', 'desc'
            );
            expect(MongoPagination).toHaveBeenCalledWith(20, 10, 'studyName', 'desc');
        });
    });

    describe('Error handling', () => {
        it('should propagate aggregation errors', async () => {
            ApprovedStudyModel.aggregate.mockRejectedValue(new Error('Database connection failed'));

            await expect(dao.listApprovedStudies(
                null, null, null, null, null, 10, 0, 'studyName', 'asc'
            )).rejects.toThrow('Failed to aggregate ApprovedStudy');
        });
    });
});
