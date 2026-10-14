const mockCreateDatabaseConnection = jest.fn();
const mockCloseDatabaseConnection = jest.fn();
const mockCreateDataSyncCollection = jest.fn();
const mockExecuteEnsureIndexes = jest.fn();
const mockExecuteSyncPbacDefaults = jest.fn();

jest.mock('../../../documentation/recurring-steps/migration-utils', () => ({
    createDatabaseConnection: (...args) => mockCreateDatabaseConnection(...args),
    closeDatabaseConnection: (...args) => mockCloseDatabaseConnection(...args),
}));

jest.mock('../../../documentation/3-7-1/create-data-sync-collection', () => ({
    createDataSyncCollection: (...args) => mockCreateDataSyncCollection(...args),
}));

jest.mock('../../../documentation/3-7-0/ensure-indexes-migration', () => ({
    executeEnsureIndexes: (...args) => mockExecuteEnsureIndexes(...args),
}));

jest.mock('../../../documentation/3-7-0/sync-pbac-defaults-migration', () => ({
    executeSyncPbacDefaults: (...args) => mockExecuteSyncPbacDefaults(...args),
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
        name: 'Ensure DocumentDB indexes (recurring)',
        file: 'ensure-indexes-migration.js',
    },
    {
        name: 'Sync PBAC defaults from JSON (recurring)',
        file: 'sync-pbac-defaults-migration.js',
    },
];

/**
 * Default mocks: DB connects, all three steps succeed, connection closes cleanly.
 * @param {object} db
 * @param {object} client
 */
function setupHappyPathMocks(db, client) {
    mockCreateDatabaseConnection.mockResolvedValue({ client, db });
    mockCloseDatabaseConnection.mockResolvedValue(undefined);
    mockCreateDataSyncCollection.mockResolvedValue({ success: true, created: true });
    mockExecuteEnsureIndexes.mockResolvedValue({ success: true, created: 0, skipped: 0 });
    mockExecuteSyncPbacDefaults.mockResolvedValue({ success: true });
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
        /*
         * Ensures the orchestrator wires createDatabaseConnection to every registered
         * step and passes the same db handle from the connection result.
         */
        it('invokes all three registered steps once with the DB from createDatabaseConnection', async () => {
            await orchestrateMigration();

            expect(mockCreateDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(mockCreateDataSyncCollection).toHaveBeenCalledTimes(1);
            expect(mockCreateDataSyncCollection).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledTimes(1);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledWith(mockDb);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledTimes(1);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledWith(mockDb);
        });

        /*
         * Ensures one-time collection creation runs before recurring index and PBAC
         * steps, matching the orchestrator registration order.
         */
        it('runs create dataSync before ensure-indexes before sync PBAC', async () => {
            await orchestrateMigration();

            const createOrder = mockCreateDataSyncCollection.mock.invocationCallOrder[0];
            const ensureOrder = mockExecuteEnsureIndexes.mock.invocationCallOrder[0];
            const syncOrder = mockExecuteSyncPbacDefaults.mock.invocationCallOrder[0];
            expect(createOrder).toBeLessThan(ensureOrder);
            expect(ensureOrder).toBeLessThan(syncOrder);
        });

        /*
         * Ensures the Mongo client from createDatabaseConnection is closed in finally
         * after migrations finish successfully.
         */
        it('closes the Mongo client in finally after a successful run', async () => {
            await orchestrateMigration();

            expect(mockCloseDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
        });
    });

    describe('overall status', () => {
        /*
         * When every step returns success: true, the orchestrator aggregates a fully
         * successful run with counts, duration, and per-step results metadata.
         */
        it('reports full success when every step returns success: true', async () => {
            const result = await orchestrateMigration();

            expect(result.success).toBe(true);
            expect(result.migrationsExecuted).toBe(3);
            expect(result.migrationsSuccessful).toBe(3);
            expect(typeof result.duration).toBe('number');
            expect(result.results).toHaveLength(3);
            result.results.forEach((entry, index) => {
                expect(entry.success).toBe(true);
                expect(entry.name).toBe(EXPECTED_MIGRATIONS[index].name);
                expect(entry.file).toBe(EXPECTED_MIGRATIONS[index].file);
            });
        });

        /*
         * When a step resolves with success: false (no throw), overall success is false
         * but remaining steps still run; each failing step is reflected in results.
         */
        it.each([
            ['createDataSyncCollection', () => mockCreateDataSyncCollection, 0],
            ['executeEnsureIndexes', () => mockExecuteEnsureIndexes, 1],
            ['executeSyncPbacDefaults', () => mockExecuteSyncPbacDefaults, 2],
        ])(
            'reports overall failure when %s returns success: false without throwing',
            async (_label, getMock, failedIndex) => {
                const stepError = { success: false, error: 'step failed' };
                getMock().mockResolvedValue(stepError);

                const result = await orchestrateMigration();

                expect(result.success).toBe(false);
                expect(result.migrationsSuccessful).toBe(2);
                expect(result.migrationsExecuted).toBe(3);
                expect(result.results[failedIndex].success).toBe(false);
                expect(result.results[failedIndex].result).toEqual(stepError);
                expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
            }
        );

        /*
         * When a step throws, the orchestrator records the error, continues later steps,
         * and reports partial success with overall success: false.
         */
        it('reports overall failure when a step throws but continues remaining steps', async () => {
            mockExecuteEnsureIndexes.mockRejectedValue(new Error('indexes threw'));

            const result = await orchestrateMigration();

            expect(mockCreateDataSyncCollection).toHaveBeenCalledTimes(1);
            expect(mockExecuteEnsureIndexes).toHaveBeenCalledTimes(1);
            expect(mockExecuteSyncPbacDefaults).toHaveBeenCalledTimes(1);
            expect(result.success).toBe(false);
            expect(result.migrationsSuccessful).toBe(2);
            expect(result.results[1].success).toBe(false);
            expect(result.results[1].error).toBe('indexes threw');
            expect(mockCloseDatabaseConnection).toHaveBeenCalledWith(mockClient);
        });

        /*
         * When createDatabaseConnection fails, no migration steps run and the top-level
         * catch returns only success: false and an error message (no results array).
         */
        it('reports orchestration failure when createDatabaseConnection throws', async () => {
            mockCreateDatabaseConnection.mockRejectedValue(new Error('connect failed'));

            const result = await orchestrateMigration();

            expect(result).toEqual({ success: false, error: 'connect failed' });
            expect(mockCreateDataSyncCollection).not.toHaveBeenCalled();
            expect(mockExecuteEnsureIndexes).not.toHaveBeenCalled();
            expect(mockExecuteSyncPbacDefaults).not.toHaveBeenCalled();
            expect(mockCloseDatabaseConnection).not.toHaveBeenCalled();
        });
    });
});
