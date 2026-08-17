jest.mock('../../mongoose/models/submission', () => ({
    modelName: 'Submission',
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
}));
jest.mock('../../crdc-datahub-database-drivers/domain/mongo-pagination');
jest.mock('../../dao/program', () => {
    return jest.fn().mockImplementation(() => ({
        findMany: jest.fn().mockResolvedValue([]),
    }));
});
jest.mock('../../dao/approvedStudy', () => {
    return jest.fn().mockImplementation(() => ({
        findMany: jest.fn().mockResolvedValue([]),
    }));
});
jest.mock('../../dao/user', () => {
    return jest.fn().mockImplementation(() => ({
        findMany: jest.fn().mockResolvedValue([]),
    }));
});

const SubmissionDAO = require('../../dao/submission');
const SubmissionModel = require('../../mongoose/models/submission');
const { MongoPagination } = require('../../crdc-datahub-database-drivers/domain/mongo-pagination');
const ProgramDAO = require('../../dao/program');
const ApprovedStudyDAO = require('../../dao/approvedStudy');
const UserDAO = require('../../dao/user');
const {
    NEW, IN_PROGRESS, SUBMITTED, RELEASED, COMPLETED, ARCHIVED, REJECTED, WITHDRAWN, CANCELED, DELETED,
    COLLABORATOR_PERMISSIONS,
} = require('../../constants/submission-constants');
const ERROR = require('../../constants/error-constants');
const {
    APPROVED_STUDIES_COLLECTION,
    ORGANIZATION_COLLECTION,
    USER_COLLECTION,
} = require('../../crdc-datahub-database-drivers/database-constants');

describe('SubmissionDAO', () => {
    let dao;
    let mockUserInfo;
    let mockUserScope;
    let mockProgramDAO;
    let mockApprovedStudyDAO;
    let mockUserDAO;

    const mockParams = {
        first: 10,
        offset: 0,
        orderBy: 'createdAt',
        sortDirection: 'desc',
    };

    const mockAggregatedSubmission = {
        _id: 'sub-1',
        name: 'Test Submission 1',
        status: NEW,
        dataCommons: 'test-commons',
        studyID: 'study-1',
        dataFileSize: { size: 1024, formatted: '1 KB' },
        history: [],
        study: {
            _id: 'study-1',
            studyName: 'Test Study',
            studyAbbreviation: 'TS',
            dbGaPID: 'phs000001',
        },
        organization: {
            _id: 'org-1',
            name: 'Test Organization',
            abbreviation: 'TO',
        },
        submitter: {
            _id: 'submitter-1',
            firstName: 'Test',
            lastName: 'User',
            fullName: 'Test User',
            email: 'test@example.com',
        },
        concierge: {
            _id: 'concierge-1',
            firstName: 'Concierge',
            lastName: 'User',
            fullName: 'Concierge User',
            email: 'concierge@example.com',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new SubmissionDAO();
        mockProgramDAO = ProgramDAO.mock.results[ProgramDAO.mock.results.length - 1].value;
        mockApprovedStudyDAO = ApprovedStudyDAO.mock.results[ApprovedStudyDAO.mock.results.length - 1].value;
        mockUserDAO = UserDAO.mock.results[UserDAO.mock.results.length - 1].value;

        mockUserInfo = {
            _id: 'test_user_id',
            dataCommons: ['test-commons'],
            studies: [
                { _id: 'study-1' },
                { _id: 'study-2' },
            ],
        };

        mockUserScope = {
            isAllScope: jest.fn().mockReturnValue(false),
            isStudyScope: jest.fn().mockReturnValue(false),
            isDCScope: jest.fn().mockReturnValue(false),
            isOwnScope: jest.fn().mockReturnValue(true),
            getStudyScope: jest.fn().mockReturnValue({
                scope: 'study',
                scopeValues: ['study-1', 'study-2'],
            }),
            getDataCommonsScope: jest.fn(),
        };

        const leanFindById = jest.fn().mockResolvedValue(null);
        SubmissionModel.findById.mockReturnValue({ lean: leanFindById });
        SubmissionModel.findById._lean = leanFindById;

        const leanFind = jest.fn().mockResolvedValue([]);
        SubmissionModel.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: leanFind,
        });
        SubmissionModel.find._lean = leanFind;

        SubmissionModel.countDocuments.mockResolvedValue(1);
        SubmissionModel.aggregate.mockResolvedValue([mockAggregatedSubmission]);
        MongoPagination.mockImplementation(() => ({
            getPaginationPipeline: jest.fn().mockReturnValue([
                { $sort: { createdAt: -1 } },
                { $skip: 0 },
                { $limit: 10 },
            ]),
        }));
        mockProgramDAO.findMany.mockResolvedValue([
            { id: 'org-1', _id: 'org-1', name: 'Org One', abbreviation: 'O1' },
        ]);
    });

    describe('findById', () => {
        it('should return submission with id and _id when found', async () => {
            SubmissionModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ _id: '1', name: 'Test Submission' }),
            });

            const result = await dao.findById('1');

            expect(SubmissionModel.findById).toHaveBeenCalledWith('1');
            expect(result).toEqual({ _id: '1', id: '1', name: 'Test Submission' });
        });

        it('should return null when submission not found', async () => {
            SubmissionModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            const result = await dao.findById('missing');

            expect(result).toBeNull();
        });
    });

    describe('listSubmissions', () => {
        describe('Basic functionality', () => {
            it('should call count and aggregate without $facet', async () => {
                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(SubmissionModel.countDocuments).toHaveBeenCalledTimes(1);
                expect(SubmissionModel.aggregate).toHaveBeenCalled();
                const resultsPipeline = SubmissionModel.aggregate.mock.calls[0][0];
                expect(resultsPipeline.some((stage) => stage.$facet)).toBe(false);
                expect(result.submissions).toHaveLength(1);
                expect(result.total).toBe(1);
            });

            it('should $lookup study, organization, submitter, and concierge', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                const pipeline = SubmissionModel.aggregate.mock.calls[0][0];
                const lookupFrom = pipeline
                    .filter((stage) => stage.$lookup)
                    .map((stage) => stage.$lookup.from);
                expect(lookupFrom).toEqual(expect.arrayContaining([
                    APPROVED_STUDIES_COLLECTION,
                    ORGANIZATION_COLLECTION,
                    USER_COLLECTION,
                ]));
                expect(lookupFrom.filter((from) => from === USER_COLLECTION)).toHaveLength(2);
            });

            it('should transform nested relations and deprecated top-level study fields', async () => {
                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);
                const submission = result.submissions[0];

                expect(submission._id).toBe('sub-1');
                expect(submission.study).toEqual({
                    _id: 'study-1',
                    studyName: 'Test Study',
                    studyAbbreviation: 'TS',
                    dbGaPID: 'phs000001',
                });
                expect(submission.studyName).toBe('Test Study');
                expect(submission.studyAbbreviation).toBe('TS');
                expect(submission.dbGaPID).toBe('phs000001');
                expect(submission.organization).toEqual({
                    _id: 'org-1',
                    name: 'Test Organization',
                    abbreviation: 'TO',
                });
                expect(submission.submitterName).toBe('Test User');
                expect(submission.conciergeName).toBe('Concierge User');
                expect(submission.conciergeEmail).toBe('concierge@example.com');
            });

            it('should return empty results when user has no access', async () => {
                mockUserInfo.studies = [];

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(result).toEqual({
                    submissions: [],
                    total: 0,
                    dataCommons: [],
                    submitterNames: [],
                    organizations: [],
                    statuses: [],
                });
                expect(SubmissionModel.aggregate).not.toHaveBeenCalled();
            });
        });

        describe('Scope filtering', () => {
            it('should not restrict all-scope users', async () => {
                mockUserScope.isAllScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);

                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                const match = SubmissionModel.countDocuments.mock.calls[0][0];
                expect(match.studyID).toBeUndefined();
                expect(match.dataCommons).toBeUndefined();
                expect(match.$or).toBeUndefined();
            });

            it('should filter study-scope users by studyID $in', async () => {
                mockUserScope.isStudyScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);

                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(SubmissionModel.countDocuments.mock.calls[0][0].studyID).toEqual({
                    $in: ['study-1', 'study-2'],
                });
            });

            it('should filter data-commons-scope users by dataCommons $in', async () => {
                mockUserScope.isDCScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);

                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(SubmissionModel.countDocuments.mock.calls[0][0].dataCommons).toEqual({
                    $in: ['test-commons'],
                });
            });

            it('should filter own-scope users by study and submitter/collaborator $or', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                const match = SubmissionModel.countDocuments.mock.calls[0][0];
                expect(match.studyID).toEqual({ $in: ['study-1', 'study-2'] });
                expect(match.$or).toEqual([
                    { submitterID: 'test_user_id' },
                    {
                        collaborators: {
                            $elemMatch: {
                                collaboratorID: 'test_user_id',
                                permission: { $in: [COLLABORATOR_PERMISSIONS.CAN_EDIT] },
                            },
                        },
                    },
                ]);
            });

            it('should omit studyID for own-scope users with All studies but keep submitter/collaborator $or', async () => {
                mockUserInfo.studies = [{ _id: 'All' }];

                await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                const match = SubmissionModel.countDocuments.mock.calls[0][0];
                expect(match.studyID).toBeUndefined();
                expect(match.$or).toEqual([
                    { submitterID: 'test_user_id' },
                    {
                        collaborators: {
                            $elemMatch: {
                                collaboratorID: 'test_user_id',
                                permission: { $in: [COLLABORATOR_PERMISSIONS.CAN_EDIT] },
                            },
                        },
                    },
                ]);
            });

            it('should intersect DC-scope dataCommons with an explicit dataCommons filter', async () => {
                mockUserScope.isDCScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);
                mockUserInfo.dataCommons = ['cds', 'icdc'];

                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dataCommons: 'cds',
                });

                expect(SubmissionModel.countDocuments.mock.calls[0][0].dataCommons).toEqual({
                    $in: ['cds'],
                });
            });

            it('should return empty results when DC-scope dataCommons intersects to empty', async () => {
                mockUserScope.isDCScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);
                mockUserInfo.dataCommons = ['cds', 'icdc'];

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dataCommons: 'gdc',
                });

                expect(result).toEqual({
                    submissions: [],
                    total: 0,
                    dataCommons: [],
                    submitterNames: [],
                    organizations: [],
                    statuses: [],
                });
                expect(SubmissionModel.aggregate).not.toHaveBeenCalled();
                expect(SubmissionModel.countDocuments).not.toHaveBeenCalled();
            });
        });

        describe('Search filters', () => {
            it('should apply status $in filter', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    status: [NEW, IN_PROGRESS],
                });

                expect(SubmissionModel.countDocuments.mock.calls[0][0].status).toEqual({
                    $in: [NEW, IN_PROGRESS],
                });
            });

            it('should apply case-insensitive name regex', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    name: 'Test',
                });

                expect(SubmissionModel.countDocuments.mock.calls[0][0].name).toEqual({
                    $regex: 'Test',
                    $options: 'i',
                });
            });

            it('should resolve dbGaPID search via approved studies and intersect studyID', async () => {
                mockApprovedStudyDAO.findMany.mockResolvedValue([
                    { _id: 'study-1', studyName: 'Match' },
                ]);

                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dbGaPID: 'phs',
                });

                expect(mockApprovedStudyDAO.findMany).toHaveBeenCalledWith({
                    $or: [
                        { studyName: { $regex: 'phs', $options: 'i' } },
                        { studyAbbreviation: { $regex: 'phs', $options: 'i' } },
                        { dbGaPID: { $regex: 'phs', $options: 'i' } },
                    ],
                }, { projection: { _id: 1 } });
                expect(SubmissionModel.countDocuments.mock.calls[0][0].studyID).toEqual({
                    $in: ['study-1'],
                });
            });

            it('should resolve the study search once for both filter builds', async () => {
                mockApprovedStudyDAO.findMany.mockResolvedValue([
                    { _id: 'study-1', studyName: 'Match' },
                ]);

                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dbGaPID: 'phs',
                    submitterName: 'Test User',
                });

                expect(mockApprovedStudyDAO.findMany).toHaveBeenCalledTimes(1);
            });

            it('should return empty results without aggregate when study search matches nothing', async () => {
                mockApprovedStudyDAO.findMany.mockResolvedValue([]);

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dbGaPID: 'nomatch',
                });

                expect(result).toEqual({
                    submissions: [],
                    total: 0,
                    dataCommons: [],
                    submitterNames: [],
                    organizations: [],
                    statuses: [],
                });
                expect(SubmissionModel.aggregate).not.toHaveBeenCalled();
                expect(SubmissionModel.countDocuments).not.toHaveBeenCalled();
            });

            it('should return empty results when study search intersects to zero studyIDs', async () => {
                mockApprovedStudyDAO.findMany.mockResolvedValue([
                    { _id: 'study-other', studyName: 'Other' },
                ]);

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dbGaPID: 'phs',
                });

                expect(result.submissions).toEqual([]);
                expect(result.total).toBe(0);
                expect(SubmissionModel.aggregate).not.toHaveBeenCalled();
            });

            it('should resolve submitterName via users and filter submitterID', async () => {
                mockUserDAO.findMany.mockResolvedValue([{ _id: 'submitter-1', fullName: 'Test User' }]);

                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    submitterName: 'Test User',
                });

                expect(mockUserDAO.findMany).toHaveBeenCalledWith(
                    { fullName: 'Test User' },
                    { projection: { _id: 1 } }
                );
                expect(SubmissionModel.countDocuments.mock.calls[0][0].submitterID).toEqual({
                    $in: ['submitter-1'],
                });
            });

            it('should apply organization as programID', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    organization: 'org-1',
                });

                expect(SubmissionModel.countDocuments.mock.calls[0][0].programID).toBe('org-1');
            });

            it('should apply dataCommons filter', async () => {
                mockUserScope.isAllScope.mockReturnValue(true);
                mockUserScope.isOwnScope.mockReturnValue(false);

                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    dataCommons: 'cds',
                });

                expect(SubmissionModel.countDocuments.mock.calls[0][0].dataCommons).toBe('cds');
            });
        });

        describe('Pagination and sorting', () => {
            it('should pass mapped orderBy into MongoPagination', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    orderBy: 'submitterName',
                    sortDirection: 'asc',
                });

                expect(MongoPagination).toHaveBeenCalledWith(
                    10,
                    0,
                    'submitterSort',
                    'asc'
                );
            });

            it('should add lowercased sort helper for organization.name', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    orderBy: 'organization',
                });

                const pipeline = SubmissionModel.aggregate.mock.calls[0][0];
                expect(pipeline.some((stage) => stage.$set?.organizationSort)).toBe(true);
            });

            it('should $lookup after pagination when sorting on a local field', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    orderBy: 'updatedAt',
                });

                const pipeline = SubmissionModel.aggregate.mock.calls[0][0];
                const limitIndex = pipeline.findIndex((stage) => stage.$limit !== undefined);
                const firstLookupIndex = pipeline.findIndex((stage) => stage.$lookup);
                expect(limitIndex).toBeGreaterThan(-1);
                expect(firstLookupIndex).toBeGreaterThan(limitIndex);
            });

            it('should $lookup before pagination when sorting on a joined field', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    ...mockParams,
                    orderBy: 'submitterName',
                });

                const pipeline = SubmissionModel.aggregate.mock.calls[0][0];
                const sortIndex = pipeline.findIndex((stage) => stage.$sort);
                const firstLookupIndex = pipeline.findIndex((stage) => stage.$lookup);
                expect(firstLookupIndex).toBeGreaterThan(-1);
                expect(sortIndex).toBeGreaterThan(firstLookupIndex);
            });

            it('should default first to -1 so no $limit is built with undefined', async () => {
                await dao.listSubmissions(mockUserInfo, mockUserScope, {
                    offset: 0,
                    orderBy: 'updatedAt',
                    sortDirection: 'desc',
                });

                expect(MongoPagination).toHaveBeenCalledWith(-1, 0, 'updatedAt', 'desc');
            });
        });

        describe('Aggregations', () => {
            it('should return submitterNames from distinct submitter aggregation', async () => {
                SubmissionModel.aggregate
                    .mockResolvedValueOnce([mockAggregatedSubmission])
                    .mockResolvedValueOnce([
                        { fullName: 'Alice' },
                        { fullName: 'Bob' },
                    ]);

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(result.submitterNames).toEqual(['Alice', 'Bob']);
                const submitterPipeline = SubmissionModel.aggregate.mock.calls[1][0];
                expect(submitterPipeline.some((stage) => stage.$facet)).toBe(false);
                expect(submitterPipeline.some((stage) => stage.$group)).toBe(true);
            });

            it('should sort submitterNames case-insensitively rather than in binary order', async () => {
                SubmissionModel.aggregate
                    .mockResolvedValueOnce([mockAggregatedSubmission])
                    .mockResolvedValueOnce([
                        { fullName: 'Zoe Zimmer' },
                        { fullName: 'alice Adams' },
                        { fullName: 'Bob Brown' },
                    ]);

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(result.submitterNames).toEqual(['alice Adams', 'Bob Brown', 'Zoe Zimmer']);
                const submitterPipeline = SubmissionModel.aggregate.mock.calls[1][0];
                expect(submitterPipeline.some((stage) => stage.$sort)).toBe(false);
            });

            it('should return organizations from ProgramDAO', async () => {
                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(result.organizations).toEqual([
                    { _id: 'org-1', name: 'Org One', abbreviation: 'O1' },
                ]);
            });

            it('should expose statuses as a function of predefined values', async () => {
                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(typeof result.statuses).toBe('function');
                expect(result.statuses()).toEqual([
                    NEW, IN_PROGRESS, SUBMITTED, WITHDRAWN, RELEASED, REJECTED, COMPLETED, CANCELED, DELETED,
                ]);
            });

            it('should zero dataFileSize for deleted submissions', async () => {
                SubmissionModel.aggregate.mockResolvedValue([
                    { ...mockAggregatedSubmission, status: DELETED },
                ]);

                const result = await dao.listSubmissions(mockUserInfo, mockUserScope, mockParams);

                expect(result.submissions[0].dataFileSize).toEqual({ size: 0, formatted: 'NA' });
            });
        });

        describe('Validation and errors', () => {
            it('should reject invalid status filters', async () => {
                await expect(
                    dao.listSubmissions(mockUserInfo, mockUserScope, {
                        ...mockParams,
                        status: ['NotAStatus'],
                    })
                ).rejects.toThrow(ERROR.LIST_SUBMISSION_INVALID_STATUS_FILTER.replace('$item$', "'NotAStatus'"));
            });

            it('should wrap aggregate failures', async () => {
                SubmissionModel.aggregate.mockRejectedValue(new Error('boom'));

                await expect(
                    dao.listSubmissions(mockUserInfo, mockUserScope, mockParams)
                ).rejects.toThrow('Failed to list submissions: Failed to aggregate Submission');
            });
        });
    });

    describe('programLevelSubmissions', () => {
        it('should return empty array when studyIDs are missing', async () => {
            expect(await dao.programLevelSubmissions([])).toEqual([]);
            expect(await dao.programLevelSubmissions(null)).toEqual([]);
        });

        it('should return submission IDs for studies with useProgramPC', async () => {
            mockApprovedStudyDAO.findMany.mockResolvedValue([{ _id: 'study-1' }]);
            SubmissionModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([{ _id: 'sub-1' }, { _id: 'sub-2' }]),
            });

            const result = await dao.programLevelSubmissions(['study-1', 'study-2']);

            expect(mockApprovedStudyDAO.findMany).toHaveBeenCalledWith({
                _id: { $in: ['study-1', 'study-2'] },
                useProgramPC: true,
            }, { projection: { _id: 1 } });
            expect(result).toEqual([{ _id: 'sub-1' }, { _id: 'sub-2' }]);
        });
    });

    describe('inactive / archive helpers', () => {
        it('getInactiveSubmission should query with $lt and $ne reminder flag', async () => {
            SubmissionModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([{ _id: 'sub-1' }]),
            });

            const result = await dao.getInactiveSubmission(7, 'inactiveReminder_7');

            expect(SubmissionModel.find).toHaveBeenCalledWith(expect.objectContaining({
                status: { $in: [NEW, IN_PROGRESS, REJECTED, WITHDRAWN] },
                inactiveReminder_7: { $ne: true },
                accessedAt: expect.objectContaining({ $lt: expect.any(Date) }),
            }));
            expect(result).toEqual([{ id: 'sub-1', _id: 'sub-1' }]);
        });

        it('getToBeDeletedSubmissions should require accessedAt and status $in', async () => {
            SubmissionModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([{ _id: 'sub-2' }]),
            });

            const result = await dao.getToBeDeletedSubmissions(120);

            expect(SubmissionModel.find).toHaveBeenCalledWith(expect.objectContaining({
                status: { $in: [IN_PROGRESS, NEW, REJECTED, WITHDRAWN] },
                accessedAt: expect.objectContaining({
                    $ne: null,
                    $lt: expect.any(Date),
                }),
            }));
            expect(result).toEqual([{ id: 'sub-2', _id: 'sub-2' }]);
        });

        it('getToBeArchivedSubmissions should query completed submissions by updatedAt', async () => {
            SubmissionModel.find.mockReturnValue({
                lean: jest.fn().mockResolvedValue([{ _id: 'sub-3' }]),
            });

            const result = await dao.getToBeArchivedSubmissions(30);

            expect(SubmissionModel.find).toHaveBeenCalledWith(expect.objectContaining({
                status: COMPLETED,
                updatedAt: expect.objectContaining({ $lte: expect.any(Date) }),
            }));
            expect(result).toEqual([{ id: 'sub-3', _id: 'sub-3' }]);
        });
    });
});
