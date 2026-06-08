import type { Descendant } from "slate";

import * as utils from "./documentUtils";

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
