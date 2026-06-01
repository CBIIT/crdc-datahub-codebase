import type { FormattedText, TextMarks } from "../../types";
import { normalizeTextChildren } from "../documentUtils";

type MarkdownTokenResult = {
  nodes: FormattedText[];
  consumedText: string;
};

type MarkdownTokenParser = (text: string, marks: TextMarks) => MarkdownTokenResult | null;

const BOLD_MARKDOWN_PATTERN = /^\*\*(.+?)\*\*/;
const ITALIC_ASTERISK_MARKDOWN_PATTERN = /^\*(.+?)\*/;
const ITALIC_UNDERSCORE_MARKDOWN_PATTERN = /^_(.+?)_/;
const UNDERLINE_MARKDOWN_PATTERN = /^<u>(.+?)<\/u>/;
const PLAIN_TEXT_MARKDOWN_PATTERN = /^[^*_<\\]+/;

/**
 * Returns true when two text mark objects represent the same formatting state.
 */
export const marksAreEqual = (firstMarks: TextMarks, secondMarks: TextMarks): boolean =>
  firstMarks.bold === secondMarks.bold &&
  firstMarks.italic === secondMarks.italic &&
  firstMarks.underline === secondMarks.underline;

const getTextMarks = ({ bold, italic, underline }: FormattedText): TextMarks => ({
  bold,
  italic,
  underline,
});

/**
 * Appends text to a target collection and merges adjacent nodes with the same marks.
 */
export const appendFormattedText = (target: FormattedText[], nextText: FormattedText): void => {
  const previousText = target[target.length - 1];

  if (!previousText || !marksAreEqual(getTextMarks(previousText), getTextMarks(nextText))) {
    target.push(nextText);
    return;
  }

  previousText.text += nextText.text;
};

const appendFormattedTexts = (target: FormattedText[], nextTexts: FormattedText[]): void => {
  nextTexts.forEach((nextText) => appendFormattedText(target, nextText));
};

const createMarkedTokenResult = (
  match: RegExpExecArray | null,
  marks: TextMarks,
  addedMarks: TextMarks
): MarkdownTokenResult | null => {
  if (!match) {
    return null;
  }

  return {
    nodes: parseMarkdownInline(match[1], { ...marks, ...addedMarks }),
    consumedText: match[0],
  };
};

const parseBoldMarkdownToken: MarkdownTokenParser = (text, marks) =>
  createMarkedTokenResult(BOLD_MARKDOWN_PATTERN.exec(text), marks, { bold: true });

const parseItalicMarkdownToken: MarkdownTokenParser = (text, marks) => {
  const asteriskMatch = ITALIC_ASTERISK_MARKDOWN_PATTERN.exec(text);

  if (asteriskMatch) {
    return createMarkedTokenResult(asteriskMatch, marks, { italic: true });
  }

  return createMarkedTokenResult(ITALIC_UNDERSCORE_MARKDOWN_PATTERN.exec(text), marks, {
    italic: true,
  });
};

const parseUnderlineMarkdownToken: MarkdownTokenParser = (text, marks) =>
  createMarkedTokenResult(UNDERLINE_MARKDOWN_PATTERN.exec(text), marks, { underline: true });

const parsePlainMarkdownToken: MarkdownTokenParser = (text, marks) => {
  const plainTextMatch = PLAIN_TEXT_MARKDOWN_PATTERN.exec(text);

  if (plainTextMatch) {
    return {
      nodes: [{ text: plainTextMatch[0].replace(/\\([*_\\])/g, "$1"), ...marks }],
      consumedText: plainTextMatch[0],
    };
  }

  const fallbackMatch = /^./.exec(text);

  if (!fallbackMatch) {
    return null;
  }

  return {
    nodes: [{ text: fallbackMatch[0].replace(/\\([*_\\])/g, "$1"), ...marks }],
    consumedText: fallbackMatch[0],
  };
};

const MARKDOWN_TOKEN_PARSERS: MarkdownTokenParser[] = [
  parseBoldMarkdownToken,
  parseItalicMarkdownToken,
  parseUnderlineMarkdownToken,
  parsePlainMarkdownToken,
];

const parseNextMarkdownToken = (text: string, marks: TextMarks): MarkdownTokenResult => {
  const result = MARKDOWN_TOKEN_PARSERS.reduce<MarkdownTokenResult | null>((match, parser) => {
    if (match) {
      return match;
    }

    return parser(text, marks);
  }, null);

  if (result) {
    return result;
  }

  return {
    nodes: [{ text: text[0] ?? "", ...marks }],
    consumedText: text[0] ?? "",
  };
};

/**
 * Parses inline markdown into Slate text nodes using the editor's supported mark subset.
 */
export const parseMarkdownInline = (text: string, marks: TextMarks = {}): FormattedText[] => {
  if (!text) {
    return [];
  }

  const result: FormattedText[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    const nextToken = parseNextMarkdownToken(remainingText, marks);
    appendFormattedTexts(result, nextToken.nodes);
    remainingText = remainingText.slice(nextToken.consumedText.length);
  }

  return normalizeTextChildren(result);
};
