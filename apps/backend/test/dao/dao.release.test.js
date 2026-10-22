jest.mock('../../mongoose/models/release', () => ({
    modelName: 'Release',
    findById: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
}));
jest.mock('../../crdc-datahub-database-drivers/domain/mongo-pagination');

const ReleaseDAO = require('../../dao/release');
const ReleaseModel = require('../../mongoose/models/release');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');
const { APPROVED_STUDIES_COLLECTION, DATA_COMMONS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');
const { DIRECTION } = require('../../crdc-datahub-database-drivers/constants/mongodb-constants');

describe('ReleaseDAO', () => {
    let releaseDAO;

    beforeEach(() => {
        releaseDAO = new ReleaseDAO();
        jest.clearAllMocks();
        MongoPagination.mockImplementation((first, offset, orderBy) => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                ...(orderBy ? [{ $sort: { [orderBy]: 1 } }] : []),
                { $skip: offset || 0 },
                { $limit: first },
            ]),
        }));
    });

    it('should extend MongooseGenericDAO and use the Release model', () => {
        expect(releaseDAO).toBeInstanceOf(MongooseGenericDAO);
        expect(releaseDAO.model).toBe(ReleaseModel);
        expect(releaseDAO.model.modelName).toBe('Release');
    });

    it('should delegate distinct to the Release model', async () => {
        ReleaseModel.distinct.mockResolvedValue(['study', 'sample']);
        const result = await releaseDAO.distinct('nodeType', { studyID: 's1' });
        expect(ReleaseModel.distinct).toHaveBeenCalledWith('nodeType', { studyID: 's1' });
        expect(result).toEqual(['study', 'sample']);
    });

    describe('listReleasedStudies', () => {
        /**
         * @param {object[]} pipeline
         */
        function assertDocumentDbSafePipeline(pipeline) {
            const json = JSON.stringify(pipeline);
            expect(json).not.toContain('$facet');
            expect(json).not.toContain('"let":');
            expect(json).not.toContain('"pipeline":');
            for (const stage of pipeline) {
                if (stage.$set || stage.$addFields) {
                    expect(JSON.stringify(stage)).not.toContain('$sortArray');
                }
            }
        }

        it('should call separate count and results aggregates without correlated $lookup or $sortArray', async () => {
            const studies = [{ _id: 'study-1', studyName: 'Study A' }];
            ReleaseModel.aggregate
                .mockResolvedValueOnce(studies)
                .mockResolvedValueOnce([{ count: 1 }]);

            const listConditions = { studyName: { $regex: 'Study', $options: 'i' } };
            const result = await releaseDAO.listReleasedStudies(
                listConditions, 10, 0, 'studyName', 'asc'
            );

            expect(ReleaseModel.aggregate).toHaveBeenCalledTimes(2);
            const [resultsPipeline, countPipeline] = ReleaseModel.aggregate.mock.calls.map(
                ([pipeline]) => pipeline
            );
            assertDocumentDbSafePipeline(resultsPipeline);
            assertDocumentDbSafePipeline(countPipeline);
            expect(countPipeline[countPipeline.length - 1]).toEqual({ $count: 'count' });

            const dataCommonsLookup = resultsPipeline.find(
                (stage) => stage.$lookup?.from === DATA_COMMONS_COLLECTION
            );
            expect(dataCommonsLookup.$lookup).toEqual({
                from: DATA_COMMONS_COLLECTION,
                localField: 'dataCommons',
                foreignField: 'dataCommons',
                as: 'matched',
            });
            const approvedStudiesLookup = resultsPipeline.find(
                (stage) => stage.$lookup?.from === APPROVED_STUDIES_COLLECTION
            );
            expect(approvedStudiesLookup.$lookup.localField).toBe('_id');
            expect(approvedStudiesLookup.$lookup.foreignField).toBe('_id');
            expect(JSON.stringify(countPipeline)).not.toContain('mappedDisplayNameLower');
            expect(JSON.stringify(countPipeline)).not.toContain('dataCommonsDisplayNamesSort');
            const listMatch = [...resultsPipeline].reverse().find((stage) => stage.$match);
            expect(listMatch).toEqual({ $match: listConditions });
            expect(result).toEqual({
                studies: [{ _id: 'study-1', id: 'study-1', studyName: 'Study A' }],
                total: 1,
            });
        });

        it('should omit pagination orderBy and sort by concatenated display names when orderBy is dataCommonsDisplayNames', async () => {
            ReleaseModel.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            await releaseDAO.listReleasedStudies({}, 20, 0, 'dataCommonsDisplayNames', 'desc');

            expect(MongoPagination).toHaveBeenCalledWith(20, 0, null, 'desc');
            const [resultsPipeline, countPipeline] = ReleaseModel.aggregate.mock.calls.map(
                ([pipeline]) => pipeline
            );
            assertDocumentDbSafePipeline(resultsPipeline);
            const projectStage = resultsPipeline.find((stage) => stage.$project?.sortedLowerNames);
            expect(projectStage.$project.sortedLowerNames.$sortArray.sortBy).toBe(1);
            expect(JSON.stringify(projectStage)).toContain('$toLower');
            expect(resultsPipeline).toEqual(
                expect.arrayContaining([
                    { $sort: { dataCommonsDisplayNamesSort: DIRECTION.DESC } },
                ])
            );
            expect(JSON.stringify(countPipeline)).not.toContain('dataCommonsDisplayNamesSort');
            expect(JSON.stringify(countPipeline)).not.toContain('$sortArray');
        });

        it('should return zero total when the count pipeline is empty', async () => {
            ReleaseModel.aggregate
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await releaseDAO.listReleasedStudies({}, 10, 0, 'studyName', 'asc');
            expect(result).toEqual({ studies: [], total: 0 });
        });
    });

    describe('listReleasedStudyDataCommons', () => {
        it('should distinct dataCommons for study nodes with the extra filter', async () => {
            ReleaseModel.distinct.mockResolvedValue(['CDS']);
            const filter = { studyID: { $in: ['s1'] } };

            const result = await releaseDAO.listReleasedStudyDataCommons(filter);

            expect(ReleaseModel.distinct).toHaveBeenCalledWith('dataCommons', {
                nodeType: 'study',
                studyID: { $exists: true },
                ...filter,
            });
            expect(result).toEqual(['CDS']);
        });
    });
});
