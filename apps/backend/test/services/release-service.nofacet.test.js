const mockReleaseDAO = {
    aggregate: jest.fn(),
    distinct: jest.fn(),
};

jest.mock('../../dao/release', () => jest.fn().mockImplementation(() => mockReleaseDAO));
jest.mock('../../dao/approvedStudy', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../verifier/user-info-verifier', () => ({
    verifySession: jest.fn(() => ({
        verifyInitialized: jest.fn(),
    })),
}));
jest.mock('../../crdc-datahub-database-drivers/domain/mongo-pagination');
jest.mock('../../utility/data-commons-remapper', () => ({
    getDataCommonsDisplayName: jest.fn((value) => value),
    getDataCommonsOrigin: jest.fn((value) => value),
}));

const { Release } = require('../../services/release-service');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');

describe('ReleaseService DocumentDB $facet removals', () => {
    const context = { userInfo: { id: 'user-1', _id: 'user-1' } };
    let service;
    let allScope;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new Release({}, {}, {}, {});
        allScope = {
            isNoneScope: () => false,
            isAllScope: () => true,
            isStudyScope: () => false,
            isDCScope: () => false,
        };
        service._getUserScope = jest.fn().mockResolvedValue(allScope);
        MongoPagination.mockImplementation((first, offset, orderBy) => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                ...(orderBy ? [{ $sort: { [orderBy]: 1 } }] : []),
                { $skip: offset || 0 },
                { $limit: first },
            ]),
        }));
    });

    describe('listReleasedStudies', () => {
        it('should call separate count and results aggregates without $facet', async () => {
            const studies = [{ studyID: 'study1', studyName: 'Study A' }];
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce(studies)
                .mockResolvedValueOnce([{ count: 1 }]);
            mockReleaseDAO.distinct.mockResolvedValue(['CDS']);

            const result = await service.listReleasedStudies(
                { first: 10, offset: 0, orderBy: 'studyName', sortDirection: 'asc' },
                context
            );

            expect(mockReleaseDAO.aggregate).toHaveBeenCalledTimes(2);
            const [resultsPipeline, countPipeline] = mockReleaseDAO.aggregate.mock.calls.map(
                ([pipeline]) => pipeline
            );
            expect(resultsPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline[countPipeline.length - 1]).toEqual({ $count: 'count' });
            expect(result).toEqual({
                studies,
                total: 1,
                dataCommonsDisplayNames: ['CDS'],
            });
        });

        it('should return empty studies with zero total when aggregates are empty', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            mockReleaseDAO.distinct.mockResolvedValue([]);

            const result = await service.listReleasedStudies(
                { first: 10, offset: 0, orderBy: 'studyName', sortDirection: 'asc' },
                context
            );

            expect(result).toEqual({
                studies: [],
                total: 0,
                dataCommonsDisplayNames: [],
            });
        });

        it('should return stable empty shape when user has none scope', async () => {
            service._getUserScope.mockResolvedValue({ isNoneScope: () => true });

            const result = await service.listReleasedStudies(
                { first: 10, offset: 0, orderBy: 'studyName', sortDirection: 'asc' },
                context
            );

            expect(result).toEqual({
                total: 0,
                studies: [],
                dataCommonsDisplayNames: [],
            });
            expect(mockReleaseDAO.aggregate).not.toHaveBeenCalled();
            expect(mockReleaseDAO.distinct).not.toHaveBeenCalled();
        });
    });

    describe('getReleaseNodeTypes', () => {
        it('should aggregate without $facet and sum counts in application code', async () => {
            mockReleaseDAO.aggregate.mockResolvedValue([
                { name: 'study', count: 2, IDPropName: 'study_id' },
                { name: 'sample', count: 3, IDPropName: 'sample_id' },
            ]);

            const result = await service.getReleaseNodeTypes(
                { studyID: 'study1', dataCommonsDisplayName: 'CDS' },
                context
            );

            expect(mockReleaseDAO.aggregate).toHaveBeenCalledTimes(1);
            const pipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            expect(pipeline.some((stage) => stage.$facet)).toBe(false);
            expect(result).toEqual({
                total: 5,
                nodes: [
                    { name: 'study', count: 2, IDPropName: 'study_id' },
                    { name: 'sample', count: 3, IDPropName: 'sample_id' },
                ],
            });
        });

        it('should return zero total for empty node list', async () => {
            mockReleaseDAO.aggregate.mockResolvedValue([]);

            const result = await service.getReleaseNodeTypes(
                { studyID: 'study1', dataCommonsDisplayName: 'CDS' },
                context
            );

            expect(result).toEqual({ total: 0, nodes: [] });
        });

        it('should return stable empty shape when user has none scope', async () => {
            service._getUserScope.mockResolvedValue({ isNoneScope: () => true });

            const result = await service.getReleaseNodeTypes(
                { studyID: 'study1', dataCommonsDisplayName: 'CDS' },
                context
            );

            expect(result).toEqual({ total: 0, nodes: [] });
            expect(result).not.toHaveProperty('properties');
            expect(mockReleaseDAO.aggregate).not.toHaveBeenCalled();
        });
    });

    describe('listReleasedDataRecords', () => {
        it('should call separate page and count aggregates without $facet', async () => {
            const nodes = [{ title: 'Record A' }];
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce(nodes)
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['title', 'study.study_id'] }]);

            const result = await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'title',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(mockReleaseDAO.aggregate).toHaveBeenCalledTimes(3);
            const [pagePipeline, countPipeline] = mockReleaseDAO.aggregate.mock.calls
                .slice(0, 2)
                .map(([pipeline]) => pipeline);
            expect(pagePipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline.some((stage) => stage.$facet)).toBe(false);
            expect(countPipeline[countPipeline.length - 1]).toEqual({ $count: 'count' });
            expect(result).toEqual({
                total: 1,
                properties: ['title', 'study.study_id'],
                nodes,
            });
        });

        it('should return empty nodes with zero total when aggregates are empty', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'title',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(result).toEqual({
                total: 0,
                properties: [],
                nodes: [],
            });
        });

        it('should return stable empty shape when user has none scope', async () => {
            service._getUserScope.mockResolvedValue({ isNoneScope: () => true });

            const result = await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'title',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(result).toEqual({
                total: 0,
                properties: [],
                nodes: [],
            });
            expect(mockReleaseDAO.aggregate).not.toHaveBeenCalled();
        });

        it('should not use $getField when sorting by a dotted orderBy', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([{ 'study.study_id': 'S1' }])
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['study.study_id'] }]);

            await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'study.study_id',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(MongoPagination).toHaveBeenCalledWith(10, 0, null, 'asc');

            const pagePipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            const pipelineJson = JSON.stringify(pagePipeline);
            expect(pipelineJson).not.toContain('$getField');
            expect(pipelineJson).toContain('$objectToArray');
            expect(pipelineJson).toContain('$filter');

            const sortStages = pagePipeline.filter((stage) => stage.$sort);
            expect(sortStages).toEqual([{ $sort: { _sortKey: 1 } }]);
            expect(sortStages.some((stage) => Object.prototype.hasOwnProperty.call(stage.$sort, 'study.study_id'))).toBe(false);
        });

        it('should not use $getField when projecting dotted properties', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([{ title: 'Record A', 'study.study_id': 'S1' }])
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['title', 'study.study_id'] }]);

            await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'title',
                    sortDirection: 'asc',
                    properties: ['title', 'study.study_id'],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(MongoPagination).toHaveBeenCalledWith(10, 0, null, 'asc');

            const pagePipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            const pipelineJson = JSON.stringify(pagePipeline);
            expect(pipelineJson).not.toContain('$getField');
            expect(pipelineJson).toContain('$objectToArray');
            expect(pipelineJson).toContain('$filter');
            expect(pipelineJson).toContain('"$title"');

            const sortStages = pagePipeline.filter((stage) => stage.$sort);
            expect(sortStages).toEqual([{ $sort: { title: 1 } }]);
            expect(sortStages.some((stage) => Object.prototype.hasOwnProperty.call(stage.$sort, 'study.study_id'))).toBe(false);
        });
    });
});
