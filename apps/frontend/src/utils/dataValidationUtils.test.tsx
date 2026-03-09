import * as utils from "./dataValidationUtils";

describe("getValidationTypes cases", () => {
  it("should return metadata", () => {
    expect(utils.getValidationTypes("metadata")).toEqual(["metadata"]);
  });

  it("should return file", () => {
    expect(utils.getValidationTypes("file")).toEqual(["file"]);
  });

  it("should return metadata and file (All)", () => {
    expect(utils.getValidationTypes("All")).toEqual(["metadata", "file"]);
  });

  it("should return metadata and file (Fall-through)", () => {
    expect(utils.getValidationTypes("" as ValidationType)).toEqual(["metadata", "file"]);
  });
});
