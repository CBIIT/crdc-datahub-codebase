jest.mock('../../mongoose/models/submission-request', () => ({
    modelName: 'SubmissionRequest',
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
    distinct: jest.fn(),
}));

const SubmissionRequestDAO = require('../../dao/submission-request');
const SubmissionRequestModel = require('../../mongoose/models/submission-request');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
}

describe('SubmissionRequestDAO', () => {
    let dao;

    beforeEach(() => {
        dao = new SubmissionRequestDAO();
        jest.clearAllMocks();
    });

    it('should extend MongooseGenericDAO and use the SubmissionRequest model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(SubmissionRequestModel);
        expect(dao.model.modelName).toBe('SubmissionRequest');
    });

    describe('insert', () => {
        it('should insert an SRF and return acknowledged', async () => {
            SubmissionRequestModel.create.mockResolvedValue({ _id: 'app1', toObject: () => ({ _id: 'app1' }) });
            const result = await dao.insert({ foo: 'bar' });
            expect(SubmissionRequestModel.create).toHaveBeenCalled();
            expect(result).toEqual({ acknowledged: true, insertedId: 'app1' });
        });
    });

    describe('update', () => {
        it('should update an SRF by _id', async () => {
            SubmissionRequestModel.findByIdAndUpdate.mockReturnValue(
                createLeanQuery({ _id: 'app1', foo: 'baz' })
            );
            const result = await dao.update({ _id: 'app1', foo: 'baz' });
            expect(SubmissionRequestModel.findByIdAndUpdate).toHaveBeenCalled();
            expect(result).toEqual({ id: 'app1', _id: 'app1', foo: 'baz' });
        });

        it('should update an SRF by id', async () => {
            SubmissionRequestModel.findByIdAndUpdate.mockReturnValue(
                createLeanQuery({ _id: 'app2', bar: 'baz' })
            );
            const result = await dao.update({ id: 'app2', bar: 'baz' });
            expect(SubmissionRequestModel.findByIdAndUpdate).toHaveBeenCalled();
            expect(result).toEqual({ id: 'app2', _id: 'app2', bar: 'baz' });
        });
    });

    describe('updateMany', () => {
        it('should update many SRFs with Mongo-shaped counts', async () => {
            SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
            const result = await dao.updateMany({ foo: 'bar' }, { status: 'Approved' });
            expect(SubmissionRequestModel.updateMany).toHaveBeenCalledWith(
                { foo: 'bar' },
                { $set: { status: 'Approved' } }
            );
            expect(result).toEqual({
                matchedCount: 2,
                modifiedCount: 2,
                count: 2,
                acknowledged: true,
            });
        });
    });

    describe('distinct', () => {
        it('should return distinct values for a field', async () => {
            SubmissionRequestModel.distinct.mockResolvedValue(['Approved', 'New']);
            const result = await dao.distinct('status');
            expect(SubmissionRequestModel.distinct).toHaveBeenCalledWith('status', {});
            expect(result).toEqual(['Approved', 'New']);
        });
    });
});
