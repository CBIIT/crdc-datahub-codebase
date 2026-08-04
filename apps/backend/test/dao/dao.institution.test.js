jest.mock('../../mongoose/models/institution', () => ({
    modelName: 'Institution',
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
}));
jest.mock('../../crdc-datahub-database-drivers/domain/mongo-pagination');

const InstitutionDAO = require('../../dao/institution');
const InstitutionModel = require('../../mongoose/models/institution');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');
const { USER_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');
const { INSTITUTION } = require('../../crdc-datahub-database-drivers/constants/organization-constants');
const USER_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-constants');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
    };
}

describe('InstitutionDAO', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new InstitutionDAO();
        MongoPagination.mockImplementation(() => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                { $sort: { name: 1 } },
                { $skip: 0 },
                { $limit: 10 },
            ]),
            getNoLimitPipeline: jest.fn().mockReturnValue([
                { $sort: { name: 1 } },
            ]),
        }));
    });

    it('extends MongooseGenericDAO with the Institution model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(InstitutionModel);
        expect(dao._modelName).toBe('Institution');
    });

    describe('listInstitution', () => {
        it('should call aggregate without $facet and return institutions with id and _id', async () => {
            InstitutionModel.aggregate
                .mockResolvedValueOnce([
                    { _id: 'inst-1', name: 'Test U', status: INSTITUTION.STATUSES.ACTIVE, submitterCount: 2 },
                ])
                .mockResolvedValueOnce([{ count: 1 }]);

            const result = await dao.listInstitution(
                null, 0, 10, 'name', 'asc', INSTITUTION.STATUSES.ACTIVE
            );

            expect(InstitutionModel.aggregate).toHaveBeenCalledTimes(2);
            const resultsPipeline = InstitutionModel.aggregate.mock.calls[0][0];
            const countPipeline = InstitutionModel.aggregate.mock.calls[1][0];
            expect(resultsPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(resultsPipeline[0]).toEqual({
                $match: { status: { $in: [INSTITUTION.STATUSES.ACTIVE] } },
            });
            expect(resultsPipeline[1].$lookup.from).toBe(USER_COLLECTION);
            expect(resultsPipeline[1].$lookup.pipeline[0].$match.$expr.$and[1]).toEqual({
                $eq: ['$role', USER_CONSTANTS.USER.ROLES.SUBMITTER],
            });
            expect(result).toEqual({
                institutions: [{
                    _id: 'inst-1',
                    id: 'inst-1',
                    name: 'Test U',
                    status: INSTITUTION.STATUSES.ACTIVE,
                    submitterCount: 2,
                }],
                total: 1,
            });
        });

        it('should apply case-insensitive name filter', async () => {
            InstitutionModel.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await dao.listInstitution('harvard', 0, 10, 'name', 'asc', 'All');

            const matchStage = InstitutionModel.aggregate.mock.calls[0][0][0].$match;
            expect(matchStage.name).toEqual({ $regex: 'harvard', $options: 'i' });
            expect(matchStage.status).toEqual({
                $in: [INSTITUTION.STATUSES.INACTIVE, INSTITUTION.STATUSES.ACTIVE],
            });
        });

        it('should return zero total when count pipeline is empty', async () => {
            InstitutionModel.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await dao.listInstitution(
                null, 0, 10, 'name', 'asc', INSTITUTION.STATUSES.ACTIVE
            );

            expect(result).toEqual({ institutions: [], total: 0 });
        });
    });

    describe('findByCaseInsensitiveName', () => {
        it('should return mapped institution when found', async () => {
            InstitutionModel.aggregate.mockResolvedValue([
                { _id: 'inst-1', name: 'Harvard', status: INSTITUTION.STATUSES.ACTIVE },
            ]);

            const result = await dao.findByCaseInsensitiveName('  harvard  ');

            expect(InstitutionModel.aggregate).toHaveBeenCalledWith([
                {
                    $match: {
                        $expr: {
                            $eq: [
                                { $toLower: '$name' },
                                'harvard',
                            ],
                        },
                    },
                },
                { $limit: 1 },
            ]);
            expect(result).toEqual({
                _id: 'inst-1',
                id: 'inst-1',
                name: 'Harvard',
                status: INSTITUTION.STATUSES.ACTIVE,
            });
        });

        it('should return null when name is empty', async () => {
            const result = await dao.findByCaseInsensitiveName('   ');
            expect(result).toBeNull();
            expect(InstitutionModel.aggregate).not.toHaveBeenCalled();
        });

        it('should return null when no match', async () => {
            InstitutionModel.aggregate.mockResolvedValue([]);
            const result = await dao.findByCaseInsensitiveName('missing');
            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should return institution with id and _id', async () => {
            InstitutionModel.findById.mockReturnValue(
                createLeanQuery({ _id: 'inst-1', name: 'Test U' })
            );

            const result = await dao.findById('inst-1');

            expect(InstitutionModel.findById).toHaveBeenCalledWith('inst-1');
            expect(result).toEqual({
                _id: 'inst-1',
                id: 'inst-1',
                name: 'Test U',
            });
        });
    });
});
