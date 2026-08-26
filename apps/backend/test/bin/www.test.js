describe('bin/www.js startup', () => {
    let mockOrchestrateMigration;
    let mockCreateServer;
    let mockServer;

    const originalEnv = process.env;

    const flushPromises = () => new Promise(resolve => setImmediate(resolve));

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        process.env = { ...originalEnv };

        // Suppress console output during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => {});

        mockOrchestrateMigration = jest.fn().mockResolvedValue({ success: true });

        mockServer = {
            listen: jest.fn(),
            on: jest.fn()
        };
        mockCreateServer = jest.fn(() => mockServer);

        jest.doMock('http', () => ({
            createServer: mockCreateServer
        }));

        jest.doMock('../../app', () => ({
            set: jest.fn()
        }));

        jest.doMock('../../documentation/3-7-0/3-7-0-migration', () => ({
            orchestrateMigration: mockOrchestrateMigration
        }));
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    async function requireWww() {
        require('../../bin/www');
        await flushPromises();
    }

    describe('TEMPORARY hard-disable of startup migrations', () => {
        it('should skip migrations when SKIP_STARTUP_MIGRATIONS is "true"', async () => {
            process.env.SKIP_STARTUP_MIGRATIONS = 'true';
            await requireWww();
            expect(mockOrchestrateMigration).not.toHaveBeenCalled();
        });

        it('should skip migrations when SKIP_STARTUP_MIGRATIONS is "false"', async () => {
            process.env.SKIP_STARTUP_MIGRATIONS = 'false';
            await requireWww();
            expect(mockOrchestrateMigration).not.toHaveBeenCalled();
        });

        it('should skip migrations when SKIP_STARTUP_MIGRATIONS is unset', async () => {
            delete process.env.SKIP_STARTUP_MIGRATIONS;
            await requireWww();
            expect(mockOrchestrateMigration).not.toHaveBeenCalled();
        });

        it('should log that startup migrations were hard-disabled', async () => {
            await requireWww();
            expect(console.log).toHaveBeenCalledWith(
                'Startup migrations skipped. TEMPORARY hard-disable for DocumentDB connection testing.'
            );
        });
    });

    describe('Server starts while migrations are skipped', () => {
        it('should start the server without running migrations', async () => {
            await requireWww();

            expect(mockOrchestrateMigration).not.toHaveBeenCalled();
            expect(process.exit).not.toHaveBeenCalled();
            expect(mockCreateServer).toHaveBeenCalled();
            expect(mockServer.listen).toHaveBeenCalled();
        });
    });
});
