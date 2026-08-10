import * as utils from "./editorGuards";

describe("isListFormat", () => {
  it("should return true for bulleted-list", () => {
    expect(utils.isListFormat("bulleted-list")).toBe(true);
  });

  it("should return true for numbered-list", () => {
    expect(utils.isListFormat("numbered-list")).toBe(true);
  });

  it("should return false for paragraph", () => {
    expect(utils.isListFormat("paragraph")).toBe(false);
  });

  it("should return false for list-item", () => {
    expect(utils.isListFormat("list-item")).toBe(false);
  });
});

describe("isListElement", () => {
  it("should return true for a bulleted-list element", () => {
    expect(utils.isListElement({ type: "bulleted-list", children: [] })).toBe(true);
  });

  it("should return true for a numbered-list element", () => {
    expect(utils.isListElement({ type: "numbered-list", children: [] })).toBe(true);
  });

  it("should return false for a paragraph element", () => {
    expect(utils.isListElement({ type: "paragraph", children: [] })).toBe(false);
  });

  it("should return false for a list-item element", () => {
    expect(utils.isListElement({ type: "list-item", children: [] })).toBe(false);
  });

  it("should return false for a text node", () => {
    expect(utils.isListElement({ text: "hello" })).toBe(false);
  });
});

describe("isLinkElement", () => {
  it("should return true for a link element", () => {
    expect(
      utils.isLinkElement({ type: "link", url: "https://g.co", children: [{ text: "g" }] })
    ).toBe(true);
  });

  it("should return false for a paragraph element", () => {
    expect(utils.isLinkElement({ type: "paragraph", children: [] })).toBe(false);
  });

  it("should return false for a list element", () => {
    expect(utils.isLinkElement({ type: "bulleted-list", children: [] })).toBe(false);
  });

  it("should return false for a text node", () => {
    expect(utils.isLinkElement({ text: "hello" })).toBe(false);
  });
});
