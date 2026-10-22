import type { Descendant } from "slate";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { InlineNode, TextMarks } from "../../types";
import { isElementNode, isTextNode } from "../documentUtils";
import { isLinkElement } from "../editorGuards";

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
 * Encodes parentheses so a URL cannot terminate the markdown link syntax early.
 *
 * @param {string} url - The link URL.
 * @returns {string} The URL with parentheses percent-encoded.
 *
 * @example
 * encodeLinkUrl("https://g.co/a(1)"); // "https://g.co/a%281%29"
 */
const encodeLinkUrl = (url: string): string => url.split("(").join("%28").split(")").join("%29");

/**
 * Serializes a single inline node into its markdown representation.
 *
 * @param {InlineNode} node - The text or link node to serialize.
 * @returns {string} The markdown output for the node.
 *
 * @example
 * serializeInlineNode({ text: "world", bold: true }); // "**world**"
 * serializeInlineNode({ type: "link", url: "https://g.co", children: [{ text: "g" }] }); // "[g](https://g.co)"
 */
const serializeInlineNode = (node: InlineNode): string => {
  if (isLinkElement(node)) {
    const linkText = node.children
      .map(({ text, bold, italic, underline }) =>
        applyMarkdownMarks(text, { bold, italic, underline })
      )
      .join("");

    return `[${linkText}](${encodeLinkUrl(node.url)})`;
  }

  return applyMarkdownMarks(node.text, {
    bold: node.bold,
    italic: node.italic,
    underline: node.underline,
  });
};

/**
 * Serializes inline children into a concatenated markdown string.
 *
 * @param {InlineNode[]} children - The inline nodes to serialize.
 * @returns {string} The concatenated markdown output.
 *
 * @example
 * serializeInlineChildren([{ text: "hello " }, { text: "world", bold: true }]); // "hello **world**"
 */
const serializeInlineChildren = (children: InlineNode[]): string =>
  children.map(serializeInlineNode).join("");

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
    return serializeInlineChildren(node.children);
  }

  if (node.type === "link") {
    return serializeInlineNode(node);
  }

  if (node.type === "bulleted-list") {
    return node.children.map((item) => `- ${serializeInlineChildren(item.children)}`).join("\n");
  }

  if (node.type === "numbered-list") {
    return node.children
      .map((item, index) => `${index + 1}. ${serializeInlineChildren(item.children)}`)
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
  nodes.map(serializeMarkdownBlock).join("\n\n");

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
    .map((node) => {
      if (isLinkElement(node)) {
        return node.children.map(({ text }) => text).join("");
      }

      return node.text;
    })
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
  if (!content) {
    return 0;
  }

  const normalizedContent = normalizeLineEndings(content);
  const visibleText = normalizedContent
    .split("\n\n")
    .map((block) => block.split("\n").map(getMarkdownLinePlainText).join("\n"))
    .join("\n");

  return visibleText.length;
};
