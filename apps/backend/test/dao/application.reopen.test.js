jest.mock('../../mongoose/models/application', () => ({
    modelName: 'Application',
    findOne: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
}));

const ApplicationModel = require('../../mongoose/models/application');
const ApplicationDAO = require('../../dao/application');
const {APPROVED} = require('../../constants/application-constants');
const ERROR = require('../../constants/error-constants');

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

describe('ApplicationDAO.reopenApprovedRevision', () => {
    let dao;

    const sourceId = 'approved-source-id';
    const newApp = {
        _id: 'new-revision-id',
        status: 'Reopened',
        sequenceNumber: 2,
        updatedAt: new Date('2026-05-18T12:00:00Z'),
        studyName: 'Study',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApplicationDAO();
        dao.insert = jest.fn();
    });

    it('links source then inserts successor when update matches one document', async () => {
        ApplicationModel.updateMany.mockResolvedValue({matchedCount: 1, modifiedCount: 1});
        dao.insert.mockResolvedValue({acknowledged: true});

        const result = await dao.reopenApprovedRevision(sourceId, newApp);

        expect(ApplicationModel.updateMany).toHaveBeenCalledWith(
            {
                _id: sourceId,
                status: APPROVED,
                $or: [
                    {nextRevisionId: null},
                    {nextRevisionId: {$exists: false}},
                ],
            },
            {
                $set: expect.objectContaining({
                    nextRevisionId: newApp._id,
                    updatedAt: newApp.updatedAt,
                }),
            }
        );
        expect(dao.insert).toHaveBeenCalledWith(newApp);
        expect(result).toEqual(expect.objectContaining({_id: newApp._id, status: 'Reopened'}));
    });

    it('replaces an existing nextRevisionId link when replaceExistingLink is true', async () => {
        ApplicationModel.findOne.mockReturnValue(createLeanQuery({nextRevisionId: 'prior-successor-id'}));
        ApplicationModel.updateMany.mockResolvedValue({matchedCount: 1, modifiedCount: 1});
        dao.insert.mockResolvedValue({acknowledged: true});

        await dao.reopenApprovedRevision(sourceId, newApp, true);

        expect(ApplicationModel.findOne).toHaveBeenCalledWith({_id: sourceId});
        expect(ApplicationModel.updateMany).toHaveBeenCalledWith(
            {_id: sourceId, status: APPROVED},
            {
                $set: expect.objectContaining({
                    nextRevisionId: newApp._id,
                    updatedAt: newApp.updatedAt,
                }),
            }
        );
    });

    it('throws INVALID_STATE when source update matches zero documents', async () => {
        ApplicationModel.updateMany.mockResolvedValue({matchedCount: 0, modifiedCount: 0});

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);

        expect(dao.insert).not.toHaveBeenCalled();
    });

    it('compensates source link when insert fails', async () => {
        ApplicationModel.updateMany
            .mockResolvedValueOnce({matchedCount: 1, modifiedCount: 1})
            .mockResolvedValueOnce({matchedCount: 1, modifiedCount: 1});
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp)).rejects.toThrow('insert failed');

        expect(ApplicationModel.updateMany).toHaveBeenCalledTimes(2);
        expect(ApplicationModel.updateMany).toHaveBeenLastCalledWith(
            {_id: sourceId},
            {$set: expect.objectContaining({nextRevisionId: null})}
        );
    });

    it('restores the prior nextRevisionId when replaceExistingLink insert fails', async () => {
        ApplicationModel.findOne.mockReturnValue(createLeanQuery({nextRevisionId: 'prior-successor-id'}));
        ApplicationModel.updateMany
            .mockResolvedValueOnce({matchedCount: 1, modifiedCount: 1})
            .mockResolvedValueOnce({matchedCount: 1, modifiedCount: 1});
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp, true)).rejects.toThrow('insert failed');

        expect(ApplicationModel.updateMany).toHaveBeenLastCalledWith(
            {_id: sourceId},
            {$set: expect.objectContaining({nextRevisionId: 'prior-successor-id'})}
        );
    });

    it('throws UPDATE_FAILED when insert is not acknowledged', async () => {
        ApplicationModel.updateMany.mockResolvedValue({matchedCount: 1, modifiedCount: 1});
        dao.insert.mockResolvedValue({acknowledged: false});

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.UPDATE_FAILED);
    });
});
