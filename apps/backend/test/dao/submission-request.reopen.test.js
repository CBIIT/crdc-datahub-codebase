jest.mock('../../mongoose/models/submission-request', () => ({
    modelName: 'SubmissionRequest',
    findOne: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
}));

const SubmissionRequestModel = require('../../mongoose/models/submission-request');
const SubmissionRequestDAO = require('../../dao/submission-request');
const { APPROVED } = require('../../constants/submission-request-constants');
const ERROR = require('../../constants/error-constants');

/**
 * @param {*} resolvedValue
 * @returns {{ lean: jest.Mock }}
 */
function createLeanQuery(resolvedValue) {
    return {
        lean: jest.fn().mockResolvedValue(resolvedValue),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
    };
}

describe('SubmissionRequestDAO.reopenApprovedRevision', () => {
    let dao;

    const sourceId = 'approved-source-id';
    const newSubmissionRequest = {
        _id: 'new-revision-id',
        status: 'Reopened',
        sequenceNumber: 2,
        updatedAt: new Date('2026-05-18T12:00:00Z'),
        studyName: 'Study',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new SubmissionRequestDAO();
        dao.insert = jest.fn();
    });

    it('links source then inserts successor when update matches one document', async () => {
        SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
        dao.insert.mockResolvedValue({ acknowledged: true });

        const result = await dao.reopenApprovedRevision(sourceId, newSubmissionRequest);

        expect(SubmissionRequestModel.updateMany).toHaveBeenCalledWith(
            {
                _id: sourceId,
                status: APPROVED,
                $or: [
                    { nextRevisionId: null },
                    { nextRevisionId: { $exists: false } },
                ],
            },
            {
                $set: expect.objectContaining({
                    nextRevisionId: newSubmissionRequest._id,
                    updatedAt: newSubmissionRequest.updatedAt,
                }),
            }
        );
        expect(dao.insert).toHaveBeenCalledWith(newSubmissionRequest);
        expect(result).toEqual(expect.objectContaining({ _id: newSubmissionRequest._id, status: 'Reopened' }));
    });

    it('replaces an existing nextRevisionId link when replaceExistingLink is true', async () => {
        SubmissionRequestModel.findOne.mockReturnValue(
            createLeanQuery({ _id: sourceId, nextRevisionId: 'prior-successor-id' })
        );
        SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
        dao.insert.mockResolvedValue({ acknowledged: true });

        await dao.reopenApprovedRevision(sourceId, newSubmissionRequest, true);

        expect(SubmissionRequestModel.updateMany).toHaveBeenCalledWith(
            { _id: sourceId, status: APPROVED },
            {
                $set: expect.objectContaining({
                    nextRevisionId: newSubmissionRequest._id,
                    updatedAt: newSubmissionRequest.updatedAt,
                }),
            }
        );
    });

    it('throws INVALID_STATE when source update matches zero documents', async () => {
        SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

        await expect(dao.reopenApprovedRevision(sourceId, newSubmissionRequest))
            .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);

        expect(dao.insert).not.toHaveBeenCalled();
    });

    it('compensates source link when insert fails', async () => {
        SubmissionRequestModel.updateMany
            .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 })
            .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newSubmissionRequest)).rejects.toThrow('insert failed');

        expect(SubmissionRequestModel.updateMany).toHaveBeenCalledTimes(2);
        expect(SubmissionRequestModel.updateMany).toHaveBeenLastCalledWith(
            { _id: sourceId },
            { $set: expect.objectContaining({ nextRevisionId: null }) }
        );
    });

    it('restores the prior nextRevisionId when replaceExistingLink insert fails', async () => {
        SubmissionRequestModel.findOne.mockReturnValue(
            createLeanQuery({ _id: sourceId, nextRevisionId: 'prior-successor-id' })
        );
        SubmissionRequestModel.updateMany
            .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 })
            .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newSubmissionRequest, true)).rejects.toThrow('insert failed');

        expect(SubmissionRequestModel.updateMany).toHaveBeenLastCalledWith(
            { _id: sourceId },
            { $set: expect.objectContaining({ nextRevisionId: 'prior-successor-id' }) }
        );
    });

    it('throws UPDATE_FAILED when insert is not acknowledged', async () => {
        SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
        dao.insert.mockResolvedValue({ acknowledged: false });

        await expect(dao.reopenApprovedRevision(sourceId, newSubmissionRequest))
            .rejects.toThrow(ERROR.UPDATE_FAILED);
    });
});
