const {
    findDuplicateIndices,
    dedupeReviewComments
} = require('../../../documentation/3-7-0/dedupe-review-comments');

const makeCursor = (docs) => {
    let index = 0;
    return {
        hasNext: jest.fn(async () => index < docs.length),
        next: jest.fn(async () => docs[index++])
    };
};

describe('dedupe-review-comments', () => {
    let mockCollection;
    let mockDb;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        mockCollection = {
            find: jest.fn(),
            updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
        };
        mockDb = {
            collection: jest.fn(() => mockCollection)
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('findDuplicateIndices', () => {
        it('flags an In Revision event that copied the preceding Inquired comment', () => {
            const history = [
                { status: 'Submitted' },
                { status: 'Inquired', reviewComment: 'Please fix section B' },
                { status: 'In Revision', reviewComment: 'Please fix section B' }
            ];

            expect(findDuplicateIndices(history)).toEqual([2]);
        });

        it('flags a legacy In Progress event that copied the preceding Inquired comment', () => {
            const history = [
                { status: 'Submitted' },
                { status: 'Inquired', reviewComment: 'Please fix section B' },
                { status: 'In Progress', reviewComment: 'Please fix section B' }
            ];

            expect(findDuplicateIndices(history)).toEqual([2]);
        });

        it('preserves a restore reason recorded on a legacy In Progress event', () => {
            const history = [
                { status: 'In Progress' },
                { status: 'Canceled', reviewComment: 'Restore me' },
                { status: 'In Progress', reviewComment: 'Restore me' }
            ];

            expect(findDuplicateIndices(history)).toEqual([]);
        });

        it('ignores whitespace differences when comparing comments', () => {
            const history = [
                { status: 'Inquired', reviewComment: 'Needs work ' },
                { status: 'In Revision', reviewComment: '  Needs work' }
            ];

            expect(findDuplicateIndices(history)).toEqual([1]);
        });

        it('preserves a restore reason recorded after a Canceled event', () => {
            const history = [
                { status: 'In Revision' },
                { status: 'Canceled', reviewComment: 'Restore me' },
                { status: 'In Revision', reviewComment: 'Restore me' }
            ];

            expect(findDuplicateIndices(history)).toEqual([]);
        });

        it('preserves a restore reason recorded after a Deleted event', () => {
            const history = [
                { status: 'In Revision' },
                { status: 'Deleted', reviewComment: 'Inactivity cleanup' },
                { status: 'In Revision', reviewComment: 'Inactivity cleanup' }
            ];

            expect(findDuplicateIndices(history)).toEqual([]);
        });

        it('preserves an In Revision comment that differs from the preceding comment', () => {
            const history = [
                { status: 'Inquired', reviewComment: 'Please fix section B' },
                { status: 'In Revision', reviewComment: 'Something else entirely' }
            ];

            expect(findDuplicateIndices(history)).toEqual([]);
        });

        it('preserves comments on statuses that are not resume targets', () => {
            const history = [
                { status: 'Inquired', reviewComment: 'duplicate' },
                { status: 'Rejected', reviewComment: 'duplicate' }
            ];

            expect(findDuplicateIndices(history)).toEqual([]);
        });

        it('never flags the first history event', () => {
            expect(findDuplicateIndices([{ status: 'In Revision', reviewComment: 'x' }])).toEqual([]);
        });

        it('returns an empty list for missing or malformed history', () => {
            expect(findDuplicateIndices(undefined)).toEqual([]);
            expect(findDuplicateIndices([])).toEqual([]);
            expect(findDuplicateIndices([null, null])).toEqual([]);
        });
    });

    describe('dedupeReviewComments', () => {
        it('unsets only the duplicated comment, guarded by status and comment', async () => {
            mockCollection.find.mockReturnValue(
                makeCursor([
                    {
                        _id: 'app-1',
                        history: [
                            { status: 'Inquired', reviewComment: 'Please fix section B' },
                            { status: 'In Revision', reviewComment: 'Please fix section B' }
                        ]
                    }
                ])
            );

            const result = await dedupeReviewComments(mockDb);

            expect(mockDb.collection).toHaveBeenCalledWith('applications');
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                {
                    _id: 'app-1',
                    'history.1.status': 'In Revision',
                    'history.1.reviewComment': 'Please fix section B'
                },
                { $unset: { 'history.1.reviewComment': '' } }
            );
            expect(result).toEqual(
                expect.objectContaining({
                    success: true,
                    scannedCount: 1,
                    applicationsUpdated: 1,
                    commentsRemoved: 1,
                    dryRun: false
                })
            );
        });

        it('does not write when nothing matches the duplicate signature', async () => {
            mockCollection.find.mockReturnValue(
                makeCursor([
                    {
                        _id: 'app-1',
                        history: [
                            { status: 'Canceled', reviewComment: 'Restore me' },
                            { status: 'In Revision', reviewComment: 'Restore me' }
                        ]
                    }
                ])
            );

            const result = await dedupeReviewComments(mockDb);

            expect(mockCollection.updateOne).not.toHaveBeenCalled();
            expect(result.applicationsUpdated).toBe(0);
            expect(result.commentsRemoved).toBe(0);
        });

        it('does not count a guarded update that matches no document', async () => {
            mockCollection.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
            mockCollection.find.mockReturnValue(
                makeCursor([
                    {
                        _id: 'app-1',
                        history: [
                            { status: 'Inquired', reviewComment: 'dup' },
                            { status: 'In Revision', reviewComment: 'dup' }
                        ]
                    }
                ])
            );

            const result = await dedupeReviewComments(mockDb);

            expect(result).toEqual(expect.objectContaining({
                success: true,
                applicationsUpdated: 0,
                commentsRemoved: 0,
                dryRun: false
            }));
        });

        it('reports without writing in dry run mode', async () => {
            mockCollection.find.mockReturnValue(
                makeCursor([
                    {
                        _id: 'app-1',
                        history: [
                            { status: 'Inquired', reviewComment: 'dup' },
                            { status: 'In Revision', reviewComment: 'dup' }
                        ]
                    }
                ])
            );

            const result = await dedupeReviewComments(mockDb, { dryRun: true });

            expect(mockCollection.updateOne).not.toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                success: true,
                applicationsUpdated: 1,
                commentsRemoved: 1,
                dryRun: true
            }));
        });

        it('returns a failure result when the query throws', async () => {
            mockCollection.find.mockImplementation(() => {
                throw new Error('connection lost');
            });

            const result = await dedupeReviewComments(mockDb);

            expect(result).toEqual({ success: false, error: 'connection lost' });
        });
    });
});
