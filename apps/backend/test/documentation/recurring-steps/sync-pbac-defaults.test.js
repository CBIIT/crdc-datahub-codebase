const fs = require('fs');
const {
    loadPbacDefaultsFromJson,
    shouldOverwriteVersion,
    syncPbacDefaults
} = require('../../../documentation/recurring-steps/sync-pbac-defaults');

describe('sync-pbac-defaults', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('shouldOverwriteVersion', () => {
        it('returns true when Mongo version is lower than JSON', () => {
            expect(shouldOverwriteVersion('2.2.0', '2.3.0')).toBe(true);
        });

        it('returns false when versions are equal', () => {
            expect(shouldOverwriteVersion('2.3.0', '2.3.0')).toBe(false);
        });

        it('returns false when Mongo version is higher', () => {
            expect(shouldOverwriteVersion('2.4.0', '2.3.0')).toBe(false);
        });

        it('returns true when Mongo version is invalid or missing', () => {
            expect(shouldOverwriteVersion(undefined, '2.3.0')).toBe(true);
            expect(shouldOverwriteVersion('not-a-version', '2.3.0')).toBe(true);
        });

        it('throws when JSON version is invalid', () => {
            expect(() => shouldOverwriteVersion('2.3.0', 'not-a-version')).toThrow(
                'Invalid PBAC JSON version: not-a-version'
            );
            expect(() => shouldOverwriteVersion('2.3.0', undefined)).toThrow(
                'Invalid PBAC JSON version: undefined'
            );
        });
    });

    describe('loadPbacDefaultsFromJson', () => {
        it('loads PBAC config with reopen permission for privileged roles', () => {
            const config = loadPbacDefaultsFromJson();
            expect(config.type).toBe('PBAC');
            const admin = config.Defaults.find((d) => d.role === 'Admin');
            expect(admin.permissions.some((p) => p._id === 'submission_request:reopen:all')).toBe(true);
        });

        it('loads PBAC config with reopen:own for Submitter and User roles', () => {
            const config = loadPbacDefaultsFromJson();
            const submitter = config.Defaults.find((d) => d.role === 'Submitter');
            const user = config.Defaults.find((d) => d.role === 'User');
            expect(submitter.permissions.some((p) => p._id === 'submission_request:reopen:own')).toBe(true);
            expect(user.permissions.some((p) => p._id === 'submission_request:reopen:own')).toBe(true);
        });
    });

    describe('syncPbacDefaults', () => {
        let mockCollection;
        let mockDb;

        beforeEach(() => {
            mockCollection = {
                findOne: jest.fn(),
                insertOne: jest.fn(),
                replaceOne: jest.fn()
            };
            mockDb = { collection: jest.fn(() => mockCollection) };
        });

        it('inserts PBAC document when missing', async () => {
            const jsonConfig = loadPbacDefaultsFromJson();
            mockCollection.findOne.mockResolvedValue(null);
            mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.inserted).toBe(true);
            expect(mockCollection.findOne).toHaveBeenCalledWith({ type: 'PBAC' });
            expect(mockCollection.insertOne).toHaveBeenCalledWith({
                _id: jsonConfig._id,
                type: jsonConfig.type,
                version: jsonConfig.version,
                Defaults: jsonConfig.Defaults
            });
            expect(mockCollection.replaceOne).not.toHaveBeenCalled();
        });

        it('overwrites when existing version is lower than JSON', async () => {
            const jsonConfig = loadPbacDefaultsFromJson();
            mockCollection.findOne.mockResolvedValue({
                _id: jsonConfig._id,
                type: 'PBAC',
                version: '0.0.0',
                Defaults: [{ role: 'Admin', permissions: [], notifications: [] }]
            });
            mockCollection.replaceOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.overwritten).toBe(true);
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
            expect(mockCollection.replaceOne).toHaveBeenCalledWith(
                { _id: jsonConfig._id },
                {
                    _id: jsonConfig._id,
                    type: jsonConfig.type,
                    version: jsonConfig.version,
                    Defaults: jsonConfig.Defaults
                }
            );
        });

        it('skips when versions are equal', async () => {
            const jsonConfig = loadPbacDefaultsFromJson();
            mockCollection.findOne.mockResolvedValue({
                _id: jsonConfig._id,
                type: 'PBAC',
                version: jsonConfig.version,
                Defaults: jsonConfig.Defaults
            });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
            expect(mockCollection.replaceOne).not.toHaveBeenCalled();
        });

        it('skips when existing version is higher', async () => {
            const jsonConfig = loadPbacDefaultsFromJson();
            mockCollection.findOne.mockResolvedValue({
                _id: jsonConfig._id,
                type: 'PBAC',
                version: '99.0.0',
                Defaults: jsonConfig.Defaults
            });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
            expect(mockCollection.replaceOne).not.toHaveBeenCalled();
        });

        it('returns failure when JSON load throws', async () => {
            jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
                throw new Error('ENOENT: no such file');
            });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(false);
            expect(result.error).toBe('ENOENT: no such file');
            expect(mockCollection.findOne).not.toHaveBeenCalled();
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
            expect(mockCollection.replaceOne).not.toHaveBeenCalled();
        });

        it('returns failure when JSON version is invalid', async () => {
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                _id: 'test-id',
                type: 'PBAC',
                version: 'not-a-version',
                Defaults: []
            }));

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid PBAC JSON version: not-a-version');
            expect(mockCollection.findOne).not.toHaveBeenCalled();
            expect(mockCollection.insertOne).not.toHaveBeenCalled();
            expect(mockCollection.replaceOne).not.toHaveBeenCalled();
        });
    });
});
