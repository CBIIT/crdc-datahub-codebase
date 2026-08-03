import { findUrlCandidateAtTextEnd, findUrlCandidates, normalizeUrl } from "./linkUrlUtils";

describe("linkUrlUtils", () => {
  it("should normalize full HTTPS URLs", () => {
    expect(normalizeUrl("https://www.google.com")).toBe("https://www.google.com/");
  });

  it("should normalize www URLs", () => {
    expect(normalizeUrl("www.google.com")).toBe("https://www.google.com/");
  });

  it("should normalize fuzzy domain URLs", () => {
    expect(normalizeUrl("g.co")).toBe("https://g.co/");
  });

  it("should not treat version-like values as URLs", () => {
    expect(normalizeUrl("1.2.3")).toBeNull();
  });

  it("should not normalize mailto URLs", () => {
    expect(normalizeUrl("mailto:test@example.com")).toBeNull();
  });

  it("should not treat email addresses as URLs", () => {
    expect(normalizeUrl("test@example.com")).toBeNull();
    expect(findUrlCandidates("email me at test@example.com")).toEqual([]);
  });

  it("should find URLs inside plain text", () => {
    expect(findUrlCandidates("visit g.co and www.google.com")).toEqual([
      { rawText: "g.co", url: "https://g.co/", startIndex: 6, endIndex: 10 },
      { rawText: "www.google.com", url: "https://www.google.com/", startIndex: 15, endIndex: 29 },
    ]);
  });

  it("should find a URL candidate that ends at the text end", () => {
    expect(findUrlCandidateAtTextEnd("visit g.co")).toEqual({
      rawText: "g.co",
      url: "https://g.co/",
      startIndex: 6,
      endIndex: 10,
    });
  });
});
