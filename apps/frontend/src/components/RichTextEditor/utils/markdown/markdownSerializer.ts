import { Descendant, Element, Text } from "slate";

import type { FormattedText, ListItemElement, TextMarks } from "../../types";

const SURROUNDING_WHITESPACE_PATTERN = /^([ \t]*)(.*?)([ \t]*)$/s;

const HTML_TEXT_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const MARKDOWN_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "\\": "\\\\",
  "*": "\\*",
  _: "\\_",
};

/**
 * Escapes text for the markdown/HTML subset.
 */
export const escapeMarkdownText = (text: string): string => {
  const htmlPattern = new RegExp(
    Object.keys(HTML_TEXT_ESCAPE_REPLACEMENTS)
      .map((k) => k.replace(/[&<>]/g, "\\$&"))
      .join("|"),
    "g"
  );
  const markdownPattern = new RegExp(
    Object.keys(MARKDOWN_ESCAPE_REPLACEMENTS)
      .map((k) => k.replace(/[\\*_]/g, "\\$&"))
      .join("|"),
    "g"
  );

  return text
    .replace(htmlPattern, (character) => HTML_TEXT_ESCAPE_REPLACEMENTS[character])
    .replace(markdownPattern, (character) => MARKDOWN_ESCAPE_REPLACEMENTS[character]);
};

/**
 * Preserves indentation in markdown output.
 */
const serializePreservedWhitespace = (whitespace: string): string =>
  whitespace.replace(/ /g, "&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

const splitSurroundingWhitespace = (
  text: string
): { leadingWhitespace: string; markableText: string; trailingWhitespace: string } => {
  const match = SURROUNDING_WHITESPACE_PATTERN.exec(text);

  if (!match) {
    return { leadingWhitespace: "", markableText: text, trailingWhitespace: "" };
  }

  const [, leadingWhitespace = "", markableText = "", trailingWhitespace = ""] = match;

  return { leadingWhitespace, markableText, trailingWhitespace };
};

const applyMarkdownMarksToText = (text: string, marks: TextMarks): string => {
  let markedText = escapeMarkdownText(text);

  if (marks.underline) {
    markedText = `<u>${markedText}</u>`;
  }

  if (marks.bold) {
    markedText = `**${markedText}**`;
  }

  if (marks.italic) {
    markedText = `_${markedText}_`;
  }

  return markedText;
};

/**
 * Applies markdown-compatible formatting marks to a plain text value.
 */
export const applyMarkdownMarks = (text: string, marks: TextMarks): string => {
  const { leadingWhitespace, markableText, trailingWhitespace } = splitSurroundingWhitespace(text);

  if (!markableText) {
    return serializePreservedWhitespace(text);
  }

  return [
    serializePreservedWhitespace(leadingWhitespace),
    applyMarkdownMarksToText(markableText, marks),
    serializePreservedWhitespace(trailingWhitespace),
  ].join("");
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
    return escapeMarkdownText(node.text);
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
