import type { Descendant } from "slate";

import type { ListFormat, ListItemElement } from "../../types";
import { createEmptyDocument, createListItem } from "../documentUtils";

import { parseMarkdownInline } from "./markdownInlineParser";
import { normalizeLineEndings, readListLine } from "./markdownUtils";

type MarkdownBlockResult = {
  nodes: Descendant[];
  nextLineIndex: number;
};

/**
 * Reads consecutive list item lines into a single list block node.
 *
 * @param {string[]} lines - All lines in the markdown document.
 * @param {number} startLineIndex - The index of the first list item line.
 * @param {ListFormat} format - The list format to read.
 * @returns {MarkdownBlockResult} The list node(s) and the next line index to process.
 *
 * @example
 * readMarkdownListBlock(["- a", "- b", "text"], 0, "bulleted-list");
 * // { nodes: [{ type: "bulleted-list", children: [...] }], nextLineIndex: 2 }
 */
const readMarkdownListBlock = (
  lines: string[],
  startLineIndex: number,
  format: ListFormat
): MarkdownBlockResult => {
  const items: ListItemElement[] = [];
  let lineIndex = startLineIndex;

  while (lineIndex < lines.length) {
    const listLine = readListLine(lines[lineIndex]);

    if (!listLine || listLine.format !== format) {
      break;
    }

    items.push(createListItem(parseMarkdownInline(listLine.content)));
    lineIndex += 1;
  }

  return {
    nodes: [{ type: format, children: items }],
    nextLineIndex: lineIndex,
  };
};

/**
 * Reads a single block from the markdown lines.
 *
 * @param {string[]} lines - All lines in the markdown document.
 * @param {number} lineIndex - The current line index to process.
 * @returns {MarkdownBlockResult} The parsed node(s) and the next line index.
 *
 * @example
 * readMarkdownBlock(["hello"], 0); // { nodes: [{ type: "paragraph", ... }], nextLineIndex: 1 }
 */
const readMarkdownBlock = (lines: string[], lineIndex: number): MarkdownBlockResult => {
  const line = lines[lineIndex];
  const listLine = readListLine(line);

  if (listLine) {
    return readMarkdownListBlock(lines, lineIndex, listLine.format);
  }

  if (line.trim() === "") {
    return {
      nodes: [],
      nextLineIndex: lineIndex + 1,
    };
  }

  return {
    nodes: [{ type: "paragraph", children: parseMarkdownInline(line) }],
    nextLineIndex: lineIndex + 1,
  };
};

/**
 * Parses all lines of a markdown document into Slate nodes.
 *
 * @param {string[]} lines - The lines of the markdown document.
 * @returns {Descendant[]} The parsed Slate document nodes.
 *
 * @example
 * readMarkdownDocument(["hello", "", "- item"]); // [paragraph, bulleted-list]
 */
const readMarkdownDocument = (lines: string[]): Descendant[] => {
  const nodes: Descendant[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const block = readMarkdownBlock(lines, lineIndex);

    nodes.push(...block.nodes);
    lineIndex = block.nextLineIndex;
  }

  return nodes;
};

/**
 * Converts stored markdown rich-text content into a Slate value.
 *
 * @param {string} content - The stored markdown string.
 * @returns {Descendant[]} The Slate document nodes.
 *
 * @example
 * deserializeFromMarkdown("**hello**"); // [{ type: "paragraph", children: [{ text: "hello", bold: true }] }]
 * deserializeFromMarkdown(""); // [{ type: "paragraph", children: [{ text: "" }] }]
 */
export const deserializeFromMarkdown = (content: string): Descendant[] => {
  if (!content.trim()) {
    return createEmptyDocument();
  }

  const nodes = readMarkdownDocument(normalizeLineEndings(content).split("\n"));

  if (nodes.length > 0) {
    return nodes;
  }

  return createEmptyDocument();
};
