jest.mock('../../mongoose/models/application', () => ({
    modelName: 'Application',
    updateMany: jest.fn(),
}));

const ApplicationModel = require('../../mongoose/models/application');
const ApplicationDAO = require('../../dao/application');

describe('ApplicationDAO.clearNextRevisionIdPointingTo', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApplicationDAO();
    });

    it('returns zero counts when applicationId is falsy', async () => {
        const result = await dao.clearNextRevisionIdPointingTo(null);

        expect(result).toEqual({matchedCount: 0, modifiedCount: 0});
        expect(ApplicationModel.updateMany).not.toHaveBeenCalled();
    });

    it('clears nextRevisionId on predecessors pointing at the given id', async () => {
        ApplicationModel.updateMany.mockResolvedValue({matchedCount: 1, modifiedCount: 1});
        const successorId = 'terminal-successor-id';
        const result = await dao.clearNextRevisionIdPointingTo(successorId);

        expect(ApplicationModel.updateMany).toHaveBeenCalledWith(
            {nextRevisionId: successorId},
            {
                $set: expect.objectContaining({
                    nextRevisionId: null,
                    updatedAt: expect.any(Date),
                }),
            }
        );
        expect(result).toEqual({matchedCount: 1, modifiedCount: 1});
    });
});
