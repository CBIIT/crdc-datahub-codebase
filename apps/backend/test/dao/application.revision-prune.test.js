jest.mock('../../prisma', () => ({
    application: {
        updateMany: jest.fn(),
    },
}));

const prisma = require('../../prisma');
const ApplicationDAO = require('../../dao/application');

describe('ApplicationDAO.clearNextRevisionIdPointingTo', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        dao = new ApplicationDAO({});
    });

    it('returns zero counts when applicationId is falsy', async () => {
        const result = await dao.clearNextRevisionIdPointingTo(null);

        expect(result).toEqual({ matchedCount: 0, modifiedCount: 0 });
        expect(prisma.application.updateMany).not.toHaveBeenCalled();
    });

    it('clears nextRevisionId on predecessors pointing at the given id', async () => {
        prisma.application.updateMany.mockResolvedValue({ count: 1 });
        const successorId = 'terminal-successor-id';
        const result = await dao.clearNextRevisionIdPointingTo(successorId);

        expect(prisma.application.updateMany).toHaveBeenCalledWith({
            where: { nextRevisionId: successorId },
            data: expect.objectContaining({
                nextRevisionId: null,
                updatedAt: expect.any(Date),
            }),
        });
        expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 });
    });
});
