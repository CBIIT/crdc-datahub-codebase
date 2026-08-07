jest.mock('../../mongoose/models/submission-request', () => ({
    modelName: 'SubmissionRequest',
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
}));

const SubmissionRequestModel = require('../../mongoose/models/submission-request');
const SubmissionRequestDAO = require('../../dao/submission-request');

/**
 * @param {*} resolvedValue
 * @returns {object}
 */
function createLeanQuery(resolvedValue) {
    const query = {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
    };
    return query;
}

describe('SubmissionRequestDAO batch SRF lookups', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new SubmissionRequestDAO();
    });

    describe('findSubmissionRequestStatusesByIDs', () => {
        it('returns an empty array when ids is empty', async () => {
            const result = await dao.findSubmissionRequestStatusesByIDs([]);

            expect(result).toEqual([]);
            expect(SubmissionRequestModel.find).not.toHaveBeenCalled();
        });

        it('loads SRF statuses in one query', async () => {
            SubmissionRequestModel.find.mockReturnValue(
                createLeanQuery([{ _id: 'successor-active', status: 'Reopened' }])
            );

            const result = await dao.findSubmissionRequestStatusesByIDs(['successor-active', 'successor-canceled']);

            expect(SubmissionRequestModel.find).toHaveBeenCalledWith({
                _id: { $in: ['successor-active', 'successor-canceled'] },
            });
            expect(result).toEqual([{ id: 'successor-active', status: 'Reopened', _id: 'successor-active' }]);
        });
    });

    describe('findApprovedSubmissionRequestsByNextRevisionIDs', () => {
        it('returns an empty array when nextRevisionIds is empty', async () => {
            const result = await dao.findApprovedSubmissionRequestsByNextRevisionIDs([]);

            expect(result).toEqual([]);
            expect(SubmissionRequestModel.find).not.toHaveBeenCalled();
        });

        it('loads approved SRFs by nextRevisionId in one query', async () => {
            SubmissionRequestModel.find.mockReturnValue(
                createLeanQuery([{ _id: 'parent', nextRevisionId: 'c2' }])
            );

            const result = await dao.findApprovedSubmissionRequestsByNextRevisionIDs(['c2', 'd2']);

            expect(SubmissionRequestModel.find).toHaveBeenCalledWith({
                nextRevisionId: { $in: ['c2', 'd2'] },
                status: 'Approved',
            });
            expect(result).toEqual([{ id: 'parent', _id: 'parent', nextRevisionId: 'c2' }]);
        });
    });

    describe('findApprovedParentSubmissionRequestByID', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApprovedParentSubmissionRequestByID(null)).resolves.toBeNull();
            expect(SubmissionRequestModel.findOne).not.toHaveBeenCalled();
        });

        it('loads the Approved parent linking to the successor via nextRevisionId', async () => {
            SubmissionRequestModel.findOne.mockReturnValue(
                createLeanQuery({
                    _id: 'parent-app',
                    status: 'Approved',
                    nextRevisionId: 'successor-app',
                })
            );

            const result = await dao.findApprovedParentSubmissionRequestByID('successor-app');

            expect(SubmissionRequestModel.findOne).toHaveBeenCalledWith({
                nextRevisionId: 'successor-app',
                status: 'Approved',
            });
            expect(result).toEqual({
                id: 'parent-app',
                status: 'Approved',
                nextRevisionId: 'successor-app',
                _id: 'parent-app',
            });
        });

        it('returns null when no Approved parent links to the successor', async () => {
            SubmissionRequestModel.findOne.mockReturnValue(createLeanQuery(null));

            await expect(dao.findApprovedParentSubmissionRequestByID('orphan-app')).resolves.toBeNull();
        });
    });

    describe('findSubmissionRequestStatusByID', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findSubmissionRequestStatusByID(null)).resolves.toBeNull();
            expect(SubmissionRequestModel.findOne).not.toHaveBeenCalled();
        });

        it('loads status with findOne', async () => {
            SubmissionRequestModel.findOne.mockReturnValue(
                createLeanQuery({ status: 'Reopened' })
            );

            const result = await dao.findSubmissionRequestStatusByID('successor-id');

            expect(SubmissionRequestModel.findOne).toHaveBeenCalledWith({ _id: 'successor-id' });
            expect(result).toEqual({ status: 'Reopened' });
        });
    });

    describe('findSubmissionRequestWithApplicantByID', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findSubmissionRequestWithApplicantByID(null)).resolves.toBeNull();
            expect(SubmissionRequestModel.aggregate).not.toHaveBeenCalled();
        });

        it('loads SRF with applicant via aggregation lookup', async () => {
            SubmissionRequestModel.aggregate.mockResolvedValue([
                {
                    _id: 'app1',
                    status: 'Approved',
                    applicant: { _id: 'u1', fullName: 'Alice', email: 'a@a' },
                },
            ]);

            const result = await dao.findSubmissionRequestWithApplicantByID('app1');

            expect(SubmissionRequestModel.aggregate).toHaveBeenCalled();
            expect(result._id).toBe('app1');
            expect(result.id).toBe('app1');
        });
    });

    describe('findLatestApprovedByApplicantID', () => {
        it('returns null when applicantID is falsy', async () => {
            await expect(dao.findLatestApprovedByApplicantID(null)).resolves.toBeNull();
            expect(SubmissionRequestModel.findOne).not.toHaveBeenCalled();
        });

        it('loads the latest approved SRF for an applicant', async () => {
            SubmissionRequestModel.findOne.mockReturnValue(
                createLeanQuery({ _id: 'app-latest', status: 'Approved' })
            );

            const result = await dao.findLatestApprovedByApplicantID('user1');

            expect(SubmissionRequestModel.findOne).toHaveBeenCalledWith({
                applicantID: 'user1',
                status: 'Approved',
            });
            expect(result).toEqual({ id: 'app-latest', status: 'Approved', _id: 'app-latest' });
        });
    });
});
