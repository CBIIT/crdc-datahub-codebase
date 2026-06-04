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
        dao = new ApplicationDAO({});
        dao.updateMany = jest.fn();
        dao.insert = jest.fn();
    });

    it('links source then inserts successor when update matches one document', async () => {
        dao.updateMany.mockResolvedValue({ modifiedCount: 1 });
        dao.insert.mockResolvedValue({ acknowledged: true });

        const result = await dao.reopenApprovedRevision(sourceId, newApp);

        expect(dao.updateMany).toHaveBeenCalledWith(
            {
                _id: sourceId,
                status: APPROVED,
                $or: [
                    { nextRevisionId: null },
                    { nextRevisionId: { $exists: false } },
                ],
            },
            expect.objectContaining({
                nextRevisionId: newApp._id,
                updatedAt: newApp.updatedAt,
            })
        );
        expect(dao.insert).toHaveBeenCalledWith(newApp);
        expect(result).toEqual(expect.objectContaining({ _id: newApp._id, status: 'Reopened' }));
    });

    it('throws INVALID_STATE when source update matches zero documents', async () => {
        dao.updateMany.mockResolvedValue({ modifiedCount: 0 });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);

        expect(dao.insert).not.toHaveBeenCalled();
    });

    it('compensates source link when insert fails', async () => {
        dao.updateMany
            .mockResolvedValueOnce({ modifiedCount: 1 })
            .mockResolvedValueOnce({ modifiedCount: 1 });
        dao.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp)).rejects.toThrow('insert failed');

        expect(dao.updateMany).toHaveBeenCalledTimes(2);
        expect(dao.updateMany).toHaveBeenLastCalledWith(
            { _id: sourceId },
            expect.objectContaining({ nextRevisionId: null })
        );
    });

    it('throws UPDATE_FAILED when insert is not acknowledged', async () => {
        dao.updateMany.mockResolvedValue({ modifiedCount: 1 });
        dao.insert.mockResolvedValue({ acknowledged: false });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.UPDATE_FAILED);
    });
});
