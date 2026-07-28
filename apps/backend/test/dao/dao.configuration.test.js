jest.mock('../../mongoose/models/configuration', () => ({
    modelName: 'Configuration',
    findOne: jest.fn(),
    find: jest.fn(),
}));

const ConfigurationDAO = require('../../dao/configuration');
const ConfigurationModel = require('../../mongoose/models/configuration');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
    };
}

describe('ConfigurationDAO', () => {
    let dao;

    beforeEach(() => {
        dao = new ConfigurationDAO();
        jest.clearAllMocks();
    });

    it('extends MongooseGenericDAO with the Configuration model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(ConfigurationModel);
        expect(dao._modelName).toBe('Configuration');
    });

    describe('findByType', () => {
        it('should return config with id and _id when found', async () => {
            const mockConfig = { _id: 'cfg-123', type: 'test', value: 'abc' };
            ConfigurationModel.findOne.mockReturnValue(createLeanQuery(mockConfig));

            const result = await dao.findByType('test');

            expect(ConfigurationModel.findOne).toHaveBeenCalledWith({ type: 'test' });
            expect(result).toEqual({
                ...mockConfig,
                id: 'cfg-123',
                _id: 'cfg-123',
            });
        });

        it('should return null when config not found', async () => {
            ConfigurationModel.findOne.mockReturnValue(createLeanQuery(null));

            const result = await dao.findByType('missing');

            expect(ConfigurationModel.findOne).toHaveBeenCalledWith({ type: 'missing' });
            expect(result).toBeNull();
        });
    });

    describe('findManyByType', () => {
        it('should return configs with id and _id when found', async () => {
            const mockConfigs = [
                { _id: 'cfg-1', type: 'METADATA_BUCKET', bucketName: 'a' },
                { _id: 'cfg-2', type: 'METADATA_BUCKET', bucketName: 'b' },
            ];
            ConfigurationModel.find.mockReturnValue(createLeanQuery(mockConfigs));

            const result = await dao.findManyByType('METADATA_BUCKET');

            expect(ConfigurationModel.find).toHaveBeenCalledWith({ type: 'METADATA_BUCKET' });
            expect(result).toEqual([
                { ...mockConfigs[0], id: 'cfg-1', _id: 'cfg-1' },
                { ...mockConfigs[1], id: 'cfg-2', _id: 'cfg-2' },
            ]);
        });

        it('should return an empty array when none found', async () => {
            ConfigurationModel.find.mockReturnValue(createLeanQuery([]));

            const result = await dao.findManyByType('MISSING');

            expect(ConfigurationModel.find).toHaveBeenCalledWith({ type: 'MISSING' });
            expect(result).toEqual([]);
        });
    });
});
