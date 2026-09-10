jest.mock('../../mongoose/models/application', () => ({
    modelName: 'Application',
    find: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
}));

const ApplicationModel = require('../../mongoose/models/application');
const ApplicationDAO = require('../../dao/application');
const {USER_COLLECTION} = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock, select: jest.Mock, sort: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
    };
}

describe('ApplicationDAO batch application lookups', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApplicationDAO();
    });

    describe('findApplicationStatusesByIds', () => {
        it('returns an empty array when ids is empty', async () => {
            const result = await dao.findApplicationStatusesByIds([]);

            expect(result).toEqual([]);
            expect(ApplicationModel.find).not.toHaveBeenCalled();
        });

        it('loads application statuses in one query', async () => {
            ApplicationModel.find.mockReturnValue(createLeanQuery([
                {_id: 'successor-active', status: 'Reopened'},
            ]));

            const result = await dao.findApplicationStatusesByIds(['successor-active', 'successor-canceled']);

            expect(ApplicationModel.find).toHaveBeenCalledWith({
                _id: {$in: ['successor-active', 'successor-canceled']},
            });
            expect(result).toEqual([{id: 'successor-active', status: 'Reopened', _id: 'successor-active'}]);
        });
    });

    describe('findApprovedApplicationsByNextRevisionIds', () => {
        it('returns an empty array when nextRevisionIds is empty', async () => {
            const result = await dao.findApprovedApplicationsByNextRevisionIds([]);

            expect(result).toEqual([]);
            expect(ApplicationModel.find).not.toHaveBeenCalled();
        });

        it('loads approved applications by nextRevisionId in one query', async () => {
            ApplicationModel.find.mockReturnValue(createLeanQuery([
                {nextRevisionId: 'c2'},
            ]));

            const result = await dao.findApprovedApplicationsByNextRevisionIds(['c2', 'd2']);

            expect(ApplicationModel.find).toHaveBeenCalledWith({
                nextRevisionId: {$in: ['c2', 'd2']},
                status: 'Approved',
            });
            expect(result).toEqual([{nextRevisionId: 'c2'}]);
        });
    });

    describe('findApprovedParentSubmissionRequestByID', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApprovedParentSubmissionRequestByID(null)).resolves.toBeNull();
            expect(ApplicationModel.findOne).not.toHaveBeenCalled();
        });

        it('loads the Approved parent linking to the successor via nextRevisionId', async () => {
            ApplicationModel.findOne.mockReturnValue(createLeanQuery({
                _id: 'parent-app',
                status: 'Approved',
                nextRevisionId: 'successor-app',
            }));

            const result = await dao.findApprovedParentSubmissionRequestByID('successor-app');

            expect(ApplicationModel.findOne).toHaveBeenCalledWith({
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
            ApplicationModel.findOne.mockReturnValue(createLeanQuery(null));

            await expect(dao.findApprovedParentSubmissionRequestByID('orphan-app')).resolves.toBeNull();
        });
    });

    describe('findApplicationStatusById', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApplicationStatusById(null)).resolves.toBeNull();
            expect(ApplicationModel.findOne).not.toHaveBeenCalled();
        });

        it('loads status with findFirst projection', async () => {
            ApplicationModel.findOne.mockReturnValue(createLeanQuery({status: 'Reopened'}));

            const result = await dao.findApplicationStatusById('successor-id');

            expect(ApplicationModel.findOne).toHaveBeenCalledWith({_id: 'successor-id'});
            expect(result).toEqual({status: 'Reopened'});
        });
    });

    describe('findApplicationWithApplicantById', () => {
        it('returns null when id is falsy', async () => {
            await expect(dao.findApplicationWithApplicantById(null)).resolves.toBeNull();
            expect(ApplicationModel.aggregate).not.toHaveBeenCalled();
        });

        it('loads application with applicant $lookup', async () => {
            ApplicationModel.aggregate.mockResolvedValue([
                {
                    _id: 'app1',
                    status: 'Approved',
                    applicant: {id: 'u1', fullName: 'Alice', email: 'a@a'},
                },
            ]);

            const result = await dao.findApplicationWithApplicantById('app1');

            expect(ApplicationModel.aggregate).toHaveBeenCalled();
            const pipeline = ApplicationModel.aggregate.mock.calls[0][0];
            expect(pipeline[0]).toEqual({$match: {_id: 'app1'}});
            expect(pipeline[1].$lookup.from).toBe(USER_COLLECTION);
            expect(result._id).toBe('app1');
        });
    });

    describe('findLatestApprovedByApplicantID', () => {
        it('returns null when applicantID is falsy', async () => {
            await expect(dao.findLatestApprovedByApplicantID(null)).resolves.toBeNull();
            expect(ApplicationModel.findOne).not.toHaveBeenCalled();
        });

        it('loads the latest approved application for an applicant', async () => {
            ApplicationModel.findOne.mockReturnValue(createLeanQuery({_id: 'app-latest', status: 'Approved'}));

            const result = await dao.findLatestApprovedByApplicantID('user1');

            expect(ApplicationModel.findOne).toHaveBeenCalledWith({
                applicantID: 'user1',
                status: 'Approved',
            });
            expect(result).toEqual({id: 'app-latest', status: 'Approved', _id: 'app-latest'});
        });
    });

    describe('findApplicantIDsByApplicationIDs', () => {
        it('returns an empty array when ids is empty', async () => {
            const result = await dao.findApplicantIDsByApplicationIDs([]);
            expect(result).toEqual([]);
            expect(ApplicationModel.find).not.toHaveBeenCalled();
        });

        it('loads applicantIDs for the given application ids', async () => {
            ApplicationModel.find.mockReturnValue(createLeanQuery([
                {_id: 'app1', applicantID: 'user1'},
            ]));

            const result = await dao.findApplicantIDsByApplicationIDs(['app1', 'app2']);

            expect(ApplicationModel.find).toHaveBeenCalledWith({
                _id: {$in: ['app1', 'app2']},
            });
            expect(result).toEqual([{id: 'app1', _id: 'app1', applicantID: 'user1'}]);
        });
    });
});
