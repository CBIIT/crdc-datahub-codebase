const { ConfigurationService } = require("../../services/configurationService");

describe("ConfigurationService._getTier", () => {
  let configurationService;

  beforeEach(() => {
    configurationService = new ConfigurationService();
    jest.spyOn(configurationService.configurationDAO, "findByType").mockResolvedValue(null);
  });

  const testCases = [
    {
      name: "should read the tier name from the configuration",
      keys: {
        tier: "tier_name",
      },
      expected: "tier_name",
    },
    {
      name: "should return null if the tier is missing from the configuraion entry",
      keys: {},
      expected: null,
    },
    {
      name: "should return null if the configuration entry is not found",
      keys: null,
      expected: null,
    },
  ];

  it.each(testCases)("$name", async ({ keys, expected }) => {
    configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
    expect(await configurationService._getTier()).toBe(expected);
    expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith("TIER");
  });
});

describe("ConfigurationService.getModelContentURL", () => {
  let configurationService;
  const REPO_URL = "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models";
  const CONTENT_PATH = "cache/content.json";
  const buildURL = (branch) => `${REPO_URL}/refs/heads/${branch}/${CONTENT_PATH}`;

  /**
   * Mocks the configuration DAO by configuration type.
   * @param {object} docs Map of configuration type to document
   */
  const mockConfigurations = (docs) => {
    jest
      .spyOn(configurationService.configurationDAO, "findByType")
      .mockImplementation(async (type) => docs[type] ?? null);
  };
  const modelContent = { keys: { repo_url: REPO_URL, content_path: CONTENT_PATH } };

  beforeEach(() => {
    configurationService = new ConfigurationService();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { tier: "dev", branch: "dev" },
    { tier: "QA", branch: "qa" },
    { tier: "dev-2", branch: "dev2" },
    { tier: " Stage ", branch: "stage" },
  ])("should build the URL for tier $tier on branch $branch", async ({ tier, branch }) => {
    mockConfigurations({ TIER: { keys: { tier } }, MODEL_CONTENT: modelContent });
    expect(await configurationService.getModelContentURL()).toBe(buildURL(branch));
  });

  it.each([
    {
      name: "the TIER document is missing",
      docs: { MODEL_CONTENT: modelContent },
    },
    {
      name: "the tier is empty after sanitizing",
      docs: { TIER: { keys: { tier: "--" } }, MODEL_CONTENT: modelContent },
    },
    {
      name: "the MODEL_CONTENT document is missing",
      docs: { TIER: { keys: { tier: "dev" } } },
    },
    {
      name: "repo_url is missing",
      docs: {
        TIER: { keys: { tier: "dev" } },
        MODEL_CONTENT: { keys: { content_path: CONTENT_PATH } },
      },
    },
    {
      name: "content_path is missing",
      docs: { TIER: { keys: { tier: "dev" } }, MODEL_CONTENT: { keys: { repo_url: REPO_URL } } },
    },
  ])("should return null when $name", async ({ docs }) => {
    mockConfigurations(docs);
    expect(await configurationService.getModelContentURL()).toBeNull();
  });
});

describe("ConfigurationService.getModelContentTTLMinutes", () => {
  let configurationService;
  beforeEach(() => {
    configurationService = new ConfigurationService();
    jest.spyOn(configurationService.configurationDAO, "findByType").mockResolvedValue(null);
    jest
      .spyOn(console, "log")
      .mockImplementation(() => {})
      .mockClear();
    jest
      .spyOn(console, "error")
      .mockImplementation(() => {})
      .mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("when ttl_minutes is a positive integer", () => {
    const testCases = [
      {
        name: "should return the model content TTL minutes",
        keys: {
          ttl_minutes: 5,
        },
        expected: 5,
      },
      {
        name: "should return the stored TTL when a last TTL was also passed",
        keys: {
          ttl_minutes: 5,
        },
        lastTTLMinutes: 30,
        expected: 5,
      },
    ];

    it.each(testCases)("$name", async ({ keys, lastTTLMinutes, expected }) => {
      configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
      expect(await configurationService.getModelContentTTLMinutes(lastTTLMinutes)).toBe(expected);
      expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
        "MODEL_CONTENT"
      );
      expect(console.error).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe("when ttl_minutes is missing or invalid", () => {
    const testCases = [
      {
        name: "should default to 24 hours if ttl_minutes is not provided",
        keys: {},
      },
      {
        name: "should default to 24 hours if the configuration entry is not found",
        keys: null,
      },
      {
        name: "should default to 24 hours when ttl_minutes is a numeric string",
        keys: {
          ttl_minutes: "60",
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is not an integer",
        keys: {
          ttl_minutes: 1.5,
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is 0",
        keys: {
          ttl_minutes: 0,
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is negative",
        keys: {
          ttl_minutes: -5,
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is NaN",
        keys: {
          ttl_minutes: NaN,
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is Infinity",
        keys: {
          ttl_minutes: Infinity,
        },
      },
      {
        name: "should default to 24 hours when ttl_minutes is null",
        keys: {
          ttl_minutes: null,
        },
      },
    ];

    it.each(testCases)("$name", async ({ keys }) => {
      configurationService.configurationDAO.findByType.mockResolvedValue({ keys });
      expect(await configurationService.getModelContentTTLMinutes()).toBe(60 * 24);
      expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
        "MODEL_CONTENT"
      );
      expect(console.error.mock.calls).toEqual([
        ["Invalid MODEL_CONTENT ttl_minutes:", keys?.ttl_minutes],
        ["Using default TTL minutes:", 60 * 24],
      ]);
    });
  });

  describe("when ttl_minutes is invalid and a last TTL was passed", () => {
    it("should keep the last TTL", async () => {
      configurationService.configurationDAO.findByType.mockResolvedValue({
        keys: {
          ttl_minutes: "60",
        },
      });
      expect(await configurationService.getModelContentTTLMinutes(30)).toBe(30);
      expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
        "MODEL_CONTENT"
      );
      expect(console.error.mock.calls).toEqual([
        ["Invalid MODEL_CONTENT ttl_minutes:", "60"],
        ["Using cached TTL minutes:", 30],
      ]);
    });
  });

  describe("when the configuration lookup rejects and there is no last TTL", () => {
    it("should default to 24 hours", async () => {
      configurationService.configurationDAO.findByType.mockRejectedValue(new Error("db error"));
      expect(await configurationService.getModelContentTTLMinutes()).toBe(60 * 24);
      expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
        "MODEL_CONTENT"
      );
      expect(console.error.mock.calls).toEqual([
        ["Unable to read MODEL_CONTENT ttl_minutes:", expect.any(Error)],
        ["Invalid MODEL_CONTENT ttl_minutes:", undefined],
        ["Using default TTL minutes:", 60 * 24],
      ]);
    });
  });

  describe("when the configuration lookup rejects and there is a last TTL", () => {
    it("should keep the last TTL", async () => {
      configurationService.configurationDAO.findByType.mockRejectedValue(new Error("db error"));
      expect(await configurationService.getModelContentTTLMinutes(30)).toBe(30);
      expect(configurationService.configurationDAO.findByType).toHaveBeenCalledWith(
        "MODEL_CONTENT"
      );
      expect(console.error).toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
