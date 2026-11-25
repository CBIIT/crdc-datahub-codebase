const DataModelService = require("../../services/data-model-service");

describe("DataModelService.getDataModelByDataCommonAndVersion", () => {
  const CONTENT_URL =
    "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/refs/heads/dev/cache/content.json";
  let configurationService;
  let dataModelInfo;
  let service;

  beforeEach(() => {
    configurationService = { getModelContentURL: jest.fn().mockResolvedValue(CONTENT_URL) };
    dataModelInfo = jest.fn().mockResolvedValue(null);
    service = new DataModelService(dataModelInfo, configurationService);
  });

  it("should resolve to an empty array when the data common is missing", async () => {
    await expect(service.getDataModelByDataCommonAndVersion(undefined, "1.0.0")).resolves.toEqual(
      []
    );
  });

  it("should reject when the model content URL is not configured", async () => {
    configurationService.getModelContentURL.mockResolvedValue(null);
    await expect(service.getDataModelByDataCommonAndVersion("CDS", "1.0.0")).rejects.toThrow(
      "the model content URL is not configured"
    );
  });

  it("should resolve to an empty array when the manifest is missing", async () => {
    await expect(service.getDataModelByDataCommonAndVersion("CDS", "1.0.0")).resolves.toEqual([]);
  });
});
