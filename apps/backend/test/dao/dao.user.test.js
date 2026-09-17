jest.mock('../../mongoose/models/user', () => ({
    modelName: 'User',
    findOne: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
}));

const UserDAO = require('../../dao/user');
const UserModel = require('../../mongoose/models/user');
const MongooseGenericDAO = require('../../dao/mongoose-generic');
const {USER} = require('../../crdc-datahub-database-drivers/constants/user-constants');
const USER_PERMISSION_CONSTANTS = require('../../crdc-datahub-database-drivers/constants/user-permission-constants');
const SCOPES = require('../../constants/permission-scope-constants');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
    };
}

describe('UserDAO', () => {
    let userDAO;

    beforeEach(() => {
        userDAO = new UserDAO();
        jest.clearAllMocks();
    });

    it('should extend MongooseGenericDAO and use the User model', () => {
        expect(userDAO).toBeInstanceOf(MongooseGenericDAO);
        expect(userDAO.model).toBe(UserModel);
        expect(userDAO.model.modelName).toBe('User');
    });

    describe('findByIdAndStatus', () => {
        it('should return user with id and _id when found', async () => {
            const mockUser = {_id: 'user-1', userStatus: 'Active'};
            UserModel.findOne.mockReturnValue(createLeanQuery(mockUser));

            const result = await userDAO.findByIdAndStatus('user-1', 'Active');

            expect(UserModel.findOne).toHaveBeenCalledWith({_id: 'user-1', userStatus: 'Active'});
            expect(result).toEqual({
                id: 'user-1',
                _id: 'user-1',
                userStatus: 'Active',
            });
        });

        it('should return null when user is not found', async () => {
            UserModel.findOne.mockReturnValue(createLeanQuery(null));

            const result = await userDAO.findByIdAndStatus('missing', 'Inactive');

            expect(UserModel.findOne).toHaveBeenCalledWith({_id: 'missing', userStatus: 'Inactive'});
            expect(result).toBeNull();
        });
    });

    describe('getUsersByNotifications', () => {
        it('should find active users by notifications', async () => {
            const notifications = ['notif-1'];
            UserModel.find.mockReturnValue(createLeanQuery([{_id: 'u1', notifications}]));

            const result = await userDAO.getUsersByNotifications(notifications);

            expect(UserModel.find).toHaveBeenCalledWith({
                userStatus: USER.STATUSES.ACTIVE,
                notifications: {$in: notifications},
            });
            expect(result).toEqual([{id: 'u1', _id: 'u1', notifications}]);
        });

        it('should include role filter when roles are provided', async () => {
            const notifications = ['notif-1'];
            const roles = [USER.ROLES.ADMIN];
            UserModel.find.mockReturnValue(createLeanQuery([]));

            await userDAO.getUsersByNotifications(notifications, roles);

            expect(UserModel.find).toHaveBeenCalledWith({
                userStatus: USER.STATUSES.ACTIVE,
                notifications: {$in: notifications},
                role: {$in: roles},
            });
        });
    });

    describe('findManyByIds', () => {
        it('should return empty array for empty input', async () => {
            const result = await userDAO.findManyByIds([]);
            expect(result).toEqual([]);
            expect(UserModel.find).not.toHaveBeenCalled();
        });

        it('should find users by IDs', async () => {
            UserModel.find.mockReturnValue(createLeanQuery([{_id: 'a'}, {_id: 'b'}]));

            const result = await userDAO.findManyByIds(['a', 'b']);

            expect(UserModel.find).toHaveBeenCalledWith({_id: {$in: ['a', 'b']}});
            expect(result).toEqual([
                {id: 'a', _id: 'a'},
                {id: 'b', _id: 'b'},
            ]);
        });
    });

    describe('updateUserOrg', () => {
        it('should update users whose organization name differs', async () => {
            UserModel.updateMany.mockResolvedValue({modifiedCount: 2});
            const updatedOrg = {name: 'New Org', updateAt: new Date('2023-01-01')};

            const result = await userDAO.updateUserOrg('org-1', updatedOrg);

            expect(UserModel.updateMany).toHaveBeenCalledWith(
                {'organization.orgID': 'org-1', 'organization.orgName': {$ne: 'New Org'}},
                {
                    $set: expect.objectContaining({
                        'organization.orgName': 'New Org',
                        'organization.updateAt': updatedOrg.updateAt,
                    }),
                }
            );
            expect(result).toEqual({count: 2});
        });
    });

    describe('getCollaboratorsByStudyID', () => {
        const studyID = 'study-123';
        const submitterID = 'submitter-1';

        it('should query active submitters with study or All access, excluding the owner', async () => {
            UserModel.find.mockReturnValue(createLeanQuery([{_id: 'collab-1', studies: [{_id: studyID}]}]));

            const result = await userDAO.getCollaboratorsByStudyID(studyID, submitterID);

            expect(UserModel.find).toHaveBeenCalledWith({
                _id: {$ne: submitterID},
                role: USER.ROLES.SUBMITTER,
                userStatus: USER.STATUSES.ACTIVE,
                permissions: {$in: [`${USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE}:${SCOPES.OWN}`]},
                $or: [
                    {'studies._id': {$in: [studyID, 'All']}},
                    {
                        $expr: {
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: {$ifNull: ['$studies', []]},
                                            as: 's',
                                            cond: {
                                                $and: [
                                                    {$eq: [{$type: '$$s'}, 'string']},
                                                    {$in: ['$$s', [studyID, 'All']]},
                                                ],
                                            },
                                        },
                                    },
                                },
                                0,
                            ],
                        },
                    },
                ],
            });
            expect(result).toEqual([{id: 'collab-1', _id: 'collab-1', studies: [{_id: studyID}]}]);
        });

        it('should return empty array when no collaborators match', async () => {
            UserModel.find.mockReturnValue(createLeanQuery([]));

            const result = await userDAO.getCollaboratorsByStudyID(studyID, submitterID);

            expect(result).toEqual([]);
        });
    });

    describe('countSubmittersByInstitutionIDs', () => {
        it('should group Submitter users by institution ID', async () => {
            UserModel.aggregate.mockResolvedValue([
                { _id: 'inst-1', submitterCount: 3 },
            ]);

            const result = await userDAO.countSubmittersByInstitutionIDs(['inst-1', 'inst-2']);

            expect(UserModel.aggregate).toHaveBeenCalledWith([
                {
                    $match: {
                        role: USER.ROLES.SUBMITTER,
                        'institution._id': { $in: ['inst-1', 'inst-2'] },
                    },
                },
                {
                    $group: {
                        _id: '$institution._id',
                        submitterCount: { $sum: 1 },
                    },
                },
            ]);
            expect(result).toEqual([{ _id: 'inst-1', id: 'inst-1', submitterCount: 3 }]);
        });

        it('should return an empty array without aggregating when institutionIDs is empty', async () => {
            const result = await userDAO.countSubmittersByInstitutionIDs([]);
            expect(result).toEqual([]);
            expect(UserModel.aggregate).not.toHaveBeenCalled();
        });
    });
});
