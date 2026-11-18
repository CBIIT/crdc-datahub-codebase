const { ConfigurationService } = require('../../services/configurationService');






describe('ConfigurationService._getTier', () => {
    let configurationService;

    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
    });

    const testCases = [
        {
            name: 'should read the tier name from the configuration',
            keys: {
                tier: 'tier_name'
            },
            expected: 'tier_name'
        },
        {
            name: 'should return null if the tier is missing from the configuraion entry',
            keys: {},
            expected: null
        },
        {
            name: 'should return null if the configuration entry is not found',
            keys: null,
            expected: null
        }
    ];

    it.each(testCases)('$name', async ({ keys, expected }) => {
        configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
        expect(await configurationService._getTier()).toBe(expected);
        expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith('TIER');
    });
    
});


describe('ConfigurationService._getModelContentRepo', () => {
    let configurationService;
    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
    });
    
    
    const testCases = [
        {
            name: 'should read the model content repo from the configuration',
            keys: {
                repo_url: 'https://raw.githubusercontent.com/CBIIT/crdc-datahub-models'
            },
            expected: 'https://raw.githubusercontent.com/CBIIT/crdc-datahub-models'
        },
        {
            name: 'should return null if the model content repo is missing from the configuration entry',
            keys: {},
            expected: null
        },
        {
            name: 'should return null if the configuration entry is not found',
            keys: null,
            expected: null
        }
    ];

    it.each(testCases)('$name', async ({ keys, expected }) => {
        configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
        expect(await configurationService._getModelContentRepo()).toBe(expected);
        expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith('MODEL_CONTENT');
    });
    
});

describe('ConfigurationService._getContentPath', () => {
    let configurationService;
    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
    });
    
    
    const testCases = [
        {
            name: 'should read the content path from the configuration',
            keys: {
                content_path: 'cache/content.json'
            },
            expected: 'cache/content.json'
        },
        {
            name: 'should return null if the content path is missing from the configuration entry',
            keys: {},
            expected: null
        },
        {
            name: 'should return null if the configuration entry is not found',
            keys: null,
            expected: null
        }
    ];

    it.each(testCases)('$name', async ({ keys, expected }) => {
        configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
        expect(await configurationService._getContentPath()).toBe(expected);
        expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith('MODEL_CONTENT');
    });
});

describe('ConfigurationService.getModelContentURL', () => {
    let configurationService;
    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
        jest.spyOn(configurationService, '_getTier').mockResolvedValue('tier_name');
        jest.spyOn(configurationService, '_getModelContentRepo').mockResolvedValue('https://raw.githubusercontent.com/CBIIT/crdc-datahub-models');
        jest.spyOn(configurationService, '_getContentPath').mockResolvedValue('cache/content.json');
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    const testCases = [
        {
            name: 'should return the model content URL',
            setup: () => {},
            expected: 'https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/refs/heads/tier_name/cache/content.json',
            expectations: () => {
                expect(configurationService._getTier).toHaveBeenCalled();
                expect(configurationService._getModelContentRepo).toHaveBeenCalled();
                expect(configurationService._getContentPath).toHaveBeenCalled();
            }
        },
        {
            name: 'should return null if the tier is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getTier').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(configurationService._getTier).toHaveBeenCalled();
            },
        },
        {
            name: 'should return null if the model content repo is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getModelContentRepo').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(configurationService._getModelContentRepo).toHaveBeenCalled();
            },
        },
        {
            name: 'should return null if the content path is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getContentPath').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(configurationService._getContentPath).toHaveBeenCalled();
            },
        },
        {
            name: 'should log an error if the tier is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getTier').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(console.error).toHaveBeenCalledWith('Unable to read the tier from the configuration');
            },
        },
        {
            name: 'should log an error if the model content repo is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getModelContentRepo').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(console.error).toHaveBeenCalledWith('Unable to read the model content repo from the configuration');
            },
        },
        {
            name: 'should log an error if the content path is not found',
            setup: () => {
                jest.spyOn(configurationService, '_getContentPath').mockResolvedValue(null);
            },
            expected: null,
            expectations: () => {
                expect(console.error).toHaveBeenCalledWith('Unable to read the content path from the configuration');
            },
        },
    ];

    it.each(testCases)('$name', async ({ setup, expected, expectations}) => {
        setup();
        expect(await configurationService.getModelContentURL()).toBe(expected);
        expectations();
    });

});

describe('ConfigurationService.getModelContentTTLMinutes', () => {
    let configurationService;
    beforeEach(() => {
        configurationService = new ConfigurationService();
        jest.spyOn(configurationService.configurationDAO, 'findByType').mockResolvedValue(null);
    });
    
    const testCases = [
        {
            name: 'should return the model content TTL minutes',
            keys: {
                ttl_minutes: 5
            },
            expected: 5
        },
        {
            name: 'should default to 24 hours if ttl_minutes is not provided',
            keys: {},
            expected: 60 * 24
        },
        {
            name: 'should default to 24 hours if the configuration entry is not found',
            keys: null,
            expected: 60 * 24
        }
    ];

    it.each(testCases)('$name', async ({ keys, expected }) => {
        configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
        expect(await configurationService.getModelContentTTLMinutes()).toBe(expected);
        expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith('MODEL_CONTENT');
    });
});
