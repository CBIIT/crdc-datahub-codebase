jest.mock('../../mongoose/models/application', () => ({
    modelName: 'Application',
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    distinct: jest.fn(),
    aggregate: jest.fn(),
}));

const ApplicationDAO = require('../../dao/application');
const ApplicationModel = require('../../mongoose/models/application');
const MongooseGenericDAO = require('../../dao/mongoose-generic');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock, select: jest.Mock, sort: jest.Mock, skip: jest.Mock, limit: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    const query = {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    };
    return query;
}

describe('ApplicationDAO', () => {
    let dao;

    beforeEach(() => {
        dao = new ApplicationDAO();
        jest.clearAllMocks();
    });

    it('should extend MongooseGenericDAO and use the Application model', () => {
        expect(dao).toBeInstanceOf(MongooseGenericDAO);
        expect(dao.model).toBe(ApplicationModel);
        expect(dao.model.modelName).toBe('Application');
    });

    describe('insert', () => {
        it('should insert application and return acknowledged', async () => {
            ApplicationModel.create.mockResolvedValue({_id: 'app1'});
            const result = await dao.insert({foo: 'bar'});
            expect(ApplicationModel.create).toHaveBeenCalled();
            expect(result).toEqual({acknowledged: true, insertedId: 'app1'});
        });
    });

    describe('update', () => {
        it('should update application by _id', async () => {
            ApplicationModel.findByIdAndUpdate.mockReturnValue(createLeanQuery({_id: 'app1'}));
            const result = await dao.update({_id: 'app1', foo: 'baz'});
            expect(ApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'app1',
                {$set: {foo: 'baz'}},
                {new: true}
            );
            expect(result).toEqual({id: 'app1', _id: 'app1'});
        });

        it('should update application by id', async () => {
            ApplicationModel.findByIdAndUpdate.mockReturnValue(createLeanQuery({_id: 'app2'}));
            const result = await dao.update({id: 'app2', bar: 'baz'});
            expect(ApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'app2',
                {$set: {bar: 'baz'}},
                {new: true}
            );
            expect(result).toEqual({id: 'app2', _id: 'app2'});
        });
    });

    describe('updateMany', () => {
        it('should update many applications', async () => {
            ApplicationModel.updateMany.mockResolvedValue({matchedCount: 2, modifiedCount: 2});
            const result = await dao.updateMany({foo: 'bar'}, {status: 'APPROVED'});
            expect(ApplicationModel.updateMany).toHaveBeenCalledWith(
                {foo: 'bar'},
                {$set: {status: 'APPROVED'}}
            );
            expect(result).toEqual({matchedCount: 2, modifiedCount: 2});
        });
    });

    describe('updateApplicationOrg', () => {
        it('should update organization.name with nested path filters', async () => {
            ApplicationModel.updateMany.mockResolvedValue({matchedCount: 1, modifiedCount: 1});
            const result = await dao.updateApplicationOrg('org-1', {name: 'New Name'});
            expect(ApplicationModel.updateMany).toHaveBeenCalledWith(
                {
                    'organization._id': 'org-1',
                    'organization.name': {$ne: 'New Name'},
                },
                {$set: expect.objectContaining({'organization.name': 'New Name'})}
            );
            expect(result).toEqual({matchedCount: 1, modifiedCount: 1});
        });
    });

    describe('aggregate', () => {
        it('should run the aggregation pipeline', async () => {
            ApplicationModel.aggregate.mockResolvedValue([
                {_id: 'app1', foo: 1},
                {_id: 'app2', foo: 2},
            ]);
            const pipeline = [
                {$match: {foo: 1}},
                {$sort: {foo: -1}},
                {$limit: 1},
            ];
            const result = await dao.aggregate(pipeline);
            expect(ApplicationModel.aggregate).toHaveBeenCalledWith(pipeline);
            expect(result).toEqual([
                {id: 'app1', _id: 'app1', foo: 1},
                {id: 'app2', _id: 'app2', foo: 2},
            ]);
        });
    });

    describe('distinct', () => {
        it('should return distinct values for a field', async () => {
            ApplicationModel.distinct.mockResolvedValue(['APPROVED', 'NEW']);
            const result = await dao.distinct('status');
            expect(ApplicationModel.distinct).toHaveBeenCalledWith('status', {});
            expect(result).toEqual(['APPROVED', 'NEW']);
        });
    });

    describe('listApplicationsWithFacets', () => {
        /**
         * Aggregate call order: applications, count, programs, studies, studyAbbreviations, status, submitterNames.
         * Field-facet pipelines are indices 2–5.
         */
        const fieldFacetCallIndexes = [2, 3, 4, 5];

        it('should aggregate with applicant lookup and without $facet', async () => {
            ApplicationModel.aggregate
                .mockResolvedValueOnce([{_id: 'app1', programName: 'P1'}])
                .mockResolvedValueOnce([{count: 1}])
                .mockResolvedValueOnce([{_id: 'P1'}])
                .mockResolvedValueOnce([{_id: 'Study'}])
                .mockResolvedValueOnce([{_id: 'ST'}])
                .mockResolvedValueOnce([{_id: 'New'}])
                .mockResolvedValueOnce([{fullName: 'Alice'}]);

            const result = await dao.listApplicationsWithFacets({
                statuses: ['New'],
                first: 10,
                offset: 0,
                orderBy: 'createdAt',
                sortDirection: 'DESC',
            });

            expect(ApplicationModel.aggregate).toHaveBeenCalled();
            const firstPipeline = ApplicationModel.aggregate.mock.calls[0][0];
            expect(JSON.stringify(firstPipeline)).not.toContain('$facet');
            expect(firstPipeline.some((stage) => stage.$lookup)).toBe(true);
            expect(result.applications).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.programs).toEqual(['P1']);
            expect(result.submitterNames).toEqual(['Alice']);
        });

        it('should omit applicant $lookup from field-facet pipelines when submitterName is not set', async () => {
            ApplicationModel.aggregate
                .mockResolvedValueOnce([{_id: 'app1'}])
                .mockResolvedValueOnce([{count: 1}])
                .mockResolvedValueOnce([{_id: 'P1'}])
                .mockResolvedValueOnce([{_id: 'Study'}])
                .mockResolvedValueOnce([{_id: 'ST'}])
                .mockResolvedValueOnce([{_id: 'New'}])
                .mockResolvedValueOnce([{fullName: 'Alice'}]);

            await dao.listApplicationsWithFacets({
                statuses: ['New'],
                first: 10,
                offset: 0,
            });

            for (const index of fieldFacetCallIndexes) {
                const pipeline = ApplicationModel.aggregate.mock.calls[index][0];
                expect(pipeline.some((stage) => stage.$lookup)).toBe(false);
            }
        });

        it('should include applicant $lookup in field-facet pipelines when submitterName is set', async () => {
            ApplicationModel.aggregate
                .mockResolvedValueOnce([{_id: 'app1'}])
                .mockResolvedValueOnce([{count: 1}])
                .mockResolvedValueOnce([{_id: 'P1'}])
                .mockResolvedValueOnce([{_id: 'Study'}])
                .mockResolvedValueOnce([{_id: 'ST'}])
                .mockResolvedValueOnce([{_id: 'New'}])
                .mockResolvedValueOnce([{fullName: 'Alice'}]);

            await dao.listApplicationsWithFacets({
                statuses: ['New'],
                submitterName: 'Alice',
                first: 10,
                offset: 0,
            });

            for (const index of fieldFacetCallIndexes) {
                const pipeline = ApplicationModel.aggregate.mock.calls[index][0];
                expect(pipeline.some((stage) => stage.$lookup)).toBe(true);
            }
        });
    });

    describe('newInstitutions id round-trip', () => {
        it('should normalize id to _id on insert', async () => {
            ApplicationModel.create.mockResolvedValue({_id: 'app1'});
            await dao.insert({
                status: 'New',
                newInstitutions: [{id: 'inst-1', name: 'X'}],
            });
            expect(ApplicationModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    newInstitutions: [{_id: 'inst-1', name: 'X'}],
                })
            );
        });

        it('should normalize id to _id on update', async () => {
            ApplicationModel.findByIdAndUpdate.mockReturnValue(
                createLeanQuery({_id: 'app1', newInstitutions: [{_id: 'inst-1', name: 'X'}]})
            );
            const result = await dao.update({
                _id: 'app1',
                newInstitutions: [{id: 'inst-1', name: 'X'}],
            });
            expect(ApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
                'app1',
                {$set: {newInstitutions: [{_id: 'inst-1', name: 'X'}]}},
                {new: true}
            );
            expect(result.newInstitutions).toEqual([{id: 'inst-1', _id: 'inst-1', name: 'X'}]);
        });

        it('should map nested newInstitutions _id to id on read', () => {
            const result = dao._mapDoc({
                _id: 'app1',
                newInstitutions: [{_id: 'inst-1', name: 'X'}],
            });
            expect(result).toEqual({
                id: 'app1',
                _id: 'app1',
                newInstitutions: [{id: 'inst-1', _id: 'inst-1', name: 'X'}],
            });
        });
    });
});
