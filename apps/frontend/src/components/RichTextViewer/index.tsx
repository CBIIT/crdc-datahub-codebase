import { styled } from "@mui/material";
import { createElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const MARKDOWN_ALLOWED_ELEMENTS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a"] as const;
const MARKDOWN_ATTRIBUTE_FREE_ELEMENTS = MARKDOWN_ALLOWED_ELEMENTS.filter((tag) => tag !== "a");

const BLANK_LINE_RUN_PATTERN = /\n{3,}/g;
const NON_BREAKING_SPACE = "\u00A0";
const TAB_SIZE = 2;

const HORIZONTAL_RULE_CHARS = new Set(["-", "*", "_"]);
const UNORDERED_LIST_MARKERS = new Set(["-", "*", "+"]);
const LINK_PROTOCOLS = new Set(["http:", "https:"]);

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
  },

  "& a": {
    color: "#1976d2",
    textDecoration: "underline",
  },
});

/**
 * Determines whether a line would be rendered as a horizontal rule.
 *
 * @param {string} line - A single markdown line.
 * @returns {boolean} True if the line would be parsed as a horizontal rule.
 */
const isHorizontalRule = (line: string): boolean => {
  const trimmed = line.trimEnd();
  if (trimmed.length < 3 || !HORIZONTAL_RULE_CHARS.has(trimmed[0])) {
    return false;
  }
  return Array.from(trimmed).every((char) => char === trimmed[0]);
};

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
 * Also escapes lines that remark would otherwise misinterpret as a horizontal break.
 *
 * @param {string} line - A single markdown line.
 * @returns {string} A viewer-safe markdown line.
 */
const prepareLineForViewer = (line: string): string => {
  const trimmedLine = line.trim();

  if (trimmedLine === "<br />") {
    return line;
  }

  const startTrimmed = line.trimStart();
  const isSingleMarker = startTrimmed.length === 1 && UNORDERED_LIST_MARKERS.has(startTrimmed);
  if (isHorizontalRule(startTrimmed) || isSingleMarker) {
    const leadingWhitespace = line.slice(0, line.length - startTrimmed.length);
    return preserveLeadingWhitespace(`${leadingWhitespace}\\${startTrimmed}`);
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

/**
 * Reads a link destination, keeping only absolute http(s) URLs.
 *
 * @param {string} [href] - The raw href from the parsed markdown.
 * @returns {string | null} The safe URL, or `null` when the href is missing or unsafe.
 *
 * @example
 * readSafeHref("https://google.com"); // "https://google.com/"
 * readSafeHref("javascript:alert(1)"); // null
 */
const readSafeHref = (href?: string): string | null => {
  if (!href) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!LINK_PROTOCOLS.has(url.protocol)) {
    return null;
  }

  return url.href;
};

/**
 * Renders a markdown link as a safe anchor that opens in a new tab, falling
 * back to plain content when the destination is not a valid http(s) URL.
 *
 * @param {object} props - The renderer props.
 * @param {ReactNode} [props.children] - The link content.
 * @param {string} [props.href] - The link destination.
 * @returns {ReactElement} The rendered link or its plain content.
 */
const renderLink = ({ children, href }: { children?: ReactNode; href?: string }): ReactElement => {
  const safeHref = readSafeHref(href);

  if (!safeHref) {
    return children as ReactElement;
  }

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

/**
 * Removed attributes from elements to avoid unsafe assignments. Links keep a
 * sanitized href through their dedicated renderer.
 */
const SANITIZED_COMPONENTS: Components = {
  ...(Object.fromEntries(
    MARKDOWN_ATTRIBUTE_FREE_ELEMENTS.map((tag) => [
      tag,
      ({ children }: { children?: ReactNode }) => createElement(tag, null, children),
    ])
  ) as Components),
  a: renderLink,
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
      components={SANITIZED_COMPONENTS}
    >
      {prepareMarkdownForViewer(content)}
    </StyledMarkdown>
  );
};

export default RichTextViewer;
