import type { Descendant } from "slate";

import { BLOCK_DEFINITIONS } from "@/config/EditorConfig";

import type { BlockDefinition, ListItemElement } from "../../types";
import { createEmptyDocument, createListItem } from "../documentUtils";

import { parseMarkdownInline } from "./markdownInlineParser";

type MarkdownBlockResult = {
  nodes: Descendant[];
  nextLineIndex: number;
};

/**
 * Extracts the text content from a list item line using the given pattern.
 *
 * @param {string} line - The raw markdown line.
 * @param {RegExp} pattern - The pattern to match and extract content from.
 * @returns {string | null} The captured text content, or `null` if the line doesn't match.
 *
 * @example
 * getListItemContent("- hello", /^[-*]\s+(.+)$/); // "hello"
 */
const getListItemContent = (line: string, pattern: RegExp): string | null => {
  const match = line.match(pattern);

  if (!match) {
    return null;
  }

  return match[1];
};

/**
 * Reads consecutive list item lines into a single list block node.
 *
 * @param {string[]} lines - All lines in the markdown document.
 * @param {number} startLineIndex - The index of the first list item line.
 * @param {BlockDefinition} listDefinition - The block definition for the list format.
 * @returns {MarkdownBlockResult} The list node(s) and the next line index to process.
 *
 * @example
 * readMarkdownListBlock(["- a", "- b", "text"], 0, bulletedDef);
 * // { nodes: [{ type: "bulleted-list", children: [...] }], nextLineIndex: 2 }
 */
const readMarkdownListBlock = (
  lines: string[],
  startLineIndex: number,
  listDefinition: BlockDefinition
): MarkdownBlockResult => {
  const items: ListItemElement[] = [];
  let lineIndex = startLineIndex;

  while (lineIndex < lines.length) {
    const itemContent = getListItemContent(lines[lineIndex], listDefinition.pattern);

    if (itemContent === null) {
      break;
    }

    items.push(createListItem(parseMarkdownInline(itemContent)));
    lineIndex += 1;
  }

  return {
    nodes: [{ type: listDefinition.format, children: items }],
    nextLineIndex: lineIndex,
  };
};

/**
 * Reads a single block (paragraph, list, or empty line) from the markdown lines.
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
  const listDefinition = BLOCK_DEFINITIONS.find(({ pattern }) => pattern.test(line)) ?? null;

  if (listDefinition) {
    return readMarkdownListBlock(lines, lineIndex, listDefinition);
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

  const nodes = readMarkdownDocument(content.split(/\r?\n/));

  if (nodes.length > 0) {
    return nodes;
  }

  return createEmptyDocument();
};
