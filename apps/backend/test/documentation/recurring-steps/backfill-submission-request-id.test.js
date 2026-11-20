const { backfillSubmissionRequestID } = require('../../../documentation/recurring-steps/backfill-submission-request-id');

const EXPECTED_MISSING_FILTER = {
    $or: [
        { submissionRequestID: { $exists: false } },
        { submissionRequestID: null },
        { submissionRequestID: '' },
    ],
};

/**
 * @param {object} options
 * @param {jest.Mock} [options.distinct]
 * @param {jest.Mock} [options.bulkWrite]
 * @param {jest.Mock} [options.toArray]
 * @returns {import('mongodb').Db}
 */
function createMockDb({ distinct, bulkWrite, toArray } = {}) {
    const mockDistinct = distinct ?? jest.fn();
    const mockBulkWrite = bulkWrite ?? jest.fn();
    const mockToArray = toArray ?? jest.fn().mockResolvedValue([]);
    const mockFind = jest.fn().mockReturnValue({ toArray: mockToArray });

    return {
        collection: (name) => {
            if (name === 'submissions') {
                return { distinct: mockDistinct, bulkWrite: mockBulkWrite };
            }
            if (name === 'approvedStudies') {
                return { find: mockFind };
            }
            throw new Error(`Unexpected collection: ${name}`);
        },
        _mocks: { mockDistinct, mockBulkWrite, mockFind, mockToArray },
    };
}

describe('backfill-submission-request-id', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns success with zero counts when no submissions need backfill', async () => {
        const mockDistinct = jest.fn().mockResolvedValue([]);
        const mockDb = createMockDb({ distinct: mockDistinct });

        const result = await backfillSubmissionRequestID(mockDb);

        expect(result).toEqual({
            success: true,
            message: 'No submissions required backfill',
            matchedCount: 0,
            modifiedCount: 0,
            skippedStudies: 0,
        });
        expect(mockDistinct).toHaveBeenCalledWith('studyID', EXPECTED_MISSING_FILTER);
    });

    it('backfills submissionRequestID from study applicationID via bulkWrite', async () => {
        const studyA = 'study-a';
        const studyB = 'study-b';
        const applicationID = 'app-123';
        const mockDistinct = jest.fn().mockResolvedValue([studyA, studyB]);
        const mockToArray = jest.fn().mockResolvedValue([{ _id: studyA, applicationID }]);
        const mockBulkWrite = jest.fn().mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
        const mockDb = createMockDb({
            distinct: mockDistinct,
            toArray: mockToArray,
            bulkWrite: mockBulkWrite,
        });

        const result = await backfillSubmissionRequestID(mockDb);

        expect(result).toEqual({
            success: true,
            message: 'Set submissionRequestID on 2 submission(s)',
            matchedCount: 2,
            modifiedCount: 2,
            skippedStudies: 1,
        });
        expect(mockToArray).toHaveBeenCalled();
        expect(mockBulkWrite).toHaveBeenCalledWith(
            [
                {
                    updateMany: {
                        filter: { studyID: studyA, ...EXPECTED_MISSING_FILTER },
                        update: { $set: { submissionRequestID: applicationID } },
                    },
                },
            ],
            { ordered: false }
        );
    });

    it('returns success without bulkWrite when no linked studies have applicationID', async () => {
        const mockDistinct = jest.fn().mockResolvedValue(['study-a']);
        const mockToArray = jest.fn().mockResolvedValue([]);
        const mockBulkWrite = jest.fn();
        const mockDb = createMockDb({
            distinct: mockDistinct,
            toArray: mockToArray,
            bulkWrite: mockBulkWrite,
        });

        const result = await backfillSubmissionRequestID(mockDb);

        expect(result).toEqual({
            success: true,
            message: 'No linked studies have an applicationID',
            matchedCount: 0,
            modifiedCount: 0,
            skippedStudies: 1,
        });
        expect(mockBulkWrite).not.toHaveBeenCalled();
    });

    it('returns success: false when distinct fails', async () => {
        const mockDistinct = jest.fn().mockRejectedValue(new Error('distinct failed'));
        const mockDb = createMockDb({ distinct: mockDistinct });

        const result = await backfillSubmissionRequestID(mockDb);

        expect(result).toEqual({ success: false, error: 'distinct failed' });
    });

    it('returns success: false when bulkWrite fails', async () => {
        const mockDistinct = jest.fn().mockResolvedValue(['study-a']);
        const mockToArray = jest.fn().mockResolvedValue([{ _id: 'study-a', applicationID: 'app-1' }]);
        const mockBulkWrite = jest.fn().mockRejectedValue(new Error('bulkWrite failed'));
        const mockDb = createMockDb({
            distinct: mockDistinct,
            toArray: mockToArray,
            bulkWrite: mockBulkWrite,
        });

        const result = await backfillSubmissionRequestID(mockDb);

        expect(result).toEqual({ success: false, error: 'bulkWrite failed' });
    });
});
