import type { Descendant } from "slate";

import type { ListFormat, ListItemElement } from "../../types";
import { createEmptyDocument, createListItem } from "../documentUtils";

import { parseMarkdownInline } from "./markdownInlineParser";

type MarkdownBlockResult = {
  nodes: Descendant[];
  nextLineIndex: number;
};

type MarkdownListDefinition = {
  format: ListFormat;
  pattern: RegExp;
};

const BULLETED_LIST_DEFINITION: MarkdownListDefinition = {
  format: "bulleted-list",
  pattern: /^[-*]\s+(.+)$/,
};

const NUMBERED_LIST_DEFINITION: MarkdownListDefinition = {
  format: "numbered-list",
  pattern: /^\d+\.\s+(.+)$/,
};

const getListItemContent = (line: string, pattern: RegExp): string | null => {
  const match = line.match(pattern);

  if (!match) {
    return null;
  }

  return match[1];
};

const findListDefinition = (line: string): MarkdownListDefinition | null => {
  if (BULLETED_LIST_DEFINITION.pattern.test(line)) {
    return BULLETED_LIST_DEFINITION;
  }

  if (NUMBERED_LIST_DEFINITION.pattern.test(line)) {
    return NUMBERED_LIST_DEFINITION;
  }

  return null;
};

const readMarkdownListBlock = (
  lines: string[],
  startLineIndex: number,
  listDefinition: MarkdownListDefinition
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

const readMarkdownBlock = (lines: string[], lineIndex: number): MarkdownBlockResult => {
  const line = lines[lineIndex];
  const listDefinition = findListDefinition(line);

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
