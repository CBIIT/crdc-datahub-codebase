const MongooseGenericDAO = require('../../dao/mongoose-generic');

/**
 * Builds a thenable lean query mock that resolves to the given value.
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock, sort: jest.Mock, skip: jest.Mock, limit: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    const query = {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
    return query;
}

describe('MongooseGenericDAO', () => {
    let dao;
    let model;

    beforeEach(() => {
        model = {
            modelName: 'TestModel',
            create: jest.fn(),
            insertMany: jest.fn(),
            findById: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            updateMany: jest.fn(),
            findByIdAndDelete: jest.fn(),
            deleteMany: jest.fn(),
            countDocuments: jest.fn(),
            distinct: jest.fn(),
            aggregate: jest.fn(),
        };
        dao = new MongooseGenericDAO(model);
        jest.clearAllMocks();
    });

    it('should create a record and map id/_id', async () => {
        model.create.mockResolvedValue({ _id: '1', foo: 'bar', toObject: () => ({ _id: '1', foo: 'bar' }) });
        const res = await dao.create({ foo: 'bar' });
        expect(res).toEqual({ id: '1', foo: 'bar', _id: '1' });
        expect(model.create).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should create many records', async () => {
        model.insertMany.mockResolvedValue([{ _id: '1' }, { _id: '2' }]);
        const res = await dao.createMany([{ foo: 1 }, { foo: 2 }]);
        expect(res).toEqual({ count: 2 });
    });

    it('should find by id', async () => {
        model.findById.mockReturnValue(createLeanQuery({ _id: '1', foo: 'bar' }));
        const res = await dao.findById('1');
        expect(res).toEqual({ id: '1', foo: 'bar', _id: '1' });
    });

    it('should return null if not found by id', async () => {
        model.findById.mockReturnValue(createLeanQuery(null));
        const res = await dao.findById('notfound');
        expect(res).toBeNull();
    });

    it('should find all', async () => {
        model.find.mockReturnValue(createLeanQuery([{ _id: '1', foo: 1 }, { _id: '2', foo: 2 }]));
        const res = await dao.findAll();
        expect(res).toEqual([
            { id: '1', foo: 1, _id: '1' },
            { id: '2', foo: 2, _id: '2' }
        ]);
    });

    it('should find first', async () => {
        model.findOne.mockReturnValue(createLeanQuery({ _id: '1', foo: 1 }));
        const res = await dao.findFirst({ foo: 1 });
        expect(res).toEqual({ id: '1', foo: 1, _id: '1' });
    });

    it('should return null if not found in findFirst', async () => {
        model.findOne.mockReturnValue(createLeanQuery(null));
        const res = await dao.findFirst({ foo: 1 });
        expect(res).toBeNull();
    });

    it('should reject null where in findFirst', async () => {
        await expect(dao.findFirst(null)).rejects.toThrow(
            'MongooseGenericDAO.findFirst requires a filter object for TestModel'
        );
        expect(model.findOne).not.toHaveBeenCalled();
    });

    it('should find many', async () => {
        model.find.mockReturnValue(createLeanQuery([{ _id: '1', foo: 1 }, { _id: '2', foo: 2 }]));
        const res = await dao.findMany({ foo: { $in: [1, 2] } });
        expect(res).toEqual([
            { id: '1', foo: 1, _id: '1' },
            { id: '2', foo: 2, _id: '2' }
        ]);
        expect(model.find).toHaveBeenCalledWith({ foo: { $in: [1, 2] } });
    });

    it('should allow empty filter object in findMany', async () => {
        model.find.mockReturnValue(createLeanQuery([{ _id: '1', foo: 1 }]));
        const res = await dao.findMany({});
        expect(res).toEqual([{ id: '1', foo: 1, _id: '1' }]);
        expect(model.find).toHaveBeenCalledWith({});
    });

    it('should reject null filter in findMany', async () => {
        await expect(dao.findMany(null)).rejects.toThrow(
            'MongooseGenericDAO.findMany requires a filter object for TestModel'
        );
        expect(model.find).not.toHaveBeenCalled();
    });

    it('should update a record', async () => {
        const query = createLeanQuery({ _id: '1', foo: 'baz' });
        model.findByIdAndUpdate.mockReturnValue(query);
        const res = await dao.update('1', { foo: 'baz' });
        expect(res).toEqual({ id: '1', foo: 'baz', _id: '1' });
        expect(model.findByIdAndUpdate).toHaveBeenCalledWith('1', { $set: { foo: 'baz' } }, { new: true });
    });

    it('should update many records', async () => {
        model.updateMany.mockResolvedValue({ modifiedCount: 2 });
        const res = await dao.updateMany({ foo: 1 }, { foo: 2 });
        expect(res).toEqual({ count: 2 });
    });

    it('should delete a record', async () => {
        model.findByIdAndDelete.mockReturnValue(createLeanQuery({ _id: '1', foo: 'bar' }));
        const res = await dao.delete('1');
        expect(res).toEqual({ id: '1', foo: 'bar', _id: '1' });
    });

    it('should delete many records', async () => {
        model.deleteMany.mockResolvedValue({ deletedCount: 2 });
        const res = await dao.deleteMany({ foo: 1 });
        expect(res).toEqual({ count: 2 });
    });

    it('should reject null where in deleteMany', async () => {
        await expect(dao.deleteMany(null)).rejects.toThrow(
            'MongooseGenericDAO.deleteMany requires a filter object for TestModel'
        );
        expect(model.deleteMany).not.toHaveBeenCalled();
    });

    it('should count records', async () => {
        model.countDocuments.mockResolvedValue(2);
        const res = await dao.count({ foo: 'bar' });
        expect(res).toBe(2);
        expect(model.countDocuments).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should allow empty filter object in count', async () => {
        model.countDocuments.mockResolvedValue(5);
        const res = await dao.count({});
        expect(res).toBe(5);
        expect(model.countDocuments).toHaveBeenCalledWith({});
    });

    it('should reject null where in count', async () => {
        await expect(dao.count(null)).rejects.toThrow(
            'MongooseGenericDAO.count requires a filter object for TestModel'
        );
        expect(model.countDocuments).not.toHaveBeenCalled();
    });

    it('should get distinct values', async () => {
        model.distinct.mockResolvedValue([1, 2]);
        const res = await dao.distinct('foo', {});
        expect(res).toEqual([1, 2]);
        expect(model.distinct).toHaveBeenCalledWith('foo', {});
    });

    it('should aggregate and map id/_id', async () => {
        model.aggregate.mockResolvedValue([{ _id: '1', foo: 1 }]);
        const res = await dao.aggregate([{ $match: { foo: 1 } }]);
        expect(res).toEqual([{ id: '1', foo: 1, _id: '1' }]);
    });
});
