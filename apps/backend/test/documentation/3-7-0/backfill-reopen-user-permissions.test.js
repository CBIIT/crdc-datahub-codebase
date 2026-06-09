const { backfillReopenUserPermissions } = require('../../../documentation/3-7-0/backfill-reopen-user-permissions');

describe('backfill-reopen-user-permissions', () => {
    let mockUsersCollection;
    let mockDb;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        mockUsersCollection = {
            updateMany: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
        };
        mockDb = {
            collection: jest.fn(() => mockUsersCollection),
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('adds reopen permissions per role on active users', async () => {
        const result = await backfillReopenUserPermissions(mockDb);

        expect(result.success).toBe(true);
        expect(mockDb.collection).toHaveBeenCalledWith('users');
        expect(mockUsersCollection.updateMany).toHaveBeenCalledTimes(5);
        expect(mockUsersCollection.updateMany).toHaveBeenCalledWith(
            {
                role: 'Submitter',
                userStatus: 'Active',
                permissions: { $ne: 'submission_request:reopen:own' },
            },
            { $addToSet: { permissions: 'submission_request:reopen:own' } }
        );
        expect(mockUsersCollection.updateMany).toHaveBeenCalledWith(
            {
                role: 'Admin',
                userStatus: 'Active',
                permissions: { $ne: 'submission_request:reopen:all' },
            },
            { $addToSet: { permissions: 'submission_request:reopen:all' } }
        );
    });
});
