const { backfillApplicationSequenceNumber } = require('../../../documentation/3-7-0/backfill-application-sequence-number');

describe('backfill-application-sequence-number', () => {
    let mockCollection;
    let mockDb;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockCollection = {
            updateMany: jest.fn()
        };
        mockDb = {
            collection: jest.fn(() => mockCollection)
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('updates applications missing sequenceNumber', async () => {
        mockCollection.updateMany.mockResolvedValue({ matchedCount: 5, modifiedCount: 5 });

        const result = await backfillApplicationSequenceNumber(mockDb);

        expect(mockDb.collection).toHaveBeenCalledWith('applications');
        expect(mockCollection.updateMany).toHaveBeenCalledWith(
            {
                $or: [
                    { sequenceNumber: { $exists: false } },
                    { sequenceNumber: null }
                ]
            },
            { $set: { sequenceNumber: 1 } }
        );
        expect(result).toEqual({
            success: true,
            message: 'Set sequenceNumber to 1 on 5 document(s)',
            matchedCount: 5,
            modifiedCount: 5
        });
    });

    it('returns success with zero modifications when none match', async () => {
        mockCollection.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

        const result = await backfillApplicationSequenceNumber(mockDb);

        expect(result.success).toBe(true);
        expect(result.modifiedCount).toBe(0);
    });
});
