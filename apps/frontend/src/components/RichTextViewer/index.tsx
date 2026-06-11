import { styled } from "@mui/material";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const MARKDOWN_ALLOWED_ELEMENTS = ["p", "br", "strong", "em", "u", "ul", "ol", "li"] as const;

const BLANK_LINE_RUN_PATTERN = /\n{3,}/g;
const NON_BREAKING_SPACE = "\u00A0";
const TAB_SIZE = 2;

const StyledMarkdown = styled(ReactMarkdown)({
  lineHeight: "25px",

  "& p": {
    margin: "0 0 4px 0",
    whiteSpace: "pre-wrap",
    "&:last-child": { marginBottom: 0 },
  },

  "& ul, & ol": {
    margin: "0 0 4px 0",
    paddingLeft: "24px",
    "&:last-child": { marginBottom: 0 },
  },

  "& li": {
    lineHeight: "25px",
    whiteSpace: "pre-wrap",
  },
});

/**
 * Normalize line endings so blank paragraph handling is consistent.
 *
 * @param {string} value - The markdown content.
 * @returns {string} The content with normalized line endings.
 */
const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, "\n");

/**
 * Replace hard blank-line runs with explicit <br /> blocks.
 *
 * This preserves multiple empty rows in the viewer without changing the stored value.
 *
 * @param {string} value - The markdown content with normalized line endings.
 * @returns {string} The markdown content with blank paragraph placeholders.
 */
const preserveBlankParagraphs = (value: string): string =>
  value.replace(BLANK_LINE_RUN_PATTERN, (lineBreaks) => {
    const blankParagraphCount = Math.ceil((lineBreaks.length - 2) / 2);
    const blankParagraphs = Array.from({ length: blankParagraphCount }, () => "<br />").join(
      "\n\n"
    );

    return `\n\n${blankParagraphs}\n\n`;
  });

/**
 * Convert leading spaces and tabs to real non-breaking space characters for rendering.
 *
 * @param {string} line - A single markdown line.
 * @returns {string} The same line with leading whitespace converted for display.
 */
const preserveLeadingWhitespace = (line: string): string => {
  let index = 0;
  let preservedWhitespace = "";

  while (index < line.length) {
    const character = line[index];

    if (character === " ") {
      preservedWhitespace += NON_BREAKING_SPACE;
      index += 1;
    } else if (character === "\t") {
      preservedWhitespace += NON_BREAKING_SPACE.repeat(TAB_SIZE);
      index += 1;
    } else {
      break;
    }
  }

  return `${preservedWhitespace}${line.slice(index)}`;
};

/**
 * Preserve leading indentation while leaving raw HTML placeholder lines alone.
 *
 * @param {string} line - A single markdown line.
 * @returns {string} A viewer-safe markdown line.
 */
const prepareLineForViewer = (line: string): string => {
  const trimmedLine = line.trim();

  if (trimmedLine === "<br />") {
    return line;
  }

  return preserveLeadingWhitespace(line);
};

/**
 * Prepare markdown for display only.
 *
 * @param {string} value - The stored markdown content.
 * @returns {string} Markdown adjusted for viewer rendering.
 */
const prepareMarkdownForViewer = (value: string): string => {
  const normalizedContent = normalizeLineEndings(value);
  const contentWithBlankParagraphs = preserveBlankParagraphs(normalizedContent);

  return contentWithBlankParagraphs.split("\n").map(prepareLineForViewer).join("\n");
};

type Props = {
  content: string;
  className?: string;
};

const RichTextViewer = ({ content, className }: Props): ReactElement | null => {
  if (!content.trim()) {
    return null;
  }

  return (
    <StyledMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      allowedElements={[...MARKDOWN_ALLOWED_ELEMENTS]}
      unwrapDisallowed
    >
      {prepareMarkdownForViewer(content)}
    </StyledMarkdown>
  );
};

export default RichTextViewer;
