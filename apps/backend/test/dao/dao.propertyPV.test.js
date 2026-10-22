jest.mock('../../mongoose/models/property-pv', () => ({
    modelName: 'PropertyPV',
    find: jest.fn(),
}));

const PropertyPVDAO = require('../../dao/propertyPV');
const PropertyPVModel = require('../../mongoose/models/property-pv');
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

describe('PropertyPVDAO', () => {
    let dao;

    beforeEach(() => {
        dao = new PropertyPVDAO();
        jest.clearAllMocks();
    });

    it('extends MongooseGenericDAO with the PropertyPV model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(PropertyPVModel);
        expect(dao._modelName).toBe('PropertyPV');
    });

    describe('findByPropertiesVersionAndModel', () => {
        it('returns [] for empty propertyNames without querying', async () => {
            const result = await dao.findByPropertiesVersionAndModel([], '1', 'ICDC');
            expect(result).toEqual([]);
            expect(PropertyPVModel.find).not.toHaveBeenCalled();
        });

        it('maps BSON PermissibleValues null to permissibleValues null', async () => {
            PropertyPVModel.find.mockReturnValue(createLeanQuery([
                {
                    _id: 'id1',
                    property: 'study_id',
                    model: 'ICDC',
                    version: '1.0',
                    PermissibleValues: null,
                    createdAt: new Date('2020-01-01'),
                    updatedAt: new Date('2020-01-02'),
                },
            ]));

            const result = await dao.findByPropertiesVersionAndModel(['study_id'], '1.0', 'ICDC');

            expect(PropertyPVModel.find).toHaveBeenCalledWith({
                property: { $in: ['study_id'] },
                version: '1.0',
                model: 'ICDC',
            });
            expect(result).toHaveLength(1);
            expect(result[0].permissibleValues).toBeNull();
            expect(result[0].property).toBe('study_id');
            expect(result[0].id).toBe('id1');
            expect(result[0]._id).toBe('id1');
        });

        it('preserves empty array PermissibleValues', async () => {
            PropertyPVModel.find.mockReturnValue(createLeanQuery([
                {
                    _id: 'id1',
                    property: 'p',
                    model: 'ICDC',
                    version: '1',
                    PermissibleValues: [],
                },
            ]));

            const result = await dao.findByPropertiesVersionAndModel(['p'], '1', 'ICDC');

            expect(result[0].permissibleValues).toEqual([]);
        });

        it('maps missing PermissibleValues key to permissibleValues null', async () => {
            PropertyPVModel.find.mockReturnValue(createLeanQuery([
                {
                    _id: 'id1',
                    property: 'p',
                    model: 'ICDC',
                    version: '1',
                },
            ]));

            const result = await dao.findByPropertiesVersionAndModel(['p'], '1', 'ICDC');

            expect(result[0].permissibleValues).toBeNull();
        });

        it('passes through non-null PermissibleValues arrays', async () => {
            PropertyPVModel.find.mockReturnValue(createLeanQuery([
                {
                    _id: 'id1',
                    property: 'p',
                    model: 'ICDC',
                    version: '1',
                    PermissibleValues: ['a', 'b'],
                },
            ]));

            const result = await dao.findByPropertiesVersionAndModel(['p'], '1', 'ICDC');

            expect(result[0].permissibleValues).toEqual(['a', 'b']);
        });
    });
});
