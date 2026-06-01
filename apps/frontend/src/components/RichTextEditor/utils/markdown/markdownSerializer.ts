import { Descendant, Element, Text } from "slate";

import type { FormattedText, ListItemElement, TextMarks } from "../../types";

/**
 * Escapes markdown control characters that are supported by this editor.
 */
export const escapeMarkdownText = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_");

/**
 * Applies markdown-compatible formatting marks to a plain text value.
 */
export const applyMarkdownMarks = (text: string, marks: TextMarks): string => {
  let markedText = escapeMarkdownText(text);

  if (marks.bold) {
    markedText = `**${markedText}**`;
  }

  if (marks.italic) {
    markedText = `_${markedText}_`;
  }

  if (marks.underline) {
    markedText = `<u>${markedText}</u>`;
  }

  return markedText;
};

const serializeMarkdownText = ({ text, bold, italic, underline }: FormattedText): string =>
  applyMarkdownMarks(text, { bold, italic, underline });

const serializeTextChildren = (children: FormattedText[]): string =>
  children.map(serializeMarkdownText).join("");

const serializeBulletListItem = (item: ListItemElement): string =>
  `- ${serializeTextChildren(item.children)}`;

const serializeNumberedListItem = (item: ListItemElement, itemIndex: number): string =>
  `${itemIndex + 1}. ${serializeTextChildren(item.children)}`;

const serializeMarkdownBlock = (node: Descendant): string => {
  if (Text.isText(node)) {
    return node.text;
  }

  if (!Element.isElement(node)) {
    return "";
  }

  if (node.type === "paragraph") {
    return serializeTextChildren(node.children);
  }

  if (node.type === "bulleted-list") {
    return node.children.map(serializeBulletListItem).join("\n");
  }

  if (node.type === "numbered-list") {
    return node.children.map(serializeNumberedListItem).join("\n");
  }

  return "";
};

/**
 * Converts a Slate rich-text value into the markdown subset used for storage.
 */
export const serializeToMarkdown = (nodes: Descendant[]): string =>
  nodes.map(serializeMarkdownBlock).filter(Boolean).join("\n\n").trimEnd();
