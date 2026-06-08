import { Descendant, Element, Text } from "slate";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { FormattedText, TextMarks } from "../../types";

const SURROUNDING_WHITESPACE_PATTERN = /^([ \t]*)(.*?)([ \t]*)$/s;

const MARKDOWN_REMOVAL_RULES: Record<string, [RegExp, string]> = {
  bold: [/\*\*(.+?)\*\*/gs, "$1"],
  italicAsterisk: [/\*(.+?)\*/gs, "$1"],
  italicUnderscore: [/_(.+?)_/gs, "$1"],
  underline: [/<u>(.+?)<\/u>/gs, "$1"],
  bulletedListPrefix: [/^[-*] /gm, ""],
  numberedListPrefix: [/^\d+\. /gm, ""],
  escapedCharacters: [/\\([*_\\])/g, "$1"],
};

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
 * NOTE: Used for preventing raw user input being interpreted as markdown syntax or HTML.
 *
 * @param {string} text - The raw text to escape.
 * @returns {string} The escaped text safe for markdown/HTML output.
 *
 * @example
 * escapeMarkdownText("a & b"); // "a &amp; b"
 * escapeMarkdownText("**bold**"); // "\\*\\*bold\\*\\*"
 */
export const escapeMarkdownText = (text: string): string =>
  text
    .replace(/[&<>]/g, (ch) => HTML_TEXT_ESCAPE_REPLACEMENTS[ch])
    .replace(/[\\*_]/g, (ch) => MARKDOWN_ESCAPE_REPLACEMENTS[ch]);

/**
 * Preserves indentation in markdown output by converting spaces and tabs to HTML entities.
 *
 * @param {string} whitespace - The whitespace string to preserve.
 * @returns {string} The whitespace with spaces as `&nbsp;` and tabs as four `&nbsp;`.
 */
const serializePreservedWhitespace = (whitespace: string): string =>
  whitespace.replace(/ /g, "&nbsp;").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

/**
 * Splits text into leading whitespace, inner content, and trailing whitespace.
 *
 * @param {string} text - The text to split.
 * @returns {{ leadingWhitespace: string; markableText: string; trailingWhitespace: string }}
 *
 * @example
 * splitSurroundingWhitespace("  hello  "); // { leadingWhitespace: "  ", markableText: "hello", trailingWhitespace: "  " }
 */
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

/**
 * Wraps escaped text in markdown syntax for each active mark.
 *
 * @param {string} text - The raw text to format.
 * @param {TextMarks} marks - The active formatting marks.
 * @returns {string} The text with markdown syntax applied.
 *
 * @example
 * applyMarkdownMarksToText("hello", { bold: true, italic: true }); // "_**hello**_"
 */
const applyMarkdownMarksToText = (text: string, marks: TextMarks): string =>
  MARK_DEFINITIONS.reduce((markedText, { format, markdownSyntax: [prefix, suffix] }) => {
    if (marks[format]) {
      return `${prefix}${markedText}${suffix}`;
    }

    return markedText;
  }, escapeMarkdownText(text));

/**
 * Applies markdown-compatible formatting marks to a plain text value.
 *
 * @param {string} text - The plain text to format.
 * @param {TextMarks} marks - The formatting marks to apply.
 * @returns {string} The text wrapped in the appropriate markdown syntax.
 *
 * @example
 * applyMarkdownMarks("hello", { bold: true }); // "**hello**"
 * applyMarkdownMarks("hello", { italic: true }); // "_hello_"
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

/**
 * Serializes text children into a concatenated markdown string.
 *
 * @param {FormattedText[]} children - The text nodes to serialize.
 * @returns {string} The concatenated markdown output.
 *
 * @example
 * serializeTextChildren([{ text: "hello " }, { text: "world", bold: true }]); // "hello **world**"
 */
const serializeTextChildren = (children: FormattedText[]): string =>
  children
    .map(({ text, bold, italic, underline }) =>
      applyMarkdownMarks(text, { bold, italic, underline })
    )
    .join("");

/**
 * Serializes a single top-level Slate node into its markdown representation.
 *
 * @param {Descendant} node - The Slate document node.
 * @returns {string} The markdown string for the node.
 *
 * @example
 * serializeMarkdownBlock({ type: "paragraph", children: [{ text: "hello" }] }); // "hello"
 */
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
    return node.children.map((item) => `- ${serializeTextChildren(item.children)}`).join("\n");
  }

  if (node.type === "numbered-list") {
    return node.children
      .map((item, i) => `${i + 1}. ${serializeTextChildren(item.children)}`)
      .join("\n");
  }

  return "";
};

/**
 * Converts a Slate rich-text value into the markdown subset used for storage.
 *
 * @param {Descendant[]} nodes - The top-level Slate document nodes.
 * @returns {string} The serialized markdown string.
 *
 * @example
 * serializeToMarkdown([{ type: "paragraph", children: [{ text: "hello" }] }]); // "hello"
 */
export const serializeToMarkdown = (nodes: Descendant[]): string =>
  nodes.map(serializeMarkdownBlock).filter(Boolean).join("\n\n").trimEnd();

/**
 * Gets the user-visible text length from stored markdown rich-text content.
 *
 * @param {string} content - The stored markdown rich-text content.
 * @returns {number} The length of the visible text after stripping markdown syntax.
 *
 * @example
 * getPlainTextLength("**bold**"); // 4
 * getPlainTextLength("- item"); // 4
 */
export const getPlainTextLength = (content: string): number => {
  if (!content?.trim()) {
    return 0;
  }

  return Object.values(MARKDOWN_REMOVAL_RULES)
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), content)
    .trim().length;
};
