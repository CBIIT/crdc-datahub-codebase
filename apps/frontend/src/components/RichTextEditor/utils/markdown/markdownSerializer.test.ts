import type { Descendant } from "slate";

import * as utils from "./markdownSerializer";

describe("escapeMarkdownText", () => {
  it("should escape ampersands", () => {
    expect(utils.escapeMarkdownText("a & b")).toBe("a &amp; b");
  });

  it("should escape angle brackets", () => {
    expect(utils.escapeMarkdownText("<div>")).toBe("&lt;div&gt;");
  });

  it("should escape backslashes", () => {
    expect(utils.escapeMarkdownText("a\\b")).toBe("a\\\\b");
  });

  it("should escape asterisks", () => {
    expect(utils.escapeMarkdownText("2 * 3")).toBe("2 \\* 3");
  });

  it("should escape underscores", () => {
    expect(utils.escapeMarkdownText("a_b")).toBe("a\\_b");
  });

  it("should return plain text unchanged", () => {
    expect(utils.escapeMarkdownText("hello world")).toBe("hello world");
  });

  it("should handle empty string", () => {
    expect(utils.escapeMarkdownText("")).toBe("");
  });
});

describe("applyMarkdownMarks", () => {
  it("should wrap text in bold syntax", () => {
    expect(utils.applyMarkdownMarks("hello", { bold: true })).toBe("**hello**");
  });

  it("should wrap text in italic syntax", () => {
    expect(utils.applyMarkdownMarks("hello", { italic: true })).toBe("_hello_");
  });

  it("should wrap text in underline syntax", () => {
    expect(utils.applyMarkdownMarks("hello", { underline: true })).toBe("<u>hello</u>");
  });

  it("should apply multiple marks", () => {
    expect(utils.applyMarkdownMarks("hello", { bold: true, italic: true })).toBe("_**hello**_");
  });

  it("should preserve leading whitespace as &nbsp;", () => {
    expect(utils.applyMarkdownMarks("  hello", { bold: true })).toBe("&nbsp;&nbsp;**hello**");
  });

  it("should preserve trailing whitespace as &nbsp;", () => {
    expect(utils.applyMarkdownMarks("hello  ", { bold: true })).toBe("**hello**&nbsp;&nbsp;");
  });

  it("should return preserved whitespace for whitespace-only text", () => {
    expect(utils.applyMarkdownMarks("  ", {})).toBe("&nbsp;&nbsp;");
  });

  it("should return plain text when no marks are active", () => {
    expect(utils.applyMarkdownMarks("hello", {})).toBe("hello");
  });

  it("should escape special characters in marked text", () => {
    expect(utils.applyMarkdownMarks("a & b", { bold: true })).toBe("**a &amp; b**");
  });
});

describe("serializeToMarkdown", () => {
  it("should serialize a paragraph", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "hello" }] }];

    expect(utils.serializeToMarkdown(nodes)).toBe("hello");
  });

  it("should serialize bold text", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "hello", bold: true }] }];

    expect(utils.serializeToMarkdown(nodes)).toBe("**hello**");
  });

  it("should serialize italic text", () => {
    const nodes: Descendant[] = [
      { type: "paragraph", children: [{ text: "hello", italic: true }] },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("_hello_");
  });

  it("should serialize underline text", () => {
    const nodes: Descendant[] = [
      { type: "paragraph", children: [{ text: "hello", underline: true }] },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("<u>hello</u>");
  });

  it("should serialize mixed inline formatting", () => {
    const nodes: Descendant[] = [
      {
        type: "paragraph",
        children: [
          { text: "plain " },
          { text: "bold", bold: true },
          { text: " and " },
          { text: "italic", italic: true },
        ],
      },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("plain&nbsp;**bold**&nbsp;and&nbsp;_italic_");
  });

  it("should serialize a bulleted list", () => {
    const nodes: Descendant[] = [
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "first" }] },
          { type: "list-item", children: [{ text: "second" }] },
        ],
      },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("- first\n- second");
  });

  it("should serialize a numbered list", () => {
    const nodes: Descendant[] = [
      {
        type: "numbered-list",
        children: [
          { type: "list-item", children: [{ text: "first" }] },
          { type: "list-item", children: [{ text: "second" }] },
        ],
      },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("1. first\n2. second");
  });

  it("should separate multiple blocks with double newlines", () => {
    const nodes: Descendant[] = [
      { type: "paragraph", children: [{ text: "first" }] },
      { type: "paragraph", children: [{ text: "second" }] },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("first\n\nsecond");
  });

  it("should skip empty paragraphs", () => {
    const nodes: Descendant[] = [
      { type: "paragraph", children: [{ text: "hello" }] },
      { type: "paragraph", children: [{ text: "" }] },
    ];

    expect(utils.serializeToMarkdown(nodes)).toBe("hello");
  });

  it("should trim trailing whitespace", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "hello   " }] }];

    expect(utils.serializeToMarkdown(nodes)).not.toMatch(/\s$/);
  });

  it("should escape special characters in plain text nodes", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "a * b" }] }];

    expect(utils.serializeToMarkdown(nodes)).toBe("a \\* b");
  });
});

describe("getPlainTextLength", () => {
  it("should return 0 for empty string", () => {
    expect(utils.getPlainTextLength("")).toBe(0);
  });

  it("should return 0 for whitespace-only string", () => {
    expect(utils.getPlainTextLength("   ")).toBe(0);
  });

  it("should return 0 for null-ish content", () => {
    expect(utils.getPlainTextLength(null as unknown as string)).toBe(0);
  });

  it("should strip bold syntax", () => {
    expect(utils.getPlainTextLength("**bold**")).toBe(4);
  });

  it("should strip italic asterisk syntax", () => {
    expect(utils.getPlainTextLength("*italic*")).toBe(6);
  });

  it("should strip italic underscore syntax", () => {
    expect(utils.getPlainTextLength("_italic_")).toBe(6);
  });

  it("should strip underline syntax", () => {
    expect(utils.getPlainTextLength("<u>underline</u>")).toBe(9);
  });

  it("should strip bulleted list prefix", () => {
    expect(utils.getPlainTextLength("- item")).toBe(4);
  });

  it("should strip numbered list prefix", () => {
    expect(utils.getPlainTextLength("1. item")).toBe(4);
  });

  it("should unescape escaped characters", () => {
    expect(utils.getPlainTextLength("a \\* b")).toBe(5);
  });

  it("should return the correct length for plain text", () => {
    expect(utils.getPlainTextLength("hello world")).toBe(11);
  });
});
