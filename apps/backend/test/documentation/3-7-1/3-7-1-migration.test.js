const mockCreateDatabaseConnection = jest.fn();
const mockCloseDatabaseConnection = jest.fn();
const mockCreateDataSyncCollection = jest.fn();
const mockExecuteBackfillSubmissionDataSyncStatus = jest.fn();
const mockExecuteEnsureIndexes = jest.fn();
const mockExecuteSyncPbacDefaults = jest.fn();
const mockExecuteBackfillSubmissionRequestID = jest.fn();

jest.mock('../../../documentation/recurring-steps/migration-utils', () => ({
    createDatabaseConnection: (...args) => mockCreateDatabaseConnection(...args),
    closeDatabaseConnection: (...args) => mockCloseDatabaseConnection(...args),
}));

jest.mock('../../../documentation/3-7-1/create-data-sync-collection', () => ({
    createDataSyncCollection: (...args) => mockCreateDataSyncCollection(...args),
}));

jest.mock('../../../documentation/3-7-1/backfill-submission-data-sync-status', () => ({
    executeBackfillSubmissionDataSyncStatus: (...args) => mockExecuteBackfillSubmissionDataSyncStatus(...args),
}));

jest.mock('../../../documentation/3-7-1/ensure-indexes-migration', () => ({
    executeEnsureIndexes: (...args) => mockExecuteEnsureIndexes(...args),
}));

jest.mock('../../../documentation/3-7-1/sync-pbac-defaults-migration', () => ({
    executeSyncPbacDefaults: (...args) => mockExecuteSyncPbacDefaults(...args),
}));

jest.mock('../../../documentation/3-7-1/backfill-submission-submission-request-id', () => ({
    executeBackfillSubmissionRequestID: (...args) => mockExecuteBackfillSubmissionRequestID(...args),
}));

const { orchestrateMigration } = require('../../../documentation/3-7-1/3-7-1-migration');

const mockClient = { id: 'client' };
const mockDb = { id: 'db' };

/** Matches the orchestrator's registered migration metadata for result assertions. */
const EXPECTED_MIGRATIONS = [
    {
        name: 'Create dataSync collection',
        file: 'create-data-sync-collection.js',
    },
    {
        name: 'Backfill Submission DataSync status fields (one-time)',
        file: 'backfill-submission-data-sync-status.js',
    },
    {
        name: 'Ensure DocumentDB indexes (recurring)',
        file: 'ensure-indexes-migration.js',
    },
    {
        name: 'Sync PBAC defaults from JSON (recurring)',
        file: 'sync-pbac-defaults-migration.js',
    },
    {
        name: 'Backfill Submission.submissionRequestID (recurring)',
        file: 'backfill-submission-submission-request-id.js',
    },
];

/**
 * Default mocks: DB connects, all steps succeed, connection closes cleanly.
 * @param {object} db
 * @param {object} client
 */
function setupHappyPathMocks(db, client) {
    mockCreateDatabaseConnection.mockResolvedValue({ client, db });
    mockCloseDatabaseConnection.mockResolvedValue(undefined);
    mockCreateDataSyncCollection.mockResolvedValue({ success: true, created: true });
    mockExecuteBackfillSubmissionDataSyncStatus.mockResolvedValue({ success: true, modifiedCount: 0 });
    mockExecuteEnsureIndexes.mockResolvedValue({ success: true, created: 0, skipped: 0 });
    mockExecuteSyncPbacDefaults.mockResolvedValue({ success: true });
    mockExecuteBackfillSubmissionRequestID.mockResolvedValue({ success: true, modifiedCount: 0 });
}

describe('3-7-1-migration orchestrateMigration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        setupHappyPathMocks(mockDb, mockClient);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('migration invocation', () => {
        it('invokes all five registered steps once with the DB from createDatabaseConnection', async () => {
            await orchestrateMigration();

            expect(mockCreateDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(mockCreateDataSyncCollection).toHaveBeenCalledTimes(1);
            expect(mockCreateDataSyncCollection).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteBackfillSubmissionDataSyncStatus).toHaveBeenCalledTimes(1);
            expect(mockExecuteBackfillSubmissionDataSyncStatus).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledTimes(1);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledTimes(1);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteBackfillSubmissionRequestID).toHaveBeenCalledTimes(1);
            expect(mockExecuteBackfillSubmissionRequestID).toHaveBeenCalledWith(mockDb);
        });

        it('runs create dataSync before DataSync status backfill before recurring steps', async () => {
            await orchestrateMigration();

            const createOrder = mockCreateDataSyncCollection.mock.invocationCallOrder[0];
            const dataSyncStatusOrder = mockExecuteBackfillSubmissionDataSyncStatus.mock.invocationCallOrder[0];
            const ensureOrder = mockExecuteEnsureIndexes.mock.invocationCallOrder[0];
            const syncOrder = mockExecuteSyncPbacDefaults.mock.invocationCallOrder[0];
            const backfillOrder = mockExecuteBackfillSubmissionRequestID.mock.invocationCallOrder[0];
            expect(createOrder).toBeLessThan(dataSyncStatusOrder);
            expect(dataSyncStatusOrder).toBeLessThan(ensureOrder);
            expect(ensureOrder).toBeLessThan(syncOrder);
            expect(syncOrder).toBeLessThan(backfillOrder);
        });

        it('closes the Mongo client in finally after a successful run', async () => {
            await orchestrateMigration();

            expect(mockCloseDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
        });
    });

    describe('overall status', () => {
        it('reports full success when every step returns success: true', async () => {
            const result = await orchestrateMigration();

            expect(result.success).toBe(true);
            expect(result.migrationsExecuted).toBe(5);
            expect(result.migrationsSuccessful).toBe(5);
            expect(typeof result.duration).toBe('number');
            expect(result.results).toHaveLength(5);
            result.results.forEach((entry, index) => {
                expect(entry.success).toBe(true);
                expect(entry.name).toBe(EXPECTED_MIGRATIONS[index].name);
                expect(entry.file).toBe(EXPECTED_MIGRATIONS[index].file);
            });
        });

        it.each([
            ['createDataSyncCollection', () => mockCreateDataSyncCollection, 0],
            ['executeBackfillSubmissionDataSyncStatus', () => mockExecuteBackfillSubmissionDataSyncStatus, 1],
            ['executeEnsureIndexes', () => mockExecuteEnsureIndexes, 2],
            ['executeSyncPbacDefaults', () => mockExecuteSyncPbacDefaults, 3],
            ['executeBackfillSubmissionRequestID', () => mockExecuteBackfillSubmissionRequestID, 4],
        ])(
            'reports overall failure when %s returns success: false without throwing',
            async (_label, getMock, failedIndex) => {
                const stepError = { success: false, error: 'step failed' };
                getMock().mockResolvedValue(stepError);

                const result = await orchestrateMigration();

                expect(result.success).toBe(false);
                expect(result.migrationsSuccessful).toBe(4);
                expect(result.migrationsExecuted).toBe(5);
                expect(result.results[failedIndex].success).toBe(false);
                expect(result.results[failedIndex].result).toEqual(stepError);
                expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
            }
        );

        it('reports overall failure when a step throws but continues remaining steps', async () => {
            mockExecuteEnsureIndexes.mockRejectedValue(new Error('indexes threw'));

            const result = await orchestrateMigration();

            expect(mockCreateDataSyncCollection).toHaveBeenCalledTimes(1);
            expect(mockExecuteBackfillSubmissionDataSyncStatus).toHaveBeenCalledTimes(1);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledTimes(1);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledTimes(1);
            expect(mockExecuteBackfillSubmissionRequestID).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(false);
            expect(result.migrationsSuccessful).toBe(4);
            expect(result.results[2].success).toBe(false);
            expect(result.results[2].error).toBe('indexes threw');
            expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
        });

        it('reports orchestration failure when createDatabaseConnection throws', async () => {
            mockCreateDatabaseConnection.mockRejectedValue(new Error('connect failed'));

            const result = await orchestrateMigration();

            expect(result).toEqual({ success: false, error: 'connect failed' });
            expect(mockCreateDataSyncCollection).not.toHaveBeenCalled();
            expect(mockExecuteBackfillSubmissionDataSyncStatus).not.toHaveBeenCalled();
            expect(mockExecuteEnsureIndexes).not.toHaveBeenCalled();
            expect(mockExecuteSyncPbacDefaults).not.toHaveBeenCalled();
            expect(mockExecuteBackfillSubmissionRequestID).not.toHaveBeenCalled();
            expect(mockCloseDatabaseConnection).not.toHaveBeenCalled();
        });
    });
});
