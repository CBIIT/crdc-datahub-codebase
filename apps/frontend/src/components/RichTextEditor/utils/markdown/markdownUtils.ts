import type { ListFormat } from "../../types";

/**
 * Markdown characters that are escaped/unescaped by this editor's inline markdown subset.
 */
export const ESCAPABLE_MARKDOWN_CHARACTERS = new Set(["\\", "*", "_"]);

/**
 * Characters recognized as bulleted list markers.
 */
export const BULLET_MARKERS = new Set(["-", "*"]);

export type ParsedListLine = {
  format: ListFormat;
  content: string;
};

/**
 * Normalizes all line ending styles (CRLF, CR) to LF.
 *
 * @param {string} content - The raw string content.
 * @returns {string} The content with all line endings replaced by `\n`.
 */
export const normalizeLineEndings = (content: string): string =>
  content.split("\r\n").join("\n").split("\r").join("\n");

/**
 * Parses the list marker prefix from a markdown line.
 *
 * @param {string} line - A single markdown line.
 * @returns {ParsedListLine | null} The list format and content, or null if not a list line.
 *
 * @example
 * readListLine("- hello"); // { format: "bulleted-list", content: "hello" }
 * readListLine("1. hello"); // { format: "numbered-list", content: "hello" }
 * readListLine("hello");   // null
 */
export const readListLine = (line: string): ParsedListLine | null => {
  if (BULLET_MARKERS.has(line[0]) && line[1] === " ") {
    return {
      format: "bulleted-list",
      content: line.slice(2),
    };
  }

  let index = 0;
  const isDigitChar = (char: string): boolean => /^\d$/.test(char);

  while (index < line.length && isDigitChar(line[index])) {
    index += 1;
  }

  const hasNumber = index > 0;
  const hasNumberedListSeparator = line[index] === "." && line[index + 1] === " ";

  if (!hasNumber || !hasNumberedListSeparator) {
    return null;
  }

  return {
    format: "numbered-list",
    content: line.slice(index + 2),
  };
};
