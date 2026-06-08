const ApplicationDAO = require('../../dao/application');

describe('ApplicationDAO.clearNextRevisionIdPointingTo', () => {
    let dao;

    beforeEach(() => {
        dao = new ApplicationDAO({});
        dao.updateMany = jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    });

    it('returns zero counts when applicationId is falsy', async () => {
        const result = await dao.clearNextRevisionIdPointingTo(null);

        expect(result).toEqual({ matchedCount: 0, modifiedCount: 0 });
        expect(dao.updateMany).not.toHaveBeenCalled();
    });

    it('clears nextRevisionId on predecessors pointing at the given id', async () => {
        const successorId = 'terminal-successor-id';
        const result = await dao.clearNextRevisionIdPointingTo(successorId);

        expect(dao.updateMany).toHaveBeenCalledWith(
            { nextRevisionId: successorId },
            expect.objectContaining({
                nextRevisionId: null,
                updatedAt: expect.any(Date),
            })
        );
        expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 });
    });
});
