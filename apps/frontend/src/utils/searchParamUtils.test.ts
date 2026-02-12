import { generateSearchParameters } from "./searchParamUtils";

describe("generateSearchParameters", () => {
  it("sets new search parameters when they differ from defaults", () => {
    const initialSearchParams = new URLSearchParams();
    const currentParams = { page: 2, sort: "name" };
    const defaultParams = { page: 1, sort: "date" };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.get("page")).toEqual("2");
    expect(result.get("sort")).toEqual("name");
  });

  it("does not set a parameter if it matches the default value", () => {
    const initialSearchParams = new URLSearchParams();
    const currentParams = { page: 1, sort: "date" };
    const defaultParams = { page: 1, sort: "date" };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.has("page")).toBeFalsy();
    expect(result.has("sort")).toBeFalsy();
  });

  it("removes parameters that are set to the default value when already existing", () => {
    const initialSearchParams = new URLSearchParams({ page: "1", sort: "date" });
    const currentParams = { page: 1, sort: "date" };
    const defaultParams = { page: 1, sort: "date" };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.has("page")).toBeFalsy();
    expect(result.has("sort")).toBeFalsy();
  });

  it("keeps parameters unchanged if they are not included in current or default params", () => {
    const initialSearchParams = new URLSearchParams({ filter: "active" });
    const currentParams = { page: 2 };
    const defaultParams = { page: 1 };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.get("page")).toEqual("2");
    expect(result.get("filter")).toEqual("active");
  });

  it("correctly processes mixed types, treating numbers and strings equivalently where appropriate", () => {
    const initialSearchParams = new URLSearchParams();
    const currentParams = { page: 1, size: "10" };
    const defaultParams = { page: "1", size: 10 };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.has("page")).toBeFalsy();
    expect(result.has("size")).toBeFalsy();
  });

  it("deletes parameters when the current value is undefined", () => {
    const initialSearchParams = new URLSearchParams({ page: "1" });
    const currentParams = { page: undefined };
    const defaultParams = { page: 1 };

    const result = generateSearchParameters(initialSearchParams, currentParams, defaultParams);

    expect(result.has("page")).toBeFalsy();
  });
});
