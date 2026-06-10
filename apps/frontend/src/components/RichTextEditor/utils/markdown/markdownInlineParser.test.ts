import * as utils from "./markdownInlineParser";

describe("parseMarkdownInline", () => {
  it("should return an empty array for empty string", () => {
    expect(utils.parseMarkdownInline("")).toEqual([]);
  });

  it("should return a default text node for plain text", () => {
    expect(utils.parseMarkdownInline("hello")).toEqual([{ text: "hello" }]);
  });

  it("should parse bold markdown", () => {
    expect(utils.parseMarkdownInline("**bold**")).toEqual([{ text: "bold", bold: true }]);
  });

  it("should parse italic markdown with underscores", () => {
    expect(utils.parseMarkdownInline("_italic_")).toEqual([{ text: "italic", italic: true }]);
  });

  it("should parse italic markdown with asterisks", () => {
    expect(utils.parseMarkdownInline("*italic*")).toEqual([{ text: "italic", italic: true }]);
  });

  it("should parse underline markdown", () => {
    expect(utils.parseMarkdownInline("<u>underline</u>")).toEqual([
      { text: "underline", underline: true },
    ]);
  });

  it("should parse bold and italic together", () => {
    expect(utils.parseMarkdownInline("**_bold italic_**")).toEqual([
      { text: "bold italic", bold: true, italic: true },
    ]);
  });

  it("should parse mixed plain text and marks", () => {
    expect(utils.parseMarkdownInline("hello **world**")).toEqual([
      { text: "hello " },
      { text: "world", bold: true },
    ]);
  });

  it("should parse multiple different marks in sequence", () => {
    expect(utils.parseMarkdownInline("**bold** _italic_")).toEqual([
      { text: "bold", bold: true },
      { text: " " },
      { text: "italic", italic: true },
    ]);
  });

  it("should merge adjacent nodes with the same marks", () => {
    expect(utils.parseMarkdownInline("hello world")).toEqual([{ text: "hello world" }]);
  });

  it("should decode HTML entities", () => {
    expect(utils.parseMarkdownInline("&amp;")).toEqual([{ text: "&" }]);
    expect(utils.parseMarkdownInline("&lt;")).toEqual([{ text: "<" }]);
    expect(utils.parseMarkdownInline("&gt;")).toEqual([{ text: ">" }]);
  });

  it("should decode escaped markdown characters", () => {
    expect(utils.parseMarkdownInline("\\*")).toEqual([{ text: "*" }]);
    expect(utils.parseMarkdownInline("\\_")).toEqual([{ text: "_" }]);
    expect(utils.parseMarkdownInline("\\\\")).toEqual([{ text: "\\" }]);
  });

  it("should decode &nbsp; entities", () => {
    expect(utils.parseMarkdownInline("&nbsp;")).toEqual([{ text: " " }]);
  });

  it("should inherit marks from the parent context", () => {
    expect(utils.parseMarkdownInline("hello", { bold: true })).toEqual([
      { text: "hello", bold: true },
    ]);
  });

  it("should combine inherited marks with parsed marks", () => {
    expect(utils.parseMarkdownInline("**bold**", { italic: true })).toEqual([
      { text: "bold", bold: true, italic: true },
    ]);
  });

  it("should parse nested marks", () => {
    expect(utils.parseMarkdownInline("_**nested**_")).toEqual([
      { text: "nested", italic: true, bold: true },
    ]);
  });

  it("should parse bold wrapping underline", () => {
    expect(utils.parseMarkdownInline("**<u>both</u>**")).toEqual([
      { text: "both", bold: true, underline: true },
    ]);
  });

  it("should parse all three marks nested", () => {
    expect(utils.parseMarkdownInline("**_<u>all</u>_**")).toEqual([
      { text: "all", bold: true, italic: true, underline: true },
    ]);
  });

  it("should handle a single special character", () => {
    expect(utils.parseMarkdownInline("<")).toEqual([{ text: "<" }]);
  });

  it("should handle text with marks followed by plain text", () => {
    expect(utils.parseMarkdownInline("**bold** and plain")).toEqual([
      { text: "bold", bold: true },
      { text: " and plain" },
    ]);
  });

  it("should handle plain text followed by marks", () => {
    expect(utils.parseMarkdownInline("plain and **bold**")).toEqual([
      { text: "plain and " },
      { text: "bold", bold: true },
    ]);
  });
});
