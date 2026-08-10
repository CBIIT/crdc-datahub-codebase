import * as utils from "./linkUrlUtils";

describe("linkUrlUtils", () => {
  it("should keep full HTTPS URLs", () => {
    expect(utils.readUrl("https://www.google.com")).toBe("https://www.google.com");
  });

  it("should resolve bare domains to https", () => {
    expect(utils.readUrl("google.com")).toBe("https://google.com");
    expect(utils.readUrl("www.google.com")).toBe("https://www.google.com");
    expect(utils.readUrl("g.co")).toBe("https://g.co");
  });

  it("should keep paths, queries, and fragments", () => {
    expect(utils.readUrl("google.com/a/b?q=1#top")).toBe("https://google.com/a/b?q=1#top");
  });

  it("should not treat version-like values as URLs", () => {
    expect(utils.readUrl("1.2.3")).toBeNull();
  });

  it("should reject non-http schemes", () => {
    expect(utils.readUrl("mailto:test@example.com")).toBeNull();
    // eslint-disable-next-line no-script-url
    expect(utils.readUrl("javascript:alert(1)")).toBeNull();
    expect(utils.readUrl("ftp://example.com")).toBeNull();
  });

  it("should find a URL at the end of a line", () => {
    expect(utils.findTrailingUrl("visit google.com")).toEqual({
      index: 6,
      length: 10,
      url: "https://google.com",
    });
  });

  it("should not match a URL that is not the last word", () => {
    expect(utils.findTrailingUrl("google.com was down")).toBeNull();
  });

  it("should not match when the line ends with plain text", () => {
    expect(utils.findTrailingUrl("hello world")).toBeNull();
    expect(utils.findTrailingUrl("")).toBeNull();
  });
});
