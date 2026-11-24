const { ConfigurationService } = require("../../services/configurationService");
const DataModelService = require("../../services/data-model-service");

const VALID_EXAMPLE = {
  TTL_MINUTES: 60 * 12,
  MODEL_CONTENT: {
    model1: {
      isHidden: true,
    },
    model2: {
      isHidden: false,
    },
    model3: {
      isHidden: true,
    },
  },
  MODELS_LIST: ["model1", "model2", "model3"],
  HIDDEN_MODELS: ["model1", "model3"],
  FILTERED_MODELS_LIST: ["model2"],
  CONTENT_URL:
    "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/refs/heads/dev2/cache/content.json",
};

function createService() {
  return new DataModelService("test-model", "test-url", new ConfigurationService());
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DataModelService constructor", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const testCases = [
    {
      name: "should not refresh hidden models when constructed without a configuration service",
      createConfigurationService: () => undefined,
    },
    {
      name: "should not refresh hidden models when the configuration service rejects",
      createConfigurationService: () => ({
        getModelContentTTLMinutes: jest.fn().mockRejectedValue(new Error("db error")),
        getModelContentURL: jest.fn().mockRejectedValue(new Error("db error")),
      }),
    },
  ];

  it.each(testCases)("$name", ({ createConfigurationService }) => {
    const refreshSpy = jest.spyOn(DataModelService.prototype, "refreshHiddenModels");
    const service = new DataModelService("test-model", "test-url", createConfigurationService());
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(service.hiddenDataModels).toEqual([]);
    expect(service.lastTTLMinutes).toBeUndefined();
  });
});

describe("DataModelService.isModelHidden - valid input cases", () => {
  let service;
  let configurationService;

  const VALID_EXAMPLE = {
    MODEL_NAME: "model1",
    HIDDEN_MODELS: ["model1"],
  };

  beforeEach(() => {
    configurationService = new ConfigurationService();
    service = new DataModelService("test-model", "test-url", configurationService);
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
  });

  const testCases = [
    {
      name: "should return true when the model is in the hidden models list",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
    },
    {
      name: "should return false when the model is not in the hidden models list",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: ["model2"],
      expectedResponse: false,
    },
    {
      name: "should return false when the hidden models list is empty",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: [],
      expectedResponse: false,
    },
  ];

  it.each(testCases)("$name", async ({ modelName, hiddenModels, expectedResponse, setup }) => {
    service.hiddenDataModels = hiddenModels;
    expect(await service.isModelHidden(modelName)).toBe(expectedResponse);
    expect(service.refreshHiddenModels).toHaveBeenCalled();
  });
});

describe("DataModelService.isModelHidden - invalid input cases", () => {
  const VALID_EXAMPLE = {
    MODEL_NAME: "model1",
    HIDDEN_MODELS: ["model1"],
  };

  let service;
  let configurationService;

  beforeEach(() => {
    configurationService = new ConfigurationService();
    service = new DataModelService("test-model", "test-url", configurationService);
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  const testCases = [
    {
      name: "should return true when the model is not a string (integer)",
      modelName: 123,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
      expectations: () => {
        expect(console.warn).toHaveBeenCalled();
        expect(service.refreshHiddenModels).not.toHaveBeenCalled();
      },
    },
    {
      name: "should return true when the model is not a string (boolean)",
      modelName: true,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
      expectations: () => {
        expect(console.warn).toHaveBeenCalled();
        expect(service.refreshHiddenModels).not.toHaveBeenCalled();
      },
    },
    {
      name: "should return true when the model is not a string (object)",
      modelName: VALID_EXAMPLE.HIDDEN_MODELS,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
      expectations: () => {
        expect(console.warn).toHaveBeenCalled();
        expect(service.refreshHiddenModels).not.toHaveBeenCalled();
      },
    },
    {
      name: "should return true when the model is null",
      modelName: null,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
      expectations: () => {
        expect(console.warn).toHaveBeenCalled();
        expect(service.refreshHiddenModels).not.toHaveBeenCalled();
      },
    },
    {
      name: "should return true when the model is undefined",
      modelName: undefined,
      hiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedResponse: true,
      expectations: () => {
        expect(console.warn).toHaveBeenCalled();
        expect(service.refreshHiddenModels).not.toHaveBeenCalled();
      },
    },
    {
      name: "should return false when hidden models list is undefined",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: undefined,
      expectedResponse: false,
      expectations: () => {
        expect(console.error).toHaveBeenCalled();
        expect(service.refreshHiddenModels).toHaveBeenCalled();
      },
    },
    {
      name: "should return false when hidden models list is null",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: null,
      expectedResponse: false,
      expectations: () => {
        expect(console.error).toHaveBeenCalled();
        expect(service.refreshHiddenModels).toHaveBeenCalled();
      },
    },
    {
      name: "should return false when hidden models list is not an array (string)",
      modelName: VALID_EXAMPLE.MODEL_NAME,
      hiddenModels: "not-an-array",
      expectedResponse: false,
      expectations: () => {
        expect(console.error).toHaveBeenCalled();
        expect(service.refreshHiddenModels).toHaveBeenCalled();
      },
    },
  ];

  it.each(testCases)(
    "$name",
    async ({ modelName, hiddenModels, expectedResponse, expectations }) => {
      service.hiddenDataModels = hiddenModels;
      expect(await service.isModelHidden(modelName)).toBe(expectedResponse);
      expectations();
    }
  );
});

describe("DataModelService.refreshHiddenModels when the content is not expired", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should read the TTL and not fetch content", async () => {
    const cachedDate = new Date(Date.now() - 1000);
    service.contentFetchDate = cachedDate;
    service.lastTTLMinutes = 60;
    service.hiddenDataModels = ["cached-model"];
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockResolvedValue(VALID_EXAMPLE.TTL_MINUTES);
    jest.spyOn(service, "_isContentExpired").mockReturnValue(false);
    jest.spyOn(service, "_fetchContent");

    await service.refreshHiddenModels();

    expect(service.configurationService.getModelContentTTLMinutes).toHaveBeenCalledWith(60);
    expect(service._isContentExpired).toHaveBeenCalledWith(cachedDate, VALID_EXAMPLE.TTL_MINUTES);
    expect(service._fetchContent).not.toHaveBeenCalled();
    expect(service.hiddenDataModels).toEqual(["cached-model"]);
    expect(service.lastTTLMinutes).toBe(VALID_EXAMPLE.TTL_MINUTES);
  });
});

describe("DataModelService.refreshHiddenModels when the content is expired", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should refresh the hidden models list", async () => {
    const priorFetchDate = new Date(Date.now() - VALID_EXAMPLE.TTL_MINUTES * 60 * 1000 - 1);
    service.contentFetchDate = priorFetchDate;
    service.lastTTLMinutes = 60;
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockResolvedValue(VALID_EXAMPLE.TTL_MINUTES);
    jest.spyOn(service, "_isContentExpired").mockReturnValue(true);
    jest.spyOn(service, "_fetchContent").mockResolvedValue(VALID_EXAMPLE.MODEL_CONTENT);
    jest.spyOn(service, "_updateHiddenModels").mockImplementation(() => {
      service.hiddenDataModels = VALID_EXAMPLE.HIDDEN_MODELS;
    });

    await service.refreshHiddenModels();

    expect(service.configurationService.getModelContentTTLMinutes).toHaveBeenCalledWith(60);
    expect(service._isContentExpired).toHaveBeenCalledWith(
      priorFetchDate,
      VALID_EXAMPLE.TTL_MINUTES
    );
    expect(service._fetchContent).toHaveBeenCalled();
    expect(service._updateHiddenModels).toHaveBeenCalledWith(VALID_EXAMPLE.MODEL_CONTENT);
    expect(service.contentFetchDate).toBeInstanceOf(Date);
    expect(service.contentFetchDate.getTime()).toBeGreaterThan(priorFetchDate.getTime());
    expect(service.hiddenDataModels).toEqual(VALID_EXAMPLE.HIDDEN_MODELS);
    expect(service.lastTTLMinutes).toBe(VALID_EXAMPLE.TTL_MINUTES);
  });
});

describe("DataModelService.refreshHiddenModels when the content fetch returns null", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should preserve the hidden models", async () => {
    const priorFetchDate = new Date(Date.now() - VALID_EXAMPLE.TTL_MINUTES * 60 * 1000 - 1);
    service.contentFetchDate = priorFetchDate;
    service.lastTTLMinutes = 60;
    service.hiddenDataModels = ["model1"];
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockResolvedValue(VALID_EXAMPLE.TTL_MINUTES);
    jest.spyOn(service, "_isContentExpired").mockReturnValue(true);
    jest.spyOn(service, "_fetchContent").mockResolvedValue(null);
    jest.spyOn(service, "_updateHiddenModels");
    jest.spyOn(console, "warn").mockImplementation(() => {});

    await service.refreshHiddenModels();

    expect(service._fetchContent).toHaveBeenCalled();
    expect(service._updateHiddenModels).not.toHaveBeenCalled();
    expect(service.hiddenDataModels).toEqual(["model1"]);
    expect(service.contentFetchDate).toBe(priorFetchDate);
    expect(console.warn).toHaveBeenCalledWith(
      "Model content unavailable; keeping cached hidden models"
    );
  });
});

describe("DataModelService.refreshHiddenModels when the content fetch returns an empty object", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should clear the hidden models", async () => {
    service.contentFetchDate = new Date(Date.now() - VALID_EXAMPLE.TTL_MINUTES * 60 * 1000 - 1);
    service.hiddenDataModels = ["model1"];
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockResolvedValue(VALID_EXAMPLE.TTL_MINUTES);
    jest.spyOn(service, "_isContentExpired").mockReturnValue(true);
    jest.spyOn(service, "_fetchContent").mockResolvedValue({});

    await service.refreshHiddenModels();

    expect(service._fetchContent).toHaveBeenCalled();
    expect(service.hiddenDataModels).toEqual([]);
    expect(service.contentFetchDate).toBeInstanceOf(Date);
  });
});

describe("DataModelService.refreshHiddenModels when the refresh throws", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should preserve the cached values and resolve", async () => {
    const priorFetchDate = new Date(Date.now() - VALID_EXAMPLE.TTL_MINUTES * 60 * 1000 - 1);
    service.contentFetchDate = priorFetchDate;
    service.lastTTLMinutes = 60;
    service.hiddenDataModels = ["model1"];
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockRejectedValue(new Error("db error"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    await service.refreshHiddenModels();

    expect(service.hiddenDataModels).toEqual(["model1"]);
    expect(service.contentFetchDate).toBe(priorFetchDate);
    expect(service.lastTTLMinutes).toBe(60);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("DataModelService.refreshHiddenModels when the content has never been fetched", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should refresh and record the TTL", async () => {
    jest
      .spyOn(service.configurationService, "getModelContentTTLMinutes")
      .mockResolvedValue(VALID_EXAMPLE.TTL_MINUTES);
    jest.spyOn(service, "_fetchContent").mockResolvedValue(VALID_EXAMPLE.MODEL_CONTENT);

    await service.refreshHiddenModels();

    expect(service.configurationService.getModelContentTTLMinutes).toHaveBeenCalledWith(undefined);
    expect(service.hiddenDataModels).toEqual(VALID_EXAMPLE.HIDDEN_MODELS);
    expect(service.lastTTLMinutes).toBe(VALID_EXAMPLE.TTL_MINUTES);
    expect(service.contentFetchDate).toBeInstanceOf(Date);
  });
});

describe("DataModelService._fetchContent when the content URL is fetched successfully", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should return the parsed content", async () => {
    jest
      .spyOn(service.configurationService, "getModelContentURL")
      .mockResolvedValue(VALID_EXAMPLE.CONTENT_URL);
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_EXAMPLE.MODEL_CONTENT),
    });

    expect(await service._fetchContent()).toEqual(VALID_EXAMPLE.MODEL_CONTENT);
    expect(service.configurationService.getModelContentURL).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(VALID_EXAMPLE.CONTENT_URL, {
      signal: expect.any(AbortSignal),
    });
  });
});

describe("DataModelService._fetchContent when the content URL is missing", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should return null", async () => {
    jest.spyOn(service.configurationService, "getModelContentURL").mockResolvedValue(null);

    expect(await service._fetchContent()).toBeNull();
    expect(service.configurationService.getModelContentURL).toHaveBeenCalled();
  });
});

describe("DataModelService._fetchContent when the response cannot be read", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  const testCases = [
    {
      name: "should return null if the content is not found",
      response: {
        ok: false,
      },
    },
    {
      name: "should return null if the content is not valid JSON",
      response: {
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token o in JSON at position 1")),
      },
    },
  ];

  it.each(testCases)("$name", async ({ response }) => {
    jest
      .spyOn(service.configurationService, "getModelContentURL")
      .mockResolvedValue(VALID_EXAMPLE.CONTENT_URL);
    jest.spyOn(global, "fetch").mockResolvedValue(response);

    expect(await service._fetchContent()).toBeNull();
    expect(fetch).toHaveBeenCalledWith(VALID_EXAMPLE.CONTENT_URL, {
      signal: expect.any(AbortSignal),
    });
  });
});

describe("DataModelService._fetchContent when the fetch times out", () => {
  let service;

  beforeEach(() => {
    service = createService();
  });

  it("should return null and log the timeout", async () => {
    jest
      .spyOn(service.configurationService, "getModelContentURL")
      .mockResolvedValue(VALID_EXAMPLE.CONTENT_URL);
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(await service._fetchContent()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      `Timed out after 3000ms fetching model content from ${VALID_EXAMPLE.CONTENT_URL}`
    );
  });
});

describe("DataModelService._updateHiddenModels", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
  });

  const testCases = [
    {
      name: "should read isHidden to determine the hidden models",
      content: VALID_EXAMPLE.MODEL_CONTENT,
      expectedHiddenModels: VALID_EXAMPLE.HIDDEN_MODELS,
    },
    {
      name: "should consider all non-true isHidden to be false",
      content: {
        model1: {
          isHidden: false,
        },
        model2: {
          isHidden: null,
        },
        model3: {
          isHidden: undefined,
        },
        model4: {
          isHidden: "not-a-boolean",
        },
        model5: {},
        model6: {
          isHidden: true,
        },
      },
      expectedHiddenModels: ["model6"],
    },
  ];

  it.each(testCases)("$name", async ({ content, expectedHiddenModels }) => {
    service._updateHiddenModels(content);
    expect(service.hiddenDataModels).toEqual(expectedHiddenModels);
  });
});

describe("DataModelService._isContentExpired", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
  });

  const ttlMinutes = VALID_EXAMPLE.TTL_MINUTES;
  const ttlMs = ttlMinutes * 60 * 1000;
  const testCases = [
    {
      name: "should return false if the content is not expired",
      contentDate: new Date(Date.now() - ttlMs + 50000),
      ttlMinutes,
      expectedRefresh: false,
    },
    {
      name: "should return true if the content age equals the ttl",
      contentDate: new Date(Date.now() - ttlMs),
      ttlMinutes,
      expectedRefresh: true,
    },
    {
      name: "should return true if the content is expired",
      contentDate: new Date(Date.now() - ttlMs - 1),
      ttlMinutes,
      expectedRefresh: true,
    },
    {
      name: "should default to true if the ttl is invalid",
      contentDate: new Date(Date.now() - ttlMs),
      ttlMinutes: "not-a-number",
      expectedRefresh: true,
    },
    {
      name: "should default to true if the content date is invalid",
      contentDate: new Date("not-a-date"),
      ttlMinutes,
      expectedRefresh: true,
    },
    {
      name: "should default to true if the content date is null",
      contentDate: null,
      ttlMinutes,
      expectedRefresh: true,
    },
    {
      name: "should default to true if the content date and ttl are not provided",
      expectedRefresh: true,
    },
  ];

  it.each(testCases)("$name", async ({ contentDate, ttlMinutes, expectedRefresh }) => {
    expect(service._isContentExpired(contentDate, ttlMinutes)).toBe(expectedRefresh);
  });
});

describe("DataModelService.removeHiddenDataModels - valid input cases", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
  });

  const testCases = [
    {
      name: "should filter out the hidden data models from the data commons list",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedDataCommonsList: VALID_EXAMPLE.FILTERED_MODELS_LIST,
    },
    {
      name: "should return the same list if none of the models are hidden",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: ["fake-model"],
      expectedDataCommonsList: VALID_EXAMPLE.MODELS_LIST,
    },
    {
      name: "should return the same list if the hidden data models list is empty",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: [],
      expectedDataCommonsList: VALID_EXAMPLE.MODELS_LIST,
    },
  ];

  it.each(testCases)(
    "$name",
    async ({
      dataCommonsList,
      hiddenDataModels,
      expectedDataCommonsList,
      expectations = () => {},
    }) => {
      service.hiddenDataModels = hiddenDataModels;
      expect(await service.removeHiddenDataModels(dataCommonsList)).toEqual(
        expectedDataCommonsList
      );
      expect(service.refreshHiddenModels).toHaveBeenCalled();
    }
  );
});

describe("DataModelService.removeHiddenDataModels - empty input", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  const testCases = [
    {
      name: "should return an empty list without warning or refreshing if an empty models list is provided",
      dataCommonsList: [],
      hiddenDataModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedDataCommonsList: [],
    },
  ];

  it.each(testCases)(
    "$name",
    async ({ dataCommonsList, hiddenDataModels, expectedDataCommonsList }) => {
      service.hiddenDataModels = hiddenDataModels;
      expect(await service.removeHiddenDataModels(dataCommonsList)).toEqual(
        expectedDataCommonsList
      );
      expect(console.warn).not.toHaveBeenCalled();
      expect(service.refreshHiddenModels).not.toHaveBeenCalled();
    }
  );
});

describe("DataModelService.removeHiddenDataModels - invalid input", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  const testCases = [
    {
      name: "should return an empty list if the data commons list is null",
      dataCommonsList: null,
      hiddenDataModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedDataCommonsList: [],
    },
    {
      name: "should return an empty list if the data commons list is undefined",
      dataCommonsList: undefined,
      hiddenDataModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedDataCommonsList: [],
    },
    {
      name: "should return an empty list if the data commons list is not an array",
      dataCommonsList: "not-an-array",
      hiddenDataModels: VALID_EXAMPLE.HIDDEN_MODELS,
      expectedDataCommonsList: [],
    },
  ];

  it.each(testCases)(
    "$name",
    async ({ dataCommonsList, hiddenDataModels, expectedDataCommonsList }) => {
      service.hiddenDataModels = hiddenDataModels;
      expect(await service.removeHiddenDataModels(dataCommonsList)).toEqual(
        expectedDataCommonsList
      );
      expect(console.warn).toHaveBeenCalled();
      expect(service.refreshHiddenModels).not.toHaveBeenCalled();
    }
  );
});

describe("DataModelService.removeHiddenDataModels - invalid hidden data models list", () => {
  let service;

  beforeEach(() => {
    service = new DataModelService("test-model", "test-url");
    jest.spyOn(service, "refreshHiddenModels").mockResolvedValue();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  const testCases = [
    {
      name: "should return the same list if the hidden data models list is undefined",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: undefined,
      expectedDataCommonsList: VALID_EXAMPLE.MODELS_LIST,
    },
    {
      name: "should return the same list if the hidden data models list is null",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: null,
      expectedDataCommonsList: VALID_EXAMPLE.MODELS_LIST,
    },
    {
      name: "should return the same list if the hidden data models list is not an array",
      dataCommonsList: VALID_EXAMPLE.MODELS_LIST,
      hiddenDataModels: "not-an-array",
      expectedDataCommonsList: VALID_EXAMPLE.MODELS_LIST,
    },
  ];

  it.each(testCases)(
    "$name",
    async ({ dataCommonsList, hiddenDataModels, expectedDataCommonsList }) => {
      service.hiddenDataModels = hiddenDataModels;
      expect(await service.removeHiddenDataModels(dataCommonsList)).toEqual(
        expectedDataCommonsList
      );
      expect(console.error).toHaveBeenCalled();
      expect(service.refreshHiddenModels).toHaveBeenCalled();
    }
  );
});
