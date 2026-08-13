const { UserService } = require('../../services/user');
const ERROR = require('../../constants/error-constants');
const { ERROR: SUBMODULE_ERROR } = require('../../crdc-datahub-database-drivers/constants/error-constants');

jest.mock('../../utility/data-commons-remapper', () => ({
    getDataCommonsDisplayNamesForUser: jest.fn((u) => u),
}));

describe('UserService.updateUserInfo — approved study status', () => {
    let userService;

    beforeEach(() => {
        const mockApprovedStudiesService = { approvedStudiesCollection: {} };
        userService = new UserService(
            {},
            {},
            {},
            {},
            'e@e.com',
            'http://x',
            mockApprovedStudiesService,
            30,
            {},
            {},
            {}
        );
        userService.userDAO = { update: jest.fn() };
        userService._findApprovedStudies = jest.fn();
        userService._notifyDeactivatedUser = jest.fn();
        userService._notifyUpdatedUser = jest.fn();
        userService._logAfterUserEdit = jest.fn();
        userService._removePrimaryContact = jest.fn();
    });

    it('throws when assigning a non-Active approved study the user did not already have', async () => {
        userService._findApprovedStudies.mockResolvedValue([
            { _id: 's1', status: 'Inactive', studyName: 'X' },
        ]);
        userService.userDAO.update = jest.fn();

        await expect(
            userService.updateUserInfo({}, {}, 'uid', null, null, ['s1'])
        ).rejects.toThrow(ERROR.INACTIVE_APPROVED_STUDY_CANNOT_ASSIGN);

        expect(userService.userDAO.update).not.toHaveBeenCalled();
    });

    it('allows keeping an inactive study the user already had', async () => {
        userService._findApprovedStudies.mockResolvedValue([
            { _id: 's1', status: 'Inactive', studyName: 'X' },
        ]);
        userService.userDAO.update = jest.fn().mockResolvedValue({ _id: 'uid', studies: [{ _id: 's1' }] });

        await userService.updateUserInfo(
            { studies: [{ _id: 's1' }] },
            {},
            'uid',
            null,
            null,
            ['s1']
        );

        expect(userService.userDAO.update).toHaveBeenCalled();
    });

    it('throws when adding a new inactive study while retaining a different inactive study', async () => {
        userService._findApprovedStudies.mockResolvedValue([
            { _id: 's1', status: 'Inactive', studyName: 'A' },
            { _id: 's2', status: 'Inactive', studyName: 'B' },
        ]);
        userService.userDAO.update = jest.fn();

        await expect(
            userService.updateUserInfo(
                { studies: [{ _id: 's1' }] },
                {},
                'uid',
                null,
                null,
                ['s1', 's2']
            )
        ).rejects.toThrow(ERROR.INACTIVE_APPROVED_STUDY_CANNOT_ASSIGN);

        expect(userService.userDAO.update).not.toHaveBeenCalled();
    });

    it('does not throw for All studies shortcut', async () => {
        userService._findApprovedStudies.mockResolvedValue([{ _id: 'All', studyName: 'All' }]);
        userService.userDAO.update = jest.fn().mockResolvedValue({ _id: 'uid', studies: [{ _id: 'All' }] });

        await userService.updateUserInfo({}, {}, 'uid', null, null, ['All']);

        expect(userService.userDAO.update).toHaveBeenCalled();
    });

    it('does not infer inactive retention from prior All — explicit list must not add inactive without prior explicit id', async () => {
        userService._findApprovedStudies.mockResolvedValue([
            { _id: 's1', status: 'Inactive', studyName: 'X' },
        ]);
        userService.userDAO.update = jest.fn();

        await expect(
            userService.updateUserInfo(
                { studies: [{ _id: 'All' }] },
                {},
                'uid',
                null,
                null,
                ['s1']
            )
        ).rejects.toThrow(ERROR.INACTIVE_APPROVED_STUDY_CANNOT_ASSIGN);

        expect(userService.userDAO.update).not.toHaveBeenCalled();
    });

    it('throws UPDATE_FAILED when userDAO.update rejects', async () => {
        userService._findApprovedStudies.mockResolvedValue([]);
        userService.userDAO.update = jest.fn().mockRejectedValue(new Error('Failed to update User'));

        await expect(
            userService.updateUserInfo({}, {}, 'uid', null, null, [])
        ).rejects.toThrow(SUBMODULE_ERROR.UPDATE_FAILED);
    });
});
