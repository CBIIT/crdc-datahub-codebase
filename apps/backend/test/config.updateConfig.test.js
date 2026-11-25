const ConfigurationDAO = require("../dao/configuration");
const config = require("../config");

const MODEL_CONTENT = {
  keys: {
    repo_url: "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models",
    content_path: "cache/content.json",
  },
};
const TIER = { keys: { tier: "dev" } };

describe("config.updateConfig required model content configuration", () => {
  /**
   * Mocks the configuration DAO by configuration type; other types resolve to null.
   * @param {object} docs Map of configuration type to document
   */
  const mockConfigurations = (docs) => {
    jest
      .spyOn(ConfigurationDAO.prototype, "findByType")
      .mockImplementation(async (type) => docs[type] ?? null);
    jest.spyOn(ConfigurationDAO.prototype, "findManyByType").mockResolvedValue([]);
  };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should resolve when TIER and MODEL_CONTENT are present", async () => {
    mockConfigurations({ TIER, MODEL_CONTENT });
    await expect(config.updateConfig()).resolves.toMatchObject({
      tier: "[DEV]",
      email_content_branch: "dev",
    });
  });

  it.each([
    { name: "TIER is missing", docs: { MODEL_CONTENT } },
    {
      name: "TIER is empty after sanitizing",
      docs: { TIER: { keys: { tier: "--" } }, MODEL_CONTENT },
    },
    { name: "MODEL_CONTENT is missing", docs: { TIER } },
    {
      name: "repo_url is missing",
      docs: { TIER, MODEL_CONTENT: { keys: { content_path: "cache/content.json" } } },
    },
    {
      name: "content_path is missing",
      docs: {
        TIER,
        MODEL_CONTENT: { keys: { repo_url: MODEL_CONTENT.keys.repo_url } },
      },
    },
  ])("should reject when $name", async ({ docs }) => {
    mockConfigurations(docs);
    await expect(config.updateConfig()).rejects.toThrow("Missing required configuration");
  });
});
