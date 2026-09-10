jest.mock('../../../config', () => ({
    document_db_connection_string: 'mongodb://user:pass@docdb.example.com:27017/crdc-datahub?tls=true&tlsCAFile=/ca.pem&authSource=admin&retryWrites=false',
}));

jest.mock('../../../crdc-datahub-database-drivers/database-constants', () => ({
    DATABASE_NAME: 'crdc-datahub',
}));

jest.mock('mongodb', () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const db = jest.fn().mockReturnValue({ name: 'crdc-datahub' });
    const close = jest.fn().mockResolvedValue(undefined);
    const MongoClient = jest.fn().mockImplementation(() => ({ connect, db, close }));
    return { MongoClient, __mocks: { connect, db, close } };
});

const mongodb = require('mongodb');
const { MongoClient } = mongodb;
const config = require('../../../config');
const { createDatabaseConnection, closeDatabaseConnection } = require('../../../documentation/recurring-steps/migration-utils');

describe('migration-utils createDatabaseConnection', () => {
    beforeEach(() => {
        MongoClient.mockClear();
        mongodb.__mocks.connect.mockClear();
        mongodb.__mocks.db.mockClear();
        mongodb.__mocks.close.mockClear();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('connects with the shared DocumentDB TLS URI from config', async () => {
        const result = await createDatabaseConnection();

        expect(MongoClient).toHaveBeenCalledWith(config.document_db_connection_string);
        expect(mongodb.__mocks.connect).toHaveBeenCalledTimes(1);
        expect(mongodb.__mocks.db).toHaveBeenCalledWith('crdc-datahub');
        expect(result.dbName).toBe('crdc-datahub');
    });

    test('propagates the error when the connection fails', async () => {
        const connectionError = new Error('connection refused');
        mongodb.__mocks.connect.mockRejectedValueOnce(connectionError);

        await expect(createDatabaseConnection()).rejects.toThrow(connectionError);
        expect(mongodb.__mocks.db).not.toHaveBeenCalled();
    });

    test('closeDatabaseConnection closes the client', async () => {
        const { client } = await createDatabaseConnection();
        await closeDatabaseConnection(client);
        expect(mongodb.__mocks.close).toHaveBeenCalledTimes(1);
    });

    test('closeDatabaseConnection logs and resolves when closing fails', async () => {
        const { client } = await createDatabaseConnection();
        mongodb.__mocks.close.mockRejectedValueOnce(new Error('close failed'));

        await expect(closeDatabaseConnection(client)).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith('❌ Error closing database connection:', 'close failed');
    });
});
