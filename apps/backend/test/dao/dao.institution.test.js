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
jest.mock('../../dao/user', () => jest.fn().mockImplementation(() => ({
    countSubmittersByInstitutionIDs: jest.fn(),
})));

const InstitutionDAO = require('../../dao/institution');
const InstitutionModel = require('../../mongoose/models/institution');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');
const { INSTITUTION } = require('../../crdc-datahub-database-drivers/constants/organization-constants');

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
        MongoPagination.mockImplementation((first, offset, orderBy) => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                ...(orderBy ? [{ $sort: { [orderBy]: 1 } }] : []),
                ...(offset ? [{ $skip: offset }] : []),
                ...(Number.isInteger(first) && first === -1 ? [] : [{ $limit: first }]),
            ]),
            getNoLimitPipeline: jest.fn().mockReturnValue(
                orderBy ? [{ $sort: { [orderBy]: 1 } }] : []
            ),
        }));
    });

    it('extends MongooseGenericDAO with the Institution model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(InstitutionModel);
        expect(dao._modelName).toBe('Institution');
    });

    describe('listInstitution', () => {
        it('should call aggregate without $facet or user $lookup and merge submitter counts', async () => {
            InstitutionModel.aggregate
                .mockResolvedValueOnce([
                    { _id: 'inst-1', name: 'Test U', status: INSTITUTION.STATUSES.ACTIVE },
                    { _id: 'inst-2', name: 'Other U', status: INSTITUTION.STATUSES.ACTIVE },
                ])
                .mockResolvedValueOnce([{ count: 2 }]);
            dao.userDAO.countSubmittersByInstitutionIDs.mockResolvedValue([
                { _id: 'inst-1', submitterCount: 2 },
            ]);

            const result = await dao.listInstitution(
                null, 0, 10, 'name', 'asc', INSTITUTION.STATUSES.ACTIVE
            );

            expect(InstitutionModel.aggregate).toHaveBeenCalledTimes(2);
            const resultsPipeline = InstitutionModel.aggregate.mock.calls[0][0];
            const countPipeline = InstitutionModel.aggregate.mock.calls[1][0];
            expect(resultsPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(resultsPipeline.some((stage) => stage.$lookup)).toBe(false);
            expect(countPipeline.some((stage) => stage.$lookup)).toBe(false);
            expect(resultsPipeline[0]).toEqual({
                $match: { status: { $in: [INSTITUTION.STATUSES.ACTIVE] } },
            });
            expect(MongoPagination).toHaveBeenCalledWith(10, 0, 'name', 'asc', true);
            expect(dao.userDAO.countSubmittersByInstitutionIDs).toHaveBeenCalledWith(['inst-1', 'inst-2']);
            expect(result).toEqual({
                institutions: [{
                    _id: 'inst-1',
                    id: 'inst-1',
                    name: 'Test U',
                    status: INSTITUTION.STATUSES.ACTIVE,
                    submitterCount: 2,
                }, {
                    _id: 'inst-2',
                    id: 'inst-2',
                    name: 'Other U',
                    status: INSTITUTION.STATUSES.ACTIVE,
                    submitterCount: 0,
                }],
                total: 2,
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
            expect(dao.userDAO.countSubmittersByInstitutionIDs).not.toHaveBeenCalled();
        });

        it('should count all matches, sort by live submitterCount, then slice', async () => {
            InstitutionModel.aggregate
                .mockResolvedValueOnce([
                    { _id: 'inst-1', name: 'A', status: INSTITUTION.STATUSES.ACTIVE },
                    { _id: 'inst-2', name: 'B', status: INSTITUTION.STATUSES.ACTIVE },
                    { _id: 'inst-3', name: 'C', status: INSTITUTION.STATUSES.ACTIVE },
                ])
                .mockResolvedValueOnce([{ count: 3 }]);
            dao.userDAO.countSubmittersByInstitutionIDs.mockResolvedValue([
                { _id: 'inst-1', submitterCount: 1 },
                { _id: 'inst-2', submitterCount: 5 },
                { _id: 'inst-3', submitterCount: 3 },
            ]);

            const result = await dao.listInstitution(
                null, 1, 1, 'submitterCount', 'desc', INSTITUTION.STATUSES.ACTIVE
            );

            expect(MongoPagination).toHaveBeenCalledWith(-1, 0, null, 'desc', false);
            expect(dao.userDAO.countSubmittersByInstitutionIDs).toHaveBeenCalledWith([
                'inst-1', 'inst-2', 'inst-3',
            ]);
            expect(result).toEqual({
                institutions: [{
                    _id: 'inst-3',
                    id: 'inst-3',
                    name: 'C',
                    status: INSTITUTION.STATUSES.ACTIVE,
                    submitterCount: 3,
                }],
                total: 3,
            });
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
