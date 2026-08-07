jest.mock('../../mongoose/models/submission-request', () => ({
    modelName: 'SubmissionRequest',
    updateMany: jest.fn(),
}));

const SubmissionRequestModel = require('../../mongoose/models/submission-request');
const SubmissionRequestDAO = require('../../dao/submission-request');

describe('SubmissionRequestDAO.clearNextRevisionIdPointingTo', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new SubmissionRequestDAO();
    });

    it('returns zero counts when applicationId is falsy', async () => {
        const result = await dao.clearNextRevisionIdPointingTo(null);

        expect(result).toEqual({ matchedCount: 0, modifiedCount: 0, count: 0, acknowledged: true });
        expect(SubmissionRequestModel.updateMany).not.toHaveBeenCalled();
    });

    it('clears nextRevisionId on predecessors pointing at the given id', async () => {
        SubmissionRequestModel.updateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
        const successorId = 'terminal-successor-id';
        const result = await dao.clearNextRevisionIdPointingTo(successorId);

        expect(SubmissionRequestModel.updateMany).toHaveBeenCalledWith(
            { nextRevisionId: successorId },
            {
                $set: expect.objectContaining({
                    nextRevisionId: null,
                    updatedAt: expect.any(Date),
                }),
            }
        );
        expect(result).toEqual({
            matchedCount: 1,
            modifiedCount: 1,
            count: 1,
            acknowledged: true,
        });
    });
});
