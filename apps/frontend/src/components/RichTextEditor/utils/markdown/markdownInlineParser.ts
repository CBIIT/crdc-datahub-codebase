import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { FormattedText, InlineNode, LinkElement, MarkFormat, TextMarks } from "../../types";
import { isTextNode, normalizeTextChildren } from "../documentUtils";
import { readUrl } from "../linkUrlUtils";

import { ESCAPABLE_MARKDOWN_CHARACTERS } from "./markdownUtils";

type MarkdownTokenResult = {
  nodes: InlineNode[];
  consumedText: string;
};

type MarkdownLinkSyntax = {
  text: string;
  url: string;
  consumedText: string;
};

type MarkSyntax = {
  format: MarkFormat;
  prefix: string;
  suffix: string;
};

/**
 * Returns the configured markdown syntaxes for the editor's supported marks.
 *
 * @returns {MarkSyntax[]} An array of mark syntax configurations.
 *
 * @example
 * getMarkSyntaxes(); // [{ format: "bold", prefix: "**", suffix: "**" }, ...]
 */
const getMarkSyntaxes = (): MarkSyntax[] =>
  MARK_DEFINITIONS.flatMap(({ format, markdownSyntax }) => {
    if (!markdownSyntax) {
      return [];
    }

    const [prefix, suffix] = markdownSyntax;

    return [{ format, prefix, suffix }];
  });

/**
 * Decodes escaped markdown characters back to raw text.
 *
 * @param {string} text - The serialized markdown text to decode.
 * @returns {string} The decoded plain text.
 *
 * @example
 * decodeMarkdownEscapes("\\*"); // "*"
 */
const decodeMarkdownEscapes = (text: string): string => {
  let decodedText = "";
  let index = 0;

  while (index < text.length) {
    const currentCharacter = text[index];
    const nextCharacter = text[index + 1];
    const isEscapedMarkdownCharacter =
      currentCharacter === "\\" && ESCAPABLE_MARKDOWN_CHARACTERS.has(nextCharacter);

    if (isEscapedMarkdownCharacter) {
      decodedText += nextCharacter;
      index += 2;
    } else {
      decodedText += currentCharacter;
      index += 1;
    }
  }

  return decodedText;
};

/**
 * Returns a new collection with the inline nodes appended, merging adjacent text nodes with matching marks.
 *
 * @param {InlineNode[]} target - The existing collection.
 * @param {InlineNode[]} nextNodes - The inline nodes to append.
 * @returns {InlineNode[]} A new collection with all inline nodes appended or merged.
 *
 * @example
 * appendInlineNodes(
 *   [{ text: "hello", bold: true }],
 *   [{ text: " world", bold: true }]
 * ); // [{ text: "hello world", bold: true }]
 */
const appendInlineNodes = (target: InlineNode[], nextNodes: InlineNode[]): InlineNode[] =>
  nextNodes.reduce((acc, nextNode) => {
    const previousNode = acc[acc.length - 1];
    const hasSameMarks =
      previousNode &&
      isTextNode(previousNode) &&
      isTextNode(nextNode) &&
      MARK_DEFINITIONS.every(({ format }) => previousNode[format] === nextNode[format]);

    if (!hasSameMarks) {
      return [...acc, nextNode];
    }

    return [...acc.slice(0, -1), { ...previousNode, text: previousNode.text + nextNode.text }];
  }, target);

/**
 * Checks whether the text has an escaped markdown character at the given index.
 *
 * @param {string} text - The text to inspect.
 * @param {number} index - The index to check.
 * @returns {boolean} True when the character at the index is a markdown escape sequence.
 *
 * @example
 * isEscapedMarkdownCharacterAt("\\*", 0); // true
 * isEscapedMarkdownCharacterAt("*", 0); // false
 */
const isEscapedMarkdownCharacterAt = (text: string, index: number): boolean =>
  text[index] === "\\" && ESCAPABLE_MARKDOWN_CHARACTERS.has(text[index + 1]);

/**
 * Finds the next closing markdown syntax token, ignoring escaped markdown characters.
 *
 * @param {string} text - The text to search.
 * @param {number} startIndex - The index where the search should begin.
 * @param {string} suffix - The closing markdown syntax to find.
 * @returns {number} The closing syntax index, or -1 when no closing syntax is found.
 *
 * @example
 * findClosingSyntaxIndex("**bold**", 2, "**"); // 6
 */
const findClosingSyntaxIndex = (text: string, startIndex: number, suffix: string): number => {
  let index = startIndex;

  while (index < text.length) {
    const isEscapedMarkdownCharacter = isEscapedMarkdownCharacterAt(text, index);
    const isClosingSyntax = text.startsWith(suffix, index);

    if (isEscapedMarkdownCharacter) {
      index += 2;
    } else if (isClosingSyntax) {
      return index;
    } else {
      index += 1;
    }
  }

  return -1;
};

/**
 * Reads the structural parts of a markdown link ("[text](url)") from the start of the text.
 *
 * @param {string} text - The remaining markdown text.
 * @returns {MarkdownLinkSyntax | null} The link parts, or null when no link starts here.
 *
 * @example
 * readLinkSyntax("[Google](https://google.com) rest");
 * // { text: "Google", url: "https://google.com", consumedText: "[Google](https://google.com)" }
 */
const readLinkSyntax = (text: string): MarkdownLinkSyntax | null => {
  if (text[0] !== "[") {
    return null;
  }

  const closingBracketIndex = findClosingSyntaxIndex(text, 1, "](");

  if (closingBracketIndex <= 1) {
    return null;
  }

  const urlStartIndex = closingBracketIndex + 2;
  const closingParenIndex = text.indexOf(")", urlStartIndex);

  if (closingParenIndex <= urlStartIndex) {
    return null;
  }

  const url = readUrl(text.slice(urlStartIndex, closingParenIndex));

  if (!url) {
    return null;
  }

  return {
    text: text.slice(1, closingBracketIndex),
    url,
    consumedText: text.slice(0, closingParenIndex + 1),
  };
};

/**
 * Flattens parsed inline nodes into plain text nodes, discarding nested link wrappers.
 *
 * @param {InlineNode[]} nodes - The inline nodes to flatten.
 * @returns {FormattedText[]} The text nodes only.
 */
const flattenToTextNodes = (nodes: InlineNode[]): FormattedText[] =>
  nodes.flatMap((node) => {
    if (isTextNode(node)) {
      return [node];
    }

    return node.children;
  });

/**
 * Attempts to read a markdown link token from the start of the text.
 *
 * @param {string} text - The remaining markdown text.
 * @param {TextMarks} marks - The currently active inherited marks.
 * @returns {MarkdownTokenResult | null} The parsed link token, or null when no link starts here.
 *
 * @example
 * readLinkToken("[Google](https://google.com)", {});
 * // { nodes: [{ type: "link", url: "https://google.com", children: [{ text: "Google" }] }], ... }
 */
const readLinkToken = (text: string, marks: TextMarks): MarkdownTokenResult | null => {
  const syntax = readLinkSyntax(text);

  if (!syntax) {
    return null;
  }

  const linkElement: LinkElement = {
    type: "link",
    url: syntax.url,
    children: flattenToTextNodes(parseMarkdownInline(syntax.text, marks)),
  };

  return {
    nodes: [linkElement],
    consumedText: syntax.consumedText,
  };
};

/**
 * Attempts to read a configured markdown mark token from the start of the text.
 *
 * @param {string} text - The remaining markdown text.
 * @param {TextMarks} marks - The currently active inherited marks.
 * @returns {MarkdownTokenResult | null} The parsed mark token, or null when no configured token matches.
 *
 * @example
 * readConfiguredMarkToken("**bold**", {}); // { nodes: [{ text: "bold", bold: true }], consumedText: "**bold**" }
 */
const readConfiguredMarkToken = (text: string, marks: TextMarks): MarkdownTokenResult | null => {
  for (const { format, prefix, suffix } of getMarkSyntaxes()) {
    const startsWithPrefix = text.startsWith(prefix);
    const closingIndex = startsWithPrefix
      ? findClosingSyntaxIndex(text, prefix.length, suffix)
      : -1;
    const hasWrappedContent = closingIndex > prefix.length;

    if (startsWithPrefix && hasWrappedContent) {
      return {
        nodes: parseMarkdownInline(text.slice(prefix.length, closingIndex), {
          ...marks,
          [format]: true,
        }),
        consumedText: text.slice(0, closingIndex + suffix.length),
      };
    }
  }

  return null;
};

/**
 * Attempts to read single-asterisk italic markdown from the start of the text.
 *
 * @param {string} text - The remaining markdown text.
 * @param {TextMarks} marks - The currently active inherited marks.
 * @returns {MarkdownTokenResult | null} The parsed italic token, or null when it does not match.
 *
 * @example
 * readAsteriskItalicToken("*italic*", {}); // { nodes: [{ text: "italic", italic: true }], consumedText: "*italic*" }
 */
const readAsteriskItalicToken = (text: string, marks: TextMarks): MarkdownTokenResult | null => {
  const startsWithSingleAsterisk = text.startsWith("*") && !text.startsWith("**");

  if (!startsWithSingleAsterisk) {
    return null;
  }

  const closingIndex = findClosingSyntaxIndex(text, 1, "*");

  if (closingIndex <= 1) {
    return null;
  }

  return {
    nodes: parseMarkdownInline(text.slice(1, closingIndex), {
      ...marks,
      italic: true,
    }),
    consumedText: text.slice(0, closingIndex + 1),
  };
};

/**
 * Checks whether a markdown mark or link token starts at the given index.
 *
 * @param {string} text - The markdown text to inspect.
 * @param {number} index - The index to check.
 * @returns {boolean} True when a markdown token starts at the index.
 *
 * @example
 * hasInlineTokenAt("hello **bold**", 6); // true
 * hasInlineTokenAt("go to [g](https://g.co)", 6); // true
 */
const hasInlineTokenAt = (text: string, index: number): boolean => {
  const remainingText = text.slice(index);

  if (isEscapedMarkdownCharacterAt(text, index)) {
    return true;
  }

  if (readLinkSyntax(remainingText)) {
    return true;
  }

  const hasConfiguredMarkToken = getMarkSyntaxes().some(({ prefix, suffix }) => {
    if (!remainingText.startsWith(prefix)) {
      return false;
    }

    return findClosingSyntaxIndex(remainingText, prefix.length, suffix) > prefix.length;
  });

  if (hasConfiguredMarkToken) {
    return true;
  }

  return (
    remainingText.startsWith("*") &&
    !remainingText.startsWith("**") &&
    findClosingSyntaxIndex(remainingText, 1, "*") > 1
  );
};

/**
 * Reads plain text until the next markdown mark token.
 *
 * @param {string} text - The remaining markdown text.
 * @param {TextMarks} marks - The currently active inherited marks.
 * @returns {MarkdownTokenResult} The plain text token result.
 *
 * @example
 * readPlainTextToken("hello **bold**", {}); // { nodes: [{ text: "hello " }], consumedText: "hello " }
 */
const readPlainTextToken = (text: string, marks: TextMarks): MarkdownTokenResult => {
  let endIndex = 1;

  while (endIndex < text.length && !hasInlineTokenAt(text, endIndex)) {
    endIndex += 1;
  }

  const consumedText = text.slice(0, endIndex);

  return {
    nodes: [{ text: decodeMarkdownEscapes(consumedText), ...marks }],
    consumedText,
  };
};

/**
 * Parses the next markdown token from the start of the text.
 *
 * @param {string} text - The remaining text to parse.
 * @param {TextMarks} marks - The currently active marks.
 * @returns {MarkdownTokenResult} The parsed token result.
 *
 * @example
 * parseNextMarkdownToken("**bold**", {}); // { nodes: [{ text: "bold", bold: true }], consumedText: "**bold**" }
 */
const parseNextMarkdownToken = (text: string, marks: TextMarks): MarkdownTokenResult => {
  if (isEscapedMarkdownCharacterAt(text, 0)) {
    return {
      nodes: [{ text: text[1], ...marks }],
      consumedText: text.slice(0, 2),
    };
  }

  const linkToken = readLinkToken(text, marks);

  if (linkToken) {
    return linkToken;
  }

  const configuredMarkToken = readConfiguredMarkToken(text, marks);

  if (configuredMarkToken) {
    return configuredMarkToken;
  }

  const asteriskItalicToken = readAsteriskItalicToken(text, marks);

  if (asteriskItalicToken) {
    return asteriskItalicToken;
  }

  return readPlainTextToken(text, marks);
};

/**
 * Parses inline markdown into Slate inline nodes using the editor's supported mark and link subset.
 *
 * @param {string} text - The inline markdown string to parse.
 * @param {TextMarks} [marks={}] - The inherited marks from a parent token.
 * @returns {InlineNode[]} The parsed and normalized inline nodes.
 *
 * @example
 * parseMarkdownInline("**bold**"); // [{ text: "bold", bold: true }]
 * parseMarkdownInline("[g](https://g.co)"); // [{ type: "link", url: "https://g.co", children: [{ text: "g" }] }]
 */
export const parseMarkdownInline = (text: string, marks: TextMarks = {}): InlineNode[] => {
  if (!text) {
    return [];
  }

  let result: InlineNode[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    const nextToken = parseNextMarkdownToken(remainingText, marks);
    result = appendInlineNodes(result, nextToken.nodes);
    remainingText = remainingText.slice(nextToken.consumedText.length);
  }

  return normalizeTextChildren(result);
};
