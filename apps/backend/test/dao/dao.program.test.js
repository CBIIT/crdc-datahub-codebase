jest.mock('../../mongoose/models/program', () => ({
    modelName: 'Program',
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

const ProgramDAO = require('../../dao/program');
const ProgramModel = require('../../mongoose/models/program');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { ERROR: SUBMODULE_ERROR } = require('../../crdc-datahub-database-drivers/constants/error-constants');
const { APPROVED_STUDIES_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
    };
}

describe('ProgramDAO', () => {
    let programDAO;

    beforeEach(() => {
        programDAO = new ProgramDAO();
        jest.clearAllMocks();
    });

    it('extends MongooseGenericDAO with the Program model', () => {
        expect(programDAO).toBeInstanceOf(MongooseGenericDAO);
        expect(programDAO.model).toBe(ProgramModel);
        expect(programDAO._modelName).toBe('Program');
    });

    describe('getProgramByName', () => {
        it('should find program with trimmed name', async () => {
            const mockResult = { _id: 'org123', name: 'Cancer Research Program' };
            ProgramModel.findOne.mockReturnValue(createLeanQuery(mockResult));

            const result = await programDAO.getProgramByName('  Cancer Research Program  ');

            expect(ProgramModel.findOne).toHaveBeenCalledWith({ name: 'Cancer Research Program' });
            expect(result).toEqual({
                ...mockResult,
                id: 'org123',
                _id: 'org123',
            });
        });

        it('should return null when not found', async () => {
            ProgramModel.findOne.mockReturnValue(createLeanQuery(null));

            const result = await programDAO.getProgramByName('Missing');

            expect(result).toBeNull();
        });

        it('should return null for null input without querying', async () => {
            const result = await programDAO.getProgramByName(null);

            expect(result).toBeNull();
            expect(ProgramModel.findOne).not.toHaveBeenCalled();
        });

        it('should return null for whitespace-only input without querying', async () => {
            const result = await programDAO.getProgramByName('   ');

            expect(result).toBeNull();
            expect(ProgramModel.findOne).not.toHaveBeenCalled();
        });

        it('should handle database errors', async () => {
            ProgramModel.findOne.mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error('Database connection failed')),
            });

            await expect(programDAO.getProgramByName('Test Program'))
                .rejects.toThrow('Failed to find first Program');
        });
    });

    describe('findOneByProgramName', () => {
        it('should match case-insensitively', async () => {
            const mockResult = { _id: 'org123', name: 'Cancer Research Program' };
            ProgramModel.findOne.mockReturnValue(createLeanQuery(mockResult));

            const result = await programDAO.findOneByProgramName('cancer research program');

            expect(ProgramModel.findOne).toHaveBeenCalledWith({
                name: {
                    $regex: '^cancer research program$',
                    $options: 'i',
                },
            });
            expect(result).toEqual({
                ...mockResult,
                id: 'org123',
                _id: 'org123',
            });
        });

        it('should return null for empty name', async () => {
            const result = await programDAO.findOneByProgramName('   ');
            expect(result).toBeNull();
            expect(ProgramModel.findOne).not.toHaveBeenCalled();
        });
    });

    describe('getProgramByID', () => {
        it('should throw when includeStudies is omitted', async () => {
            await expect(programDAO.getProgramByID('org123')).rejects.toThrow(
                SUBMODULE_ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT
            );
        });

        it('should find program by ID without studies', async () => {
            const mockOrg = { _id: 'org123', name: 'Test Organization' };
            ProgramModel.findById.mockReturnValue(createLeanQuery(mockOrg));

            const result = await programDAO.getProgramByID('org123', false);

            expect(ProgramModel.findById).toHaveBeenCalledWith('org123');
            expect(result).toEqual({ ...mockOrg, id: 'org123', _id: 'org123' });
        });

        it('should return null when program not found', async () => {
            ProgramModel.findById.mockReturnValue(createLeanQuery(null));

            const result = await programDAO.getProgramByID('nonexistent', false);

            expect(result).toBeNull();
        });

        it('should handle database errors', async () => {
            ProgramModel.findById.mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error('Database connection failed')),
            });

            await expect(programDAO.getProgramByID('org123', false))
                .rejects.toThrow('Failed to find Program by ID');
        });

        it('should include studies when includeStudies is true', async () => {
            const mockStudies = [
                { _id: 'study1', studyAbbreviation: 'ABC', studyName: 'Study A' },
            ];
            const mockOrg = {
                _id: 'org123',
                name: 'Test Organization',
                studies: mockStudies,
            };
            ProgramModel.aggregate.mockResolvedValue([mockOrg]);

            const result = await programDAO.getProgramByID('org123', true);

            expect(ProgramModel.aggregate).toHaveBeenCalledWith([
                { $match: { _id: 'org123' } },
                {
                    $lookup: {
                        from: APPROVED_STUDIES_COLLECTION,
                        localField: '_id',
                        foreignField: 'programID',
                        as: 'studies',
                    },
                },
            ]);
            expect(result).toEqual({
                id: 'org123',
                _id: 'org123',
                name: 'Test Organization',
                studies: mockStudies,
            });
        });

        it('should return null when not found and includeStudies is true', async () => {
            ProgramModel.aggregate.mockResolvedValue([]);

            const result = await programDAO.getProgramByID('org123', true);

            expect(result).toBeNull();
        });

        it('should handle database errors when includeStudies is true', async () => {
            ProgramModel.aggregate.mockRejectedValue(new Error('Database connection failed'));

            await expect(
                programDAO.getProgramByID('org123', true)
            ).rejects.toThrow('Failed to aggregate Program');
        });
    });

    describe('listPrograms', () => {
        it('should call count and aggregate without $facet', async () => {
            const statusCondition = { status: 'Active' };
            const mockResults = [{ _id: 'org1', name: 'Program A', studies: [] }];
            ProgramModel.countDocuments.mockResolvedValue(1);
            ProgramModel.aggregate.mockResolvedValue(mockResults);

            const result = await programDAO.listPrograms(10, 0, 'updateAt', 'ASC', statusCondition);

            expect(ProgramModel.countDocuments).toHaveBeenCalledTimes(1);
            expect(ProgramModel.countDocuments).toHaveBeenCalledWith(statusCondition);
            expect(ProgramModel.aggregate).toHaveBeenCalledTimes(1);
            const pipeline = ProgramModel.aggregate.mock.calls[0][0];
            expect(pipeline.some((stage) => stage.$facet)).toBe(false);
            expect(result).toEqual({
                total: 1,
                results: [{ ...mockResults[0], id: 'org1', _id: 'org1' }],
            });
        });

        it('should $match using the provided statusCondition', async () => {
            const statusCondition = { status: 'Active' };
            ProgramModel.countDocuments.mockResolvedValue(0);
            ProgramModel.aggregate.mockResolvedValue([]);

            await programDAO.listPrograms(10, 0, 'updateAt', 'ASC', statusCondition);
            const pipeline = ProgramModel.aggregate.mock.calls[0][0];
            const matchStage = pipeline.find((stage) => stage.$match);
            expect(matchStage.$match).toEqual(statusCondition);
        });

        it('should return empty results with zero total', async () => {
            ProgramModel.countDocuments.mockResolvedValue(0);
            ProgramModel.aggregate.mockResolvedValue([]);

            const result = await programDAO.listPrograms(10, 0, 'updateAt', 'ASC', { status: 'Active' });

            expect(result).toEqual({ total: 0, results: [] });
        });
    });

    describe('upsertByName', () => {
        it('should upsert and map id/_id', async () => {
            const doc = { name: 'New Program', status: 'Active' };
            ProgramModel.findOneAndUpdate.mockResolvedValue({ _id: 'org-new', ...doc });

            const result = await programDAO.upsertByName('New Program', doc);

            expect(ProgramModel.findOneAndUpdate).toHaveBeenCalledWith(
                { name: 'New Program' },
                { $set: doc },
                { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
            );
            expect(result).toEqual({ id: 'org-new', _id: 'org-new', ...doc });
        });
    });
});
