jest.mock('../../prisma', () => ({
    application: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
}));

const prisma = require('../../prisma');
const ApplicationDAO = require('../../dao/application');
const { APPROVED } = require('../../constants/application-constants');
const ERROR = require('../../constants/error-constants');

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
        dao = new ApplicationDAO({});
        dao.insert = jest.fn();
    });

    it('links source then inserts successor when update matches one document', async () => {
        prisma.application.updateMany.mockResolvedValue({ count: 1 });
        dao.insert.mockResolvedValue({ acknowledged: true });

        const result = await dao.reopenApprovedRevision(sourceId, newApp);

        expect(prisma.application.updateMany).toHaveBeenCalledWith({
            where: { id: sourceId, status: APPROVED, nextRevisionId: null },
            data: expect.objectContaining({
                nextRevisionId: newApp._id,
                updatedAt: newApp.updatedAt,
            }),
        });
        expect(dao.insert).toHaveBeenCalledWith(newApp);
        expect(result).toEqual(expect.objectContaining({ _id: newApp._id, status: 'Reopened' }));
    });

    it('replaces an existing nextRevisionId link when replaceExistingLink is true', async () => {
        prisma.application.findFirst.mockResolvedValue({ nextRevisionId: 'prior-successor-id' });
        prisma.application.updateMany.mockResolvedValue({ count: 1 });
        dao.insert.mockResolvedValue({ acknowledged: true });

        await dao.reopenApprovedRevision(sourceId, newApp, true);

        expect(prisma.application.findFirst).toHaveBeenCalledWith({
            where: { id: sourceId },
            select: { nextRevisionId: true },
        });
        expect(prisma.application.updateMany).toHaveBeenCalledWith({
            where: { id: sourceId, status: APPROVED },
            data: expect.objectContaining({
                nextRevisionId: newApp._id,
                updatedAt: newApp.updatedAt,
            }),
        });
    });

    it('throws INVALID_STATE when source update matches zero documents', async () => {
        prisma.application.updateMany.mockResolvedValue({ count: 0 });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);

        expect(dao.insert).not.toHaveBeenCalled();
    });

    it('compensates source link when insert fails', async () => {
        prisma.application.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp)).rejects.toThrow('insert failed');

        expect(prisma.application.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.application.updateMany).toHaveBeenLastCalledWith({
            where: { id: sourceId },
            data: expect.objectContaining({ nextRevisionId: null }),
        });
    });

    it('restores the prior nextRevisionId when replaceExistingLink insert fails', async () => {
        prisma.application.findFirst.mockResolvedValue({ nextRevisionId: 'prior-successor-id' });
        prisma.application.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 });
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp, true)).rejects.toThrow('insert failed');

        expect(prisma.application.updateMany).toHaveBeenLastCalledWith({
            where: { id: sourceId },
            data: expect.objectContaining({ nextRevisionId: 'prior-successor-id' }),
        });
    });

    it('throws UPDATE_FAILED when insert is not acknowledged', async () => {
        prisma.application.updateMany.mockResolvedValue({ count: 1 });
        dao.insert.mockResolvedValue({ acknowledged: false });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.UPDATE_FAILED);
    });
});
