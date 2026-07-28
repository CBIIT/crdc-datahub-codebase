jest.mock('../../mongoose/models/pending-pv', () => ({
    modelName: 'PendingPV',
    create: jest.fn(),
    find: jest.fn(),
}));

const PendingPVDAO = require('../../dao/pendingPV');
const PendingPVModel = require('../../mongoose/models/pending-pv');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
}

describe('PendingPVDAO', () => {
    let dao;

    beforeEach(() => {
        dao = new PendingPVDAO();
        jest.clearAllMocks();
    });

    it('extends MongooseGenericDAO with the PendingPV model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(PendingPVModel);
        expect(dao._modelName).toBe('PendingPV');
    });

    describe('findBySubmissionID', () => {
        it('should find pending PVs by submissionID and map id/_id', async () => {
            PendingPVModel.find.mockReturnValue(createLeanQuery([
                {
                    _id: 'pv-1',
                    submissionID: 'sub1',
                    offendingProperty: 'age',
                    value: 'unknown',
                },
            ]));

            const result = await dao.findBySubmissionID('sub1');

            expect(PendingPVModel.find).toHaveBeenCalledWith({ submissionID: 'sub1' });
            expect(result).toEqual([
                {
                    id: 'pv-1',
                    _id: 'pv-1',
                    submissionID: 'sub1',
                    offendingProperty: 'age',
                    value: 'unknown',
                },
            ]);
        });

        it('should return an empty array when none match', async () => {
            PendingPVModel.find.mockReturnValue(createLeanQuery([]));
            const result = await dao.findBySubmissionID('missing');
            expect(result).toEqual([]);
        });
    });

    describe('insertOne', () => {
        it('should create a pending PV and return mapped document', async () => {
            PendingPVModel.create.mockImplementation(async (data) => ({
                ...data,
                _id: 'pv-new',
                toObject: () => ({ ...data, _id: 'pv-new' }),
            }));

            const result = await dao.insertOne('sub1', 'age', 'unknown');

            expect(PendingPVModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    submissionID: 'sub1',
                    offendingProperty: 'age',
                    value: 'unknown',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date),
                })
            );
            expect(result).toEqual(
                expect.objectContaining({
                    id: 'pv-new',
                    _id: 'pv-new',
                    submissionID: 'sub1',
                    offendingProperty: 'age',
                    value: 'unknown',
                })
            );
        });

        it('should soft-fail and return undefined on create error', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            PendingPVModel.create.mockRejectedValue(new Error('db down'));

            const result = await dao.insertOne('sub1', 'age', 'unknown');

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
