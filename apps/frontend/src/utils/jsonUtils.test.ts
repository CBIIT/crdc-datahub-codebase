import { safeParse } from "./jsonUtils";

describe("safeParse cases", () => {
  it("should parse valid JSON", () => {
    const json = '{"key": "value"}';
    expect(safeParse(json)).toEqual({ key: "value" });
  });

  it("should return an empty object for invalid JSON", () => {
    const json = "{key: value}";
    expect(safeParse(json)).toEqual({});
  });

  it("should return the fallback value for invalid JSON", () => {
    const json = "{key: value}";
    const fallback = { fallback: "value" };
    expect(safeParse(json, fallback)).toEqual(fallback);
  });

  it("should parse valid JSON arrays", () => {
    const json = "[1, 2, 3]";
    expect(safeParse(json)).toEqual([1, 2, 3]);
  });

  it("should return an empty object for invalid JSON arrays", () => {
    const json = "[1, 2,";
    expect(safeParse(json)).toEqual({});
  });

  it("should return the fallback value for undefined", () => {
    const json = undefined;
    const fallback = { fallback: "value" };
    expect(safeParse(json, fallback)).toEqual(fallback);
  });

  it("should return the fallback value for null", () => {
    const json = null;
    const fallback = { fallback: "value" };
    expect(safeParse(json, fallback)).toEqual(fallback);
  });
});
