const { ConfigurationService } = require('../../services/configurationService');

describe('ConfigurationService.getPBACByRoles', () => {
    let service;

    beforeEach(() => {
        service = new ConfigurationService();
        service.configurationDAO = {
            findByType: jest.fn(),
        };
    });

    it('normalizes nested permission and notification ids from Mongoose _id', async () => {
        service.configurationDAO.findByType.mockResolvedValue({
            type: 'PBAC',
            Defaults: [
                {
                    role: 'Admin',
                    permissions: [
                        { _id: 'perm-1', name: 'manage_users', checked: true, disabled: false },
                    ],
                    notifications: [
                        { _id: 'notif-1', name: 'email', checked: true, disabled: false },
                    ],
                },
            ],
        });

        const result = await service.getPBACByRoles(['Admin']);

        expect(result).toHaveLength(1);
        expect(result[0].permissions[0]).toEqual(expect.objectContaining({
            id: 'perm-1',
            _id: 'perm-1',
            name: 'manage_users',
        }));
        expect(result[0].notifications[0]).toEqual(expect.objectContaining({
            id: 'notif-1',
            _id: 'notif-1',
            name: 'email',
        }));
    });

    it('normalizes nested ids when Prisma-style id is present', async () => {
        service.configurationDAO.findByType.mockResolvedValue({
            type: 'PBAC',
            Defaults: [
                {
                    role: 'User',
                    permissions: [
                        { id: 'perm-2', name: 'view', checked: true, disabled: false },
                    ],
                    notifications: [],
                },
            ],
        });

        const result = await service.getPBACByRoles(['User']);

        expect(result[0].permissions[0]).toEqual(expect.objectContaining({
            id: 'perm-2',
            _id: 'perm-2',
        }));
    });

    it('returns null when PBAC config is missing Defaults', async () => {
        service.configurationDAO.findByType.mockResolvedValue({ type: 'PBAC' });

        await expect(service.getPBACByRoles(['Admin'])).resolves.toBeNull();
    });

    it('defaults omitted permissions to an empty array', async () => {
        service.configurationDAO.findByType.mockResolvedValue({
            type: 'PBAC',
            Defaults: [
                {
                    role: 'User',
                    notifications: [
                        { _id: 'notif-1', name: 'email', checked: true, disabled: false },
                    ],
                },
            ],
        });

        const result = await service.getPBACByRoles(['User']);

        expect(result).toHaveLength(1);
        expect(result[0].permissions).toEqual([]);
        expect(result[0].notifications[0]).toEqual(expect.objectContaining({
            id: 'notif-1',
            _id: 'notif-1',
        }));
    });
});
