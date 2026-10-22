import * as utils from "./markdownDeserializer";

describe("deserializeFromMarkdown", () => {
  it("should return an empty document for an empty string", () => {
    expect(utils.deserializeFromMarkdown("")).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
  });

  it("should return an empty document for whitespace-only content", () => {
    expect(utils.deserializeFromMarkdown("   ")).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
  });

  it("should parse a plain text line into a paragraph", () => {
    expect(utils.deserializeFromMarkdown("hello")).toEqual([
      { type: "paragraph", children: [{ text: "hello" }] },
    ]);
  });

  it("should parse inline bold markdown within a paragraph", () => {
    expect(utils.deserializeFromMarkdown("**bold**")).toEqual([
      { type: "paragraph", children: [{ text: "bold", bold: true }] },
    ]);
  });

  it("should parse inline italic markdown within a paragraph", () => {
    expect(utils.deserializeFromMarkdown("_italic_")).toEqual([
      { type: "paragraph", children: [{ text: "italic", italic: true }] },
    ]);
  });

  it("should parse multiple paragraphs separated by blank lines", () => {
    expect(utils.deserializeFromMarkdown("first\n\nsecond")).toEqual([
      { type: "paragraph", children: [{ text: "first" }] },
      { type: "paragraph", children: [{ text: "second" }] },
    ]);
  });

  it("should parse a bulleted list", () => {
    expect(utils.deserializeFromMarkdown("- item one\n- item two")).toEqual([
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "item one" }] },
          { type: "list-item", children: [{ text: "item two" }] },
        ],
      },
    ]);
  });

  it("should parse a numbered list", () => {
    expect(utils.deserializeFromMarkdown("1. first\n2. second")).toEqual([
      {
        type: "numbered-list",
        children: [
          { type: "list-item", children: [{ text: "first" }] },
          { type: "list-item", children: [{ text: "second" }] },
        ],
      },
    ]);
  });

  it("should parse a paragraph followed by a list", () => {
    expect(utils.deserializeFromMarkdown("intro\n- a\n- b")).toEqual([
      { type: "paragraph", children: [{ text: "intro" }] },
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "a" }] },
          { type: "list-item", children: [{ text: "b" }] },
        ],
      },
    ]);
  });

  it("should parse a list followed by a paragraph", () => {
    expect(utils.deserializeFromMarkdown("- a\n- b\nafter")).toEqual([
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "a" }] },
          { type: "list-item", children: [{ text: "b" }] },
        ],
      },
      { type: "paragraph", children: [{ text: "after" }] },
    ]);
  });

  it("should parse inline marks within list items", () => {
    expect(utils.deserializeFromMarkdown("- **bold item**\n- _italic item_")).toEqual([
      {
        type: "bulleted-list",
        children: [
          { type: "list-item", children: [{ text: "bold item", bold: true }] },
          { type: "list-item", children: [{ text: "italic item", italic: true }] },
        ],
      },
    ]);
  });

  it("should skip empty lines between content", () => {
    expect(utils.deserializeFromMarkdown("first\n\n\nsecond")).toEqual([
      { type: "paragraph", children: [{ text: "first" }] },
      { type: "paragraph", children: [{ text: "second" }] },
    ]);
  });

  it("should handle Windows-style line endings", () => {
    expect(utils.deserializeFromMarkdown("first\r\nsecond")).toEqual([
      { type: "paragraph", children: [{ text: "first" }] },
      { type: "paragraph", children: [{ text: "second" }] },
    ]);
  });

  it("should return an empty document when all lines are blank", () => {
    expect(utils.deserializeFromMarkdown("\n\n\n")).toEqual([
      { type: "paragraph", children: [{ text: "" }] },
    ]);
  });

  it("should parse a single list item", () => {
    expect(utils.deserializeFromMarkdown("- only")).toEqual([
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "only" }] }],
      },
    ]);
  });

  it("should parse a bulleted list using asterisk syntax", () => {
    expect(utils.deserializeFromMarkdown("* item")).toEqual([
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "item" }] }],
      },
    ]);
  });
});
