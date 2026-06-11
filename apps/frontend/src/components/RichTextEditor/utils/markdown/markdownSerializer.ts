import type { Descendant } from "slate";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { FormattedText, TextMarks } from "../../types";
import { isElementNode, isTextNode } from "../documentUtils";

import { parseMarkdownInline } from "./markdownInlineParser";
import { ESCAPABLE_MARKDOWN_CHARACTERS, normalizeLineEndings, readListLine } from "./markdownUtils";

/**
 * Escapes only markdown syntax characters.
 *
 * @param {string} text - The raw text to escape.
 * @returns {string} The text with markdown syntax characters escaped.
 *
 * @example
 * escapeMarkdownText("**not bold**"); // "\\*\\*not bold\\*\\*"
 */
export const escapeMarkdownText = (text: string): string => {
  let escapedText = "";

  Array.from(text).forEach((character) => {
    if (ESCAPABLE_MARKDOWN_CHARACTERS.has(character)) {
      escapedText += `\\${character}`;
      return;
    }

    escapedText += character;
  });

  return escapedText;
};

/**
 * Splits text into leading whitespace, inner content, and trailing whitespace.
 *
 * @param {string} text - The text to split.
 * @returns {{ leadingWhitespace: string; markableText: string; trailingWhitespace: string }}
 *
 * @example
 * splitSurroundingWhitespace("  hello  ");
 * // { leadingWhitespace: "  ", markableText: "hello", trailingWhitespace: "  " }
 */
const splitSurroundingWhitespace = (
  text: string
): { leadingWhitespace: string; markableText: string; trailingWhitespace: string } => {
  let startIndex = 0;
  let endIndex = text.length;

  while (startIndex < text.length && (text[startIndex] === " " || text[startIndex] === "\t")) {
    startIndex += 1;
  }

  while (endIndex > startIndex && (text[endIndex - 1] === " " || text[endIndex - 1] === "\t")) {
    endIndex -= 1;
  }

  return {
    leadingWhitespace: text.slice(0, startIndex),
    markableText: text.slice(startIndex, endIndex),
    trailingWhitespace: text.slice(endIndex),
  };
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
  MARK_DEFINITIONS.reduce((markedText, { format, markdownSyntax }) => {
    if (!markdownSyntax || !marks[format]) {
      return markedText;
    }

    const [prefix, suffix] = markdownSyntax;

    return `${prefix}${markedText}${suffix}`;
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
    return text;
  }

  return [
    leadingWhitespace,
    applyMarkdownMarksToText(markableText, marks),
    trailingWhitespace,
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
  if (isTextNode(node)) {
    return escapeMarkdownText(node.text);
  }

  if (!isElementNode(node)) {
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
      .map((item, index) => `${index + 1}. ${serializeTextChildren(item.children)}`)
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
  nodes.map(serializeMarkdownBlock).join("\n\n").trimEnd();

/**
 * Gets the plain text content of a markdown line.
 *
 * @param {string} line - The markdown line to extract text from.
 * @returns {string} The visible plain text content of the line.
 *
 * @example
 * getMarkdownLinePlainText("- **bold** item"); // "bold item"
 */
const getMarkdownLinePlainText = (line: string): string => {
  const listLine = readListLine(line);
  const inlineMarkdown = listLine ? listLine.content : line;

  return parseMarkdownInline(inlineMarkdown)
    .map(({ text }) => text)
    .join("");
};

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

  const normalizedContent = normalizeLineEndings(content);
  const visibleText = normalizedContent.split("\n").map(getMarkdownLinePlainText).join("").trim();

  return visibleText.length;
};
