import * as utils from "./markdownUtils";

describe("normalizeLineEndings", () => {
  it("should convert CRLF to LF", () => {
    expect(utils.normalizeLineEndings("a\r\nb")).toBe("a\nb");
  });

  it("should convert CR to LF", () => {
    expect(utils.normalizeLineEndings("a\rb")).toBe("a\nb");
  });

  it("should leave LF unchanged", () => {
    expect(utils.normalizeLineEndings("a\nb")).toBe("a\nb");
  });

  it("should handle mixed line endings", () => {
    expect(utils.normalizeLineEndings("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("should return an empty string unchanged", () => {
    expect(utils.normalizeLineEndings("")).toBe("");
  });
});

describe("readListLine", () => {
  it("should parse a '-' bulleted list line", () => {
    expect(utils.readListLine("- item")).toEqual({ format: "bulleted-list", content: "item" });
  });

  it("should parse a '*' bulleted list line", () => {
    expect(utils.readListLine("* item")).toEqual({ format: "bulleted-list", content: "item" });
  });

  it("should parse a single-digit numbered list line", () => {
    expect(utils.readListLine("1. first")).toEqual({ format: "numbered-list", content: "first" });
  });

  it("should parse a multi-digit numbered list line", () => {
    expect(utils.readListLine("12. item")).toEqual({ format: "numbered-list", content: "item" });
  });

  it("should return null for a plain text line", () => {
    expect(utils.readListLine("hello world")).toBeNull();
  });

  it("should return null for a bullet marker without a trailing space", () => {
    expect(utils.readListLine("-item")).toBeNull();
  });

  it("should return null for a number without a dot separator", () => {
    expect(utils.readListLine("1 item")).toBeNull();
  });

  it("should return null for a number with a dot but no trailing space", () => {
    expect(utils.readListLine("1.item")).toBeNull();
  });

  it("should return null for an empty string", () => {
    expect(utils.readListLine("")).toBeNull();
  });

  it("should preserve inline markdown in the content", () => {
    expect(utils.readListLine("- **bold** item")).toEqual({
      format: "bulleted-list",
      content: "**bold** item",
    });
  });
});
