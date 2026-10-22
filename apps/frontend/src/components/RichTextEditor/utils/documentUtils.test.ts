import type { Descendant } from "slate";

import * as utils from "./documentUtils";

describe("isTextNode", () => {
  it("should return true for a text node", () => {
    expect(utils.isTextNode({ text: "hello" })).toBe(true);
  });

  it("should return true for an empty text node", () => {
    expect(utils.isTextNode({ text: "" })).toBe(true);
  });

  it("should return false for an element node", () => {
    const node: Descendant = { type: "paragraph", children: [{ text: "" }] };

    expect(utils.isTextNode(node)).toBe(false);
  });
});

describe("isElementNode", () => {
  it("should return true for a paragraph element", () => {
    const node: Descendant = { type: "paragraph", children: [{ text: "" }] };

    expect(utils.isElementNode(node)).toBe(true);
  });

  it("should return true for a list element", () => {
    const node: Descendant = { type: "bulleted-list", children: [] };

    expect(utils.isElementNode(node)).toBe(true);
  });

  it("should return false for a text node", () => {
    expect(utils.isElementNode({ text: "hello" })).toBe(false);
  });
});

describe("createEmptyDocument", () => {
  it("should return a single paragraph with an empty text node", () => {
    const result = utils.createEmptyDocument();

    expect(result).toEqual([{ type: "paragraph", children: [{ text: "" }] }]);
  });

  it("should return a new array on each call", () => {
    const first = utils.createEmptyDocument();
    const second = utils.createEmptyDocument();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });
});

describe("normalizeTextChildren", () => {
  it("should return the same array when it has children", () => {
    const children = [{ text: "hello" }];

    expect(utils.normalizeTextChildren(children)).toBe(children);
  });

  it("should return an array with an empty text node when empty", () => {
    expect(utils.normalizeTextChildren([])).toEqual([{ text: "" }]);
  });
});

describe("createListElement", () => {
  it("should create a bulleted-list element with empty children", () => {
    const result = utils.createListElement("bulleted-list");

    expect(result).toEqual({ type: "bulleted-list", children: [] });
  });

  it("should create a numbered-list element with empty children", () => {
    const result = utils.createListElement("numbered-list");

    expect(result).toEqual({ type: "numbered-list", children: [] });
  });
});

describe("createListItem", () => {
  it("should create a list-item with an empty text node by default", () => {
    const result = utils.createListItem();

    expect(result).toEqual({ type: "list-item", children: [{ text: "" }] });
  });

  it("should create a list-item with the provided children", () => {
    const children = [{ text: "hello", bold: true as const }];

    const result = utils.createListItem(children);

    expect(result).toEqual({
      type: "list-item",
      children: [{ text: "hello", bold: true as const }],
    });
  });

  it("should not share a reference with the default text node", () => {
    const a = utils.createListItem();
    const b = utils.createListItem();

    expect(a.children[0]).not.toBe(b.children[0]);
  });
});

describe("isEditorEmpty", () => {
  it("should return true for an empty document", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "" }] }];

    expect(utils.isEditorEmpty(nodes)).toBe(true);
  });

  it("should return true for whitespace-only text", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "   " }] }];

    expect(utils.isEditorEmpty(nodes)).toBe(true);
  });

  it("should return false when text exists", () => {
    const nodes: Descendant[] = [{ type: "paragraph", children: [{ text: "hello" }] }];

    expect(utils.isEditorEmpty(nodes)).toBe(false);
  });

  it("should return false when text exists in nested elements", () => {
    const nodes: Descendant[] = [
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "item" }] }],
      },
    ];

    expect(utils.isEditorEmpty(nodes)).toBe(false);
  });

  it("should return true when nested elements have no text", () => {
    const nodes: Descendant[] = [
      {
        type: "bulleted-list",
        children: [{ type: "list-item", children: [{ text: "" }] }],
      },
    ];

    expect(utils.isEditorEmpty(nodes)).toBe(true);
  });

  it("should return true for an empty array", () => {
    expect(utils.isEditorEmpty([])).toBe(true);
  });
});
