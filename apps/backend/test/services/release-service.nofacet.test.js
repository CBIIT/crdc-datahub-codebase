const mockReleaseDAO = {
    aggregate: jest.fn(),
    distinct: jest.fn(),
    listReleasedStudies: jest.fn(),
    listReleasedStudyDataCommons: jest.fn(),
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

const ASSIGNING_STAGES = ['$project', '$addFields', '$set', '$sort', '$unset'];

/**
 * DocumentDB rejects "." in field names an aggregation produces.
 * Assigned stage keys must be DOT-safe, and $concat must not use "." as a separator.
 * @param {object[]} pipeline
 */
function assertNoDottedAggregationFieldNames(pipeline) {
    for (const stage of pipeline) {
        for (const [op, body] of Object.entries(stage)) {
            if (!ASSIGNING_STAGES.includes(op) || body == null || typeof body !== 'object' || Array.isArray(body)) {
                continue;
            }
            for (const key of Object.keys(body)) {
                expect(key).not.toContain('.');
            }
        }
    }

    const visit = (node) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (node == null || typeof node !== 'object') {
            return;
        }
        if (Array.isArray(node.$concat)) {
            expect(node.$concat).not.toContain('.');
        }
        Object.values(node).forEach(visit);
    };
    visit(pipeline);
}

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
        it('should list via DAO, sort per-study display names, and map dataCommons display names', async () => {
            const studies = [{
                studyID: 'study1',
                studyName: 'Study A',
                dataCommons: ['icdc', 'cds'],
                dataCommonsDisplayNames: ['ICDC', 'CDS'],
            }];
            mockReleaseDAO.listReleasedStudies.mockResolvedValue({ studies, total: 1 });
            mockReleaseDAO.listReleasedStudyDataCommons.mockResolvedValue(['CDS']);

            const result = await service.listReleasedStudies(
                { first: 10, offset: 0, orderBy: 'studyName', sortDirection: 'asc' },
                context
            );

            expect(mockReleaseDAO.listReleasedStudies).toHaveBeenCalledTimes(1);
            expect(mockReleaseDAO.listReleasedStudyDataCommons).toHaveBeenCalledTimes(1);
            expect(mockReleaseDAO.distinct).not.toHaveBeenCalled();
            expect(mockReleaseDAO.aggregate).not.toHaveBeenCalled();
            expect(result).toEqual({
                studies: [{
                    studyID: 'study1',
                    studyName: 'Study A',
                    dataCommons: ['cds', 'icdc'],
                    dataCommonsDisplayNames: ['CDS', 'ICDC'],
                }],
                total: 1,
                dataCommonsDisplayNames: ['CDS'],
            });
        });

        it('should return empty studies with zero total when DAO results are empty', async () => {
            mockReleaseDAO.listReleasedStudies.mockResolvedValue({ studies: [], total: 0 });
            mockReleaseDAO.listReleasedStudyDataCommons.mockResolvedValue([]);

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
            expect(mockReleaseDAO.listReleasedStudies).not.toHaveBeenCalled();
            expect(mockReleaseDAO.listReleasedStudyDataCommons).not.toHaveBeenCalled();
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
            expect(MongoPagination).toHaveBeenCalledWith(10, 0, 'title', 'asc');
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

        it('should sort a dotted orderBy on the DOT-safe key when no properties are requested', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([{ study_DOT_study_id: 'S1' }])
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['study.study_id'] }]);

            const result = await service.listReleasedDataRecords(
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

            expect(MongoPagination).toHaveBeenCalledWith(10, 0, 'study_DOT_study_id', 'asc');

            const pagePipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            const pipelineJson = JSON.stringify(pagePipeline);
            expect(pipelineJson).not.toContain('$getField');
            expect(pipelineJson).not.toContain('$objectToArray');
            expect(pipelineJson).not.toContain('_sortKey');
            assertNoDottedAggregationFieldNames(pagePipeline);

            const sortStages = pagePipeline.filter((stage) => stage.$sort);
            expect(sortStages).toEqual([{ $sort: { study_DOT_study_id: 1 } }]);
            expect(result.nodes).toEqual([{ 'study.study_id': 'S1' }]);
        });

        it('should project and sort dotted properties on DOT-safe keys', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([{ title: 'Record A', study_DOT_study_id: 'S1' }])
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['title', 'study.study_id'] }]);

            const result = await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'study.study_id',
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
            expect(pipelineJson).not.toContain('$objectToArray');
            assertNoDottedAggregationFieldNames(pagePipeline);

            const sortStages = pagePipeline.filter((stage) => stage.$sort);
            expect(sortStages).toEqual([{ $sort: { study_DOT_study_id: 1 } }]);
            const sortIndex = pagePipeline.findIndex((stage) => stage.$sort);
            expect(pagePipeline.slice(sortIndex + 1).some((stage) => stage.$replaceRoot)).toBe(false);
            expect(pagePipeline.filter((stage) => stage.$project?._id === 0)).toEqual([{
                $project: {
                    _id: 0,
                    title: 1,
                    study_DOT_study_id: 1,
                },
            }]);
            expect(result.nodes).toEqual([{ title: 'Record A', 'study.study_id': 'S1' }]);
        });

        it('should build parent keys with _DOT_ and never assign a dotted field name', async () => {
            mockReleaseDAO.aggregate.mockResolvedValue([]);

            await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 20,
                    offset: 0,
                    orderBy: 'study_id',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            const pagePipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            const parentPairs = pagePipeline.find((stage) => stage.$addFields?.parentPairs);
            expect(parentPairs.$addFields.parentPairs.$map.in.k.$concat).toEqual([
                '$$p.parentType',
                '_DOT_',
                '$$p.parentIDPropName',
            ]);
            assertNoDottedAggregationFieldNames(pagePipeline);
            expect(JSON.stringify(pagePipeline)).not.toContain('$getField');
            expect(JSON.stringify(pagePipeline)).not.toContain('$facet');
        });

        it('should restore dotted names from DOT-safe aggregation keys', async () => {
            mockReleaseDAO.aggregate
                .mockResolvedValueOnce([{ study_id: 'S1', program_DOT_program_acronym: 'P' }])
                .mockResolvedValueOnce([{ count: 1 }])
                .mockResolvedValueOnce([{ allProperties: ['study_id', 'program.program_acronym'] }]);

            const result = await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: 'study_id',
                    sortDirection: 'asc',
                    properties: [],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(result).toEqual({
                total: 1,
                properties: ['study_id', 'program.program_acronym'],
                nodes: [{ study_id: 'S1', 'program.program_acronym': 'P' }],
            });
        });

        it('should drop properties and orderBy that are empty or start with $', async () => {
            mockReleaseDAO.aggregate.mockResolvedValue([]);

            await service.listReleasedDataRecords(
                {
                    studyID: 'study1',
                    nodeType: 'study',
                    first: 10,
                    offset: 0,
                    orderBy: '$where',
                    sortDirection: 'asc',
                    properties: ['title', '', '$gt', 'study.study_id'],
                    dataCommonsDisplayName: 'CDS',
                },
                context
            );

            expect(MongoPagination).toHaveBeenCalledWith(10, 0, undefined, 'asc');

            const pagePipeline = mockReleaseDAO.aggregate.mock.calls[0][0];
            expect(pagePipeline.filter((stage) => stage.$sort)).toEqual([]);
            expect(pagePipeline.filter((stage) => stage.$project?._id === 0)).toEqual([{
                $project: {
                    _id: 0,
                    title: 1,
                    study_DOT_study_id: 1,
                },
            }]);
            assertNoDottedAggregationFieldNames(pagePipeline);
        });
    });
});
