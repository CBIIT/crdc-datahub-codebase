const fs = require("fs");
const https = require("https");
const path = require("path");

const { MDFReader } = require("mdf-reader");

const CURRENT_DEF_VERSION = "current-version";
const DEF_MODEL_FILES = "model-files";
const MODEL_CONTENT_FETCH_TIMEOUT_MS = 3000; // 3 seconds

class DataModelService {
  /**
   * Performs no I/O. hiddenDataModels starts empty, and lastTTLMinutes is unset until the first TTL read.
   * @param {function(): Promise<object>} dataModelInfo Fetches the data model manifest
   * @param {string} modelUrl URL of the data model manifest
   * @param {ConfigurationService} configurationService Source of MODEL_CONTENT settings
   */
  constructor(dataModelInfo, modelUrl, configurationService) {
    this.configurationService = configurationService;
    this.dataModelManifestInfo = dataModelInfo;
    this.modelDir = path.dirname(modelUrl);
    this.hiddenDataModels = [];
    this.lastTTLMinutes = undefined;
  }

  /**
   * Fetches the defined properties for a specific data common, version, and type.
   * @param {*} dataCommon
   * @param {*} version
   * @param {*} type
   * @returns Array
   */
  async getDefinedPropsByDataCommonAndType(dataCommon, version, type) {
    const dataModel = await this.getDataModelByDataCommonAndVersion(dataCommon, version);
    if (!dataModel) {
      return [];
    }
    const nodes = dataModel.nodes(type);
    if (!nodes || nodes.length === 0) {
      return [];
    }
    const definedProps = nodes?.props();
    return definedProps && definedProps.length > 0 ? definedProps : null;
  }

  /**
   * Fetches the data model based on the provided data common and version.
   * If version is not provided, it defaults to the current version defined in the model manifest.
   * @param {string} dataCommon - The common identifier for the data model.
   * @param {string} [version] - The specific version of the data model. If not provided, the current version will be used.
   * @returns
   * @throws {Error} - Throws an error if the data common is not provided or if the model definition cannot be found.
   */
  async getDataModelByDataCommonAndVersion(dataCommon, version) {
    if (!dataCommon) {
      return [];
    }
    const contents = await this.dataModelManifestInfo();
    if (!contents) {
      return [];
    }
    this.modelDefinition = contents[dataCommon];
    if (!version) {
      version = this.modelDefinition[CURRENT_DEF_VERSION];
    }

    const dataModelDir = path.join(this.modelDir, dataCommon, version);
    const dataModelFileNameArr = this.modelDefinition[DEF_MODEL_FILES];
    const dataModelFilePathArr = dataModelFileNameArr.map((fileName) =>
      path.join(dataModelDir, fileName)
    );

    const dataModelHold = [];
    // read data model files in github by http and MDFReader
    for (let index = 0; index < dataModelFilePathArr.length; index++) {
      const filePath = dataModelFilePathArr[index];
      if (filePath.startsWith("http")) {
        // read data model files in github by http
        const fileContent = new Promise((resolve, reject) => {
          https
            .get(filePath, (response) => {
              let data = "";
              response.on("data", (chunk) => {
                data += chunk;
              });
              response.on("end", () => {
                resolve(data);
              });
            })
            .on("error", (error) => {
              reject(error);
            });
        });
        dataModelHold.push(fileContent);
      } else {
        return [];
      }
    }

    if (dataModelHold.length === 0) {
      throw new Error(`Failed to find data model definition for ${dataCommon} version ${version}`);
    }

    const fileContents = await Promise.all(dataModelHold);
    return new MDFReader(...fileContents);
  }

  /**
   * Filters out hidden data models from the given list of data commons.
   * @param {string[]} dataCommonsList - The list of data commons to filter.
   * @returns {Promise<string[]>} The filtered list of data commons. Empty (without refreshing) for an empty or invalid list.
   */
  async removeHiddenDataModels(dataCommonsList) {
    if (!Array.isArray(dataCommonsList)) {
      console.warn("Hidden Model Filtering: Invalid data commons list; returning empty list");
      return [];
    }
    if (dataCommonsList.length === 0) {
      return [];
    }
    await this.refreshHiddenModels();
    if (!Array.isArray(this.hiddenDataModels)) {
      console.error(
        "Hidden Model Filtering: Invalid hidden data models list; returning original list"
      );
      return dataCommonsList;
    }
    return dataCommonsList.filter((dataCommon) => !this.hiddenDataModels.includes(dataCommon));
  }

  /**
   * Whether the given model is hidden.
   * @param {string} modelName Data model (data commons) name
   * @returns {Promise<boolean>}
   */
  async isModelHidden(modelName) {
    if (typeof modelName !== "string") {
      console.warn("Hidden Model Check: Invalid model name; returning true");
      return true;
    }
    await this.refreshHiddenModels();
    if (!Array.isArray(this.hiddenDataModels)) {
      console.error("Hidden Model Check: Invalid hidden data models list; returning false");
      return false;
    }
    return this.hiddenDataModels.includes(modelName);
  }

  /**
   * Reads the TTL from MODEL_CONTENT on every call, then refreshes the hidden models when the content has expired.
   * If the TTL read fails or is invalid, the last TTL read successfully is used (24 hours before any successful read).
   * A failed content fetch keeps hiddenDataModels and contentFetchDate unchanged.
   * @returns {Promise<void>}
   */
  async refreshHiddenModels() {
    try {
      const ttlMinutes = await this.configurationService.getModelContentTTLMinutes(
        this.lastTTLMinutes
      );
      this.lastTTLMinutes = ttlMinutes;
      if (
        this.contentFetchDate !== undefined &&
        !this._isContentExpired(this.contentFetchDate, ttlMinutes)
      ) {
        return;
      }
      console.log("Refreshing hidden models");
      const content = await this._fetchContent();
      if (content === null) {
        console.warn("Model content unavailable; keeping cached hidden models");
        return;
      }
      this._updateHiddenModels(content);
      this.contentFetchDate = new Date();
      console.log("Hidden models refreshed");
    } catch (error) {
      console.error("Unable to refresh hidden models; keeping cached hidden models:", error);
    }
  }

  async _fetchContent() {
    const contentURL = await this.configurationService.getModelContentURL();
    if (!contentURL) {
      return null;
    }
    try {
      const response = await fetch(contentURL, {
        signal: AbortSignal.timeout(MODEL_CONTENT_FETCH_TIMEOUT_MS),
      });
      if (!response?.ok) {
        console.error(`Unable to fetch model content from ${contentURL}: ${response?.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      if (error?.name === "TimeoutError") {
        console.error(
          `Timed out after ${MODEL_CONTENT_FETCH_TIMEOUT_MS}ms fetching model content from ${contentURL}`
        );
      } else {
        console.error(`Unable to fetch model content from ${contentURL}:`, error);
      }
      return null;
    }
  }

  _updateHiddenModels(content) {
    const hiddenDataModels = [];
    for (const [modelName, model] of Object.entries(content ?? {})) {
      if (model?.isHidden === true) {
        hiddenDataModels.push(modelName);
      }
    }
    this.hiddenDataModels = hiddenDataModels;
  }

  _isContentExpired(contentFetchDate, ttlMinutes) {
    try {
      if (!(contentFetchDate instanceof Date)) {
        throw new TypeError("Invalid contentFetchDate");
      }
      const ageMs = Date.now() - contentFetchDate.getTime();
      if (!Number.isFinite(ageMs)) {
        throw new TypeError("Invalid contentFetchDate");
      }
      if (typeof ttlMinutes !== "number" || !Number.isFinite(ttlMinutes)) {
        throw new TypeError("Invalid ttlMinutes");
      }
      const ttlMs = ttlMinutes * 60 * 1000;
      if (ageMs < ttlMs) {
        return false;
      }
    } catch {
      let fetchDateIsValid = false;
      try {
        fetchDateIsValid =
          contentFetchDate instanceof Date && Number.isFinite(contentFetchDate.getTime());
      } catch {
        fetchDateIsValid = false;
      }
      if (!fetchDateIsValid) {
        console.warn(
          "Invalid contentFetchDate; treating cached content as expired:",
          contentFetchDate
        );
      }
      if (typeof ttlMinutes !== "number" || !Number.isFinite(ttlMinutes)) {
        console.warn("Invalid ttlMinutes; treating cached content as expired:", ttlMinutes);
      }
    }
    return true;
  }
}

module.exports = DataModelService;
