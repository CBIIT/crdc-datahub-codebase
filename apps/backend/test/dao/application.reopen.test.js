const ApplicationDAO = require('../../dao/application');
const { APPROVED } = require('../../constants/application-constants');
const ERROR = require('../../constants/error-constants');

describe('ApplicationDAO.reopenApprovedRevision', () => {
    let dao;
    let mockCollection;

    const sourceId = 'approved-source-id';
    const newApp = {
        _id: 'new-revision-id',
        status: 'Reopened',
        sequenceNumber: 2,
        updatedAt: new Date('2026-05-18T12:00:00Z'),
        studyName: 'Study',
    };

    beforeEach(() => {
        mockCollection = {
            updateOne: jest.fn(),
            insert: jest.fn(),
        };
        dao = new ApplicationDAO(mockCollection);
    });

    it('links source then inserts successor when update matches one document', async () => {
        mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
        mockCollection.insert.mockResolvedValue({ acknowledged: true });

        const result = await dao.reopenApprovedRevision(sourceId, newApp);

        expect(mockCollection.updateOne).toHaveBeenCalledWith(
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
        expect(mockCollection.insert).toHaveBeenCalledWith(newApp);
        expect(result).toEqual(expect.objectContaining({ _id: newApp._id, status: 'Reopened' }));
    });

    it('throws INVALID_STATE when source update matches zero documents', async () => {
        mockCollection.updateOne.mockResolvedValue({ modifiedCount: 0 });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.VERIFY.INVALID_STATE_APPLICATION);

        expect(mockCollection.insert).not.toHaveBeenCalled();
    });

    it('compensates source link when insert fails', async () => {
        mockCollection.updateOne
            .mockResolvedValueOnce({ modifiedCount: 1 })
            .mockResolvedValueOnce({ modifiedCount: 1 });
        mockCollection.insert.mockRejectedValue(new Error('insert failed'));

        await expect(dao.reopenApprovedRevision(sourceId, newApp)).rejects.toThrow('insert failed');

        expect(mockCollection.updateOne).toHaveBeenCalledTimes(2);
        expect(mockCollection.updateOne).toHaveBeenLastCalledWith(
            { _id: sourceId },
            {},
            { $unset: { nextRevisionId: '' } }
        );
    });

    it('throws UPDATE_FAILED when insert is not acknowledged', async () => {
        mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
        mockCollection.insert.mockResolvedValue({ acknowledged: false });

        await expect(dao.reopenApprovedRevision(sourceId, newApp))
            .rejects.toThrow(ERROR.UPDATE_FAILED);
    });
});
