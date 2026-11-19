const DataModelService = require('../../services/data-model-service');
const { ConfigurationService } = require('../../services/configurationService');


describe('DataModelService.isModelHidden', () => {
    let service;
    let configurationService;

    beforeEach(() => {
        configurationService = new ConfigurationService();
        service = new DataModelService("test-model", "test-url", configurationService);
        jest.spyOn(service, '_refreshHiddenModels').mockResolvedValue();
    });

    const testCases = [
        {
            name: 'should return true when the model is in the hidden models list',
            modelName: 'model1',
            setup: () => {
                service.hiddenDataModels = ['model1'];
            },
            expectedResponse: true
        },
        {
            name: 'should return false when the model is not in the hidden models list',
            modelName: 'model2',
            setup: () => {
                service.hiddenDataModels = ['model1'];
            },
            expectedResponse: false
        }
    ];

    it.each(testCases)('$name', async ({ modelName, expectedResponse, setup }) => {
        await setup();
        expect(await service.isModelHidden(modelName)).toBe(expectedResponse);
        expect(service._refreshHiddenModels).toHaveBeenCalled();
    });

});

describe('DataModelService._refreshHiddenModels', () => {
    let service;
    let configurationService;

    beforeEach(() => {
        configurationService = new ConfigurationService();
        service = new DataModelService("test-model", "test-url", configurationService);
    });

    const ttlMinutes = 60 * 24;
    const content = {
        model1: {
            isHidden: true
        },
        model2: {
            isHidden: false
        },
        model3: {
            isHidden: true
        }
    };
    const hiddenModels = ['model1', 'model3'];

    const testCases = [
        {
            name: 'should not fetch when content is not expired',
            setup: () => {
                const cachedDate = new Date(Date.now() - 1000);
                service.contentFetchDate = cachedDate;
                service.hiddenDataModels = ['cached-model'];
                jest.spyOn(service.configurationService, 'getModelContentTTLMinutes').mockResolvedValue(ttlMinutes);
                jest.spyOn(service, '_isContentExpired').mockReturnValue(false);
                jest.spyOn(service, '_fetchContent');
                return {};
            },
            expectations: () => {
                expect(service.configurationService.getModelContentTTLMinutes).toHaveBeenCalled();
                expect(service._isContentExpired).toHaveBeenCalledWith(service.contentFetchDate, ttlMinutes);
                expect(service._fetchContent).not.toHaveBeenCalled();
                expect(service.hiddenDataModels).toEqual(['cached-model']);
            }
        },
        {
            name: 'should refresh the hidden models list when content is expired',
            setup: () => {
                const priorFetchDate = new Date(Date.now() - ttlMinutes * 60 * 1000 - 1);
                service.contentFetchDate = priorFetchDate;
                jest.spyOn(service.configurationService, 'getModelContentTTLMinutes').mockResolvedValue(ttlMinutes);
                jest.spyOn(service, '_isContentExpired').mockReturnValue(true);
                jest.spyOn(service, '_fetchContent').mockResolvedValue(content);
                jest.spyOn(service, '_updateHiddenModels').mockImplementation(() => {
                    service.hiddenDataModels = hiddenModels;
                });
                return { priorFetchDate };
            },
            expectations: (priorFetchDate) => {
                expect(service.configurationService.getModelContentTTLMinutes).toHaveBeenCalled();
                expect(service._isContentExpired).toHaveBeenCalledWith(priorFetchDate, ttlMinutes);
                expect(service._fetchContent).toHaveBeenCalled();
                expect(service._updateHiddenModels).toHaveBeenCalledWith(content);
                expect(service.contentFetchDate).toBeInstanceOf(Date);
                expect(service.contentFetchDate.getTime()).toBeGreaterThan(priorFetchDate.getTime());
                expect(service.hiddenDataModels).toEqual(hiddenModels);
            }
        },
        {
            name: 'should preserve hidden models when fetch returns null',
            setup: () => {
                const priorFetchDate = new Date(Date.now() - ttlMinutes * 60 * 1000 - 1);
                service.contentFetchDate = priorFetchDate;
                service.hiddenDataModels = ['model1'];
                jest.spyOn(service.configurationService, 'getModelContentTTLMinutes').mockResolvedValue(ttlMinutes);
                jest.spyOn(service, '_isContentExpired').mockReturnValue(true);
                jest.spyOn(service, '_fetchContent').mockResolvedValue(null);
                jest.spyOn(service, '_updateHiddenModels');
                return { priorFetchDate };
            },
            expectations: (priorFetchDate) => {
                expect(service._fetchContent).toHaveBeenCalled();
                expect(service._updateHiddenModels).not.toHaveBeenCalled();
                expect(service.hiddenDataModels).toEqual(['model1']);
                expect(service.contentFetchDate).toBe(priorFetchDate);
            }
        },
        {
            name: 'should clear hidden models when fetch returns an empty object',
            setup: () => {
                service.contentFetchDate = new Date(Date.now() - ttlMinutes * 60 * 1000 - 1);
                service.hiddenDataModels = ['model1'];
                jest.spyOn(service.configurationService, 'getModelContentTTLMinutes').mockResolvedValue(ttlMinutes);
                jest.spyOn(service, '_isContentExpired').mockReturnValue(true);
                jest.spyOn(service, '_fetchContent').mockResolvedValue({});
                return {};
            },
            expectations: () => {
                expect(service._fetchContent).toHaveBeenCalled();
                expect(service.hiddenDataModels).toEqual([]);
                expect(service.contentFetchDate).toBeInstanceOf(Date);
            }
        }
    ];

    it.each(testCases)('$name', async ({ setup, expectations }) => {
        const context = setup();
        await service._refreshHiddenModels();
        if (context.priorFetchDate) {
            expectations(context.priorFetchDate);
        } else {
            expectations();
        }
    });
});

describe('DataModelService._fetchContent', () => {
    let service;
    let configurationService;

    beforeEach(() => {
        configurationService = new ConfigurationService();
        service = new DataModelService("test-model", "test-url", configurationService);
    });

    const contentUrl = "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/refs/heads/dev2/cache/content.json";

    const testCases = [
        {
            name: 'should call the configuration service to get the content url',
            setup: () => {
                jest.spyOn(service.configurationService, 'getModelContentURL').mockResolvedValue(contentUrl);
                jest.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: () => Promise.resolve({
                        model1: {
                            isHidden: true
                        }
                    })
                });
            },
            expectations: () => {
                expect(service.configurationService.getModelContentURL).toHaveBeenCalled();
                expect(fetch).toHaveBeenCalledWith(contentUrl);
            },
            expectedResponse: {
                model1: {
                    isHidden: true
                }
            },
        },
        {
            name: 'should return null if the content url is not found',
            setup: () => {
                jest.spyOn(service.configurationService, 'getModelContentURL').mockResolvedValue(null);
            },
            expectations: () => {
                expect(service.configurationService.getModelContentURL).toHaveBeenCalled();
            },
            expectedResponse: null,
        },
        {
            name: 'should return null if the content is not found',
            setup: () => {
                jest.spyOn(service.configurationService, 'getModelContentURL').mockResolvedValue(contentUrl);
                jest.spyOn(global, 'fetch').mockResolvedValue({
                    ok: false,
                });
            },
            expectations: () => {
                expect(fetch).toHaveBeenCalledWith(contentUrl);
            },
            expectedResponse: null,
        },
        {
            name: 'should return null if the content is not valid JSON',
            setup: () => {
                jest.spyOn(service.configurationService, 'getModelContentURL').mockResolvedValue(contentUrl);
                jest.spyOn(global, 'fetch').mockResolvedValue({
                    ok: true,
                    json: () => Promise.reject(new SyntaxError('Unexpected token o in JSON at position 1')),
                });
            },
            expectations: () => {
                expect(fetch).toHaveBeenCalledWith(contentUrl);
            },
            expectedResponse: null,
        }
    ]

    it.each(testCases)('$name', async ({ setup, expectations, expectedResponse }) => {
        await setup();
        expect(await service._fetchContent()).toEqual(expectedResponse);
        expectations();
    });
});

describe('DataModelService._updateHiddenModels', () => {

    let service;

    beforeEach(() => {
        service = new DataModelService("test-model", "test-url");
    });

    const testCases = [
        {
            name: 'should read isHidden to determine the hidden models',
            content: {
                model1: {
                    isHidden: true
                },
                model2: {
                    isHidden: false
                },
                model3: {
                    isHidden: true
                }
            },
            expectedHiddenModels: ['model1', 'model3']
        },
        {
            name: 'should consider all non-true isHidden to be false',
            content: {
                model1: {
                    isHidden: false
                },
                model2: {
                    isHidden: null
                },
                model3: {
                    isHidden: undefined
                },
                model4: {
                    isHidden: 'not-a-boolean'
                },
                model5: {},
                model6: {
                    isHidden: true
                }
            },
            expectedHiddenModels: ['model6']
        }
    ];

    it.each(testCases)('$name', async ({ content, expectedHiddenModels }) => {
        service._updateHiddenModels(content);
        expect(service.hiddenDataModels).toEqual(expectedHiddenModels);
    });
});

describe('DataModelService._isContentExpired', () => {
    let service;

    beforeEach(() => {
        service = new DataModelService("test-model", "test-url");
    });

    const ttlMinutes = 60 * 24;
    const ttlMs = ttlMinutes * 60 * 1000;
    const testCases = [
        {
            name: 'should return false if the content is not expired',
            contentDate: new Date(Date.now() - ttlMs + 50000),
            ttlMinutes,
            expectedRefresh: false
        },
        {
            name: 'should return true if the content age equals the ttl',
            contentDate: new Date(Date.now() - ttlMs),
            ttlMinutes,
            expectedRefresh: true
        },
        {
            name: 'should return true if the content is expired',
            contentDate: new Date(Date.now() - ttlMs - 1),
            ttlMinutes,
            expectedRefresh: true
        },
        {
            name: 'should default to true if the ttl is invalid',
            contentDate: new Date(Date.now() - ttlMs),
            ttlMinutes: 'not-a-number',
            expectedRefresh: true
        },
        {
            name: 'should default to true if the content date is invalid',
            contentDate: new Date('not-a-date'),
            ttlMinutes,
            expectedRefresh: true
        },
        {
            name: 'should default to true if the content date is null',
            contentDate: null,
            ttlMinutes,
            expectedRefresh: true
        },
        {
            name: 'should default to true if the content date and ttl are not provided',
            expectedRefresh: true
        }
    ];

    it.each(testCases)('$name', async ({ contentDate, ttlMinutes, expectedRefresh }) => {
        expect(service._isContentExpired(contentDate, ttlMinutes)).toBe(expectedRefresh);
    });
});
