const {
    mergeItemsById,
    mergeRoleDefaults,
    loadPbacDefaultsFromJson
} = require('../../../documentation/recurring-steps/sync-pbac-defaults');
const { syncPbacDefaults } = require('../../../documentation/recurring-steps/sync-pbac-defaults');

describe('sync-pbac-defaults', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('mergeItemsById', () => {
        it('adds only missing permission entries', () => {
            const target = [{ _id: 'submission_request:view:all', name: 'View' }];
            const source = [
                { _id: 'submission_request:view:all', name: 'View' },
                { _id: 'submission_request:reopen:all', name: 'Reopen' }
            ];
            const { merged, addedCount } = mergeItemsById(target, source);
            expect(merged).toHaveLength(2);
            expect(addedCount).toBe(1);
            expect(merged[1]._id).toBe('submission_request:reopen:all');
        });
    });

    describe('mergeRoleDefaults', () => {
        it('merges new permissions into existing role', () => {
            const mongoDefaults = [{
                role: 'Admin',
                permissions: [{ _id: 'submission_request:view:all' }],
                notifications: []
            }];
            const jsonDefaults = [{
                role: 'Admin',
                permissions: [
                    { _id: 'submission_request:view:all' },
                    { _id: 'submission_request:reopen:all' }
                ],
                notifications: []
            }];
            const { defaults, itemsAdded } = mergeRoleDefaults(mongoDefaults, jsonDefaults);
            expect(defaults[0].permissions).toHaveLength(2);
            expect(itemsAdded).toBe(1);
        });
    });

    describe('loadPbacDefaultsFromJson', () => {
        it('loads PBAC config with reopen permission for privileged roles', () => {
            const config = loadPbacDefaultsFromJson();
            expect(config.type).toBe('PBAC');
            const admin = config.Defaults.find((d) => d.role === 'Admin');
            expect(admin.permissions.some((p) => p._id === 'submission_request:reopen:all')).toBe(true);
        });
    });

    describe('syncPbacDefaults', () => {
        let mockCollection;
        let mockDb;

        beforeEach(() => {
            mockCollection = {
                findOne: jest.fn(),
                insertOne: jest.fn(),
                updateOne: jest.fn()
            };
            mockDb = { collection: jest.fn(() => mockCollection) };
        });

        it('inserts PBAC document when missing', async () => {
            mockCollection.findOne.mockResolvedValue(null);
            mockCollection.insertOne.mockResolvedValue({ acknowledged: true });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.inserted).toBe(true);
            expect(mockCollection.insertOne).toHaveBeenCalled();
        });

        it('merges missing permissions when document exists', async () => {
            const jsonConfig = loadPbacDefaultsFromJson();
            mockCollection.findOne.mockResolvedValue({
                _id: jsonConfig._id,
                type: 'PBAC',
                version: jsonConfig.version,
                Defaults: [{
                    role: 'Admin',
                    permissions: [{ _id: 'submission_request:view:all' }],
                    notifications: []
                }]
            });
            mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

            const result = await syncPbacDefaults(mockDb);

            expect(result.success).toBe(true);
            expect(result.itemsAdded).toBeGreaterThan(0);
            expect(mockCollection.updateOne).toHaveBeenCalled();
        });
    });
});
