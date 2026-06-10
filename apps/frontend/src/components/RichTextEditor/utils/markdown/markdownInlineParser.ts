import {
  HTML_ENTITY_REPLACEMENTS,
  ITALIC_ASTERISK_PATTERN,
  MARK_DEFINITIONS,
  PLAIN_TEXT_PATTERN,
} from "@/config/EditorConfig";

import type { FormattedText, MarkFormat, TextMarks } from "../../types";
import { normalizeTextChildren } from "../documentUtils";

type MarkdownTokenResult = {
  nodes: FormattedText[];
  consumedText: string;
};

/**
 * Decodes serialized HTML entities and escaped markdown characters back to raw text.
 *
 * @param {string} text - The serialized text to decode.
 * @returns {string} The decoded plain text.
 *
 * @example
 * decodeSerializedText("&amp;"); // "&"
 * decodeSerializedText("\\*"); // "*"
 */
const decodeSerializedText = (text: string): string => {
  const pattern = new RegExp(Object.keys(HTML_ENTITY_REPLACEMENTS).join("|"), "g");
  return text
    .replace(pattern, (entity) => HTML_ENTITY_REPLACEMENTS[entity])
    .replace(/\\([*_\\])/g, "$1");
};

/**
 * Returns a new collection with the text nodes appended, merging adjacent nodes with matching marks.
 *
 * @param {FormattedText[]} target - The existing collection.
 * @param {FormattedText[]} nextTexts - The text nodes to append.
 * @returns {FormattedText[]} A new collection with all text nodes appended or merged.
 *
 * @example
 * appendFormattedTexts(
 *   [{ text: "hello", bold: true }],
 *   [{ text: " world", bold: true }]
 * ); // [{ text: "hello world", bold: true }]
 */
const appendFormattedTexts = (
  target: FormattedText[],
  nextTexts: FormattedText[]
): FormattedText[] =>
  nextTexts.reduce((acc, nextText) => {
    const previousText = acc[acc.length - 1];
    const hasSameMarks =
      previousText && MARK_DEFINITIONS.every((d) => previousText[d.format] === nextText[d.format]);

    if (!hasSameMarks) {
      return [...acc, nextText];
    }

    return [...acc.slice(0, -1), { ...previousText, text: previousText.text + nextText.text }];
  }, target);

/**
 * Parses the next markdown token from the start of the text.
 *
 * @param {string} text - The remaining text to parse.
 * @param {TextMarks} marks - The currently active marks.
 * @returns {MarkdownTokenResult} The parsed token result.
 */
const parseNextMarkdownToken = (text: string, marks: TextMarks): MarkdownTokenResult => {
  const anchoredMarkPatterns: Record<MarkFormat, RegExp> = Object.fromEntries(
    MARK_DEFINITIONS.map((d) => [d.format, new RegExp(`^${d.pattern.source}`)])
  ) as Record<MarkFormat, RegExp>;

  for (const def of MARK_DEFINITIONS) {
    const match = text.match(anchoredMarkPatterns[def.format]);

    if (match) {
      return {
        nodes: parseMarkdownInline(match[1], { ...marks, [def.format]: true }),
        consumedText: match[0],
      };
    }
  }

  const asteriskMatch = text.match(new RegExp(`^${ITALIC_ASTERISK_PATTERN.source}`));

  if (asteriskMatch) {
    return {
      nodes: parseMarkdownInline(asteriskMatch[1], { ...marks, italic: true }),
      consumedText: asteriskMatch[0],
    };
  }

  const escapedMatch = text.match(/^\\([*_\\])/);

  if (escapedMatch) {
    return {
      nodes: [{ text: escapedMatch[1], ...marks }],
      consumedText: escapedMatch[0],
    };
  }

  const plainMatch = text.match(new RegExp(`^${PLAIN_TEXT_PATTERN.source}`)) ?? text.match(/^./);

  if (plainMatch) {
    return {
      nodes: [{ text: decodeSerializedText(plainMatch[0]), ...marks }],
      consumedText: plainMatch[0],
    };
  }

  return { nodes: [{ text: "", ...marks }], consumedText: "" };
};

/**
 * Parses inline markdown into Slate text nodes using the editor's supported mark subset.
 *
 * @param {string} text - The inline markdown string to parse.
 * @param {TextMarks} [marks={}] - The inherited marks from a parent token.
 * @returns {FormattedText[]} The parsed and normalized text nodes.
 *
 * @example
 * parseMarkdownInline("**bold**"); // [{ text: "bold", bold: true }]
 * parseMarkdownInline("_italic_"); // [{ text: "italic", italic: true }]
 */
export const parseMarkdownInline = (text: string, marks: TextMarks = {}): FormattedText[] => {
  if (!text) {
    return [];
  }

  let result: FormattedText[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    const nextToken = parseNextMarkdownToken(remainingText, marks);
    result = appendFormattedTexts(result, nextToken.nodes);
    remainingText = remainingText.slice(nextToken.consumedText.length);
  }

  return normalizeTextChildren(result);
};
