import { styled } from "@mui/material";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const MARKDOWN_ALLOWED_ELEMENTS = ["p", "br", "strong", "em", "u", "ul", "ol", "li"] as const;

const BLANK_LINE_RUN_PATTERN = /\n{3,}/g;

const StyledMarkdown = styled(ReactMarkdown)({
  lineHeight: "25px",

  "& p": {
    margin: "0 0 4px 0",
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
});

/**
 * Normalize the line endings to make it easier to differentiate from hard line breaks.
 *
 * @param value
 * @returns
 */
const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, "\n");

/**
 * Replace hard line breaks with <br> elements.
 */
const preserveBlankParagraphs = (value: string): string =>
  value.replace(BLANK_LINE_RUN_PATTERN, (lineBreaks) => {
    const blankParagraphCount = Math.ceil((lineBreaks.length - 2) / 2);
    const blankParagraphs = Array.from({ length: blankParagraphCount }, () => "<br />").join(
      "\n\n"
    );

    return `\n\n${blankParagraphs}\n\n`;
  });

type RichTextViewerProps = {
  content: string;
  className?: string;
};

const RichTextViewer = ({ content, className }: RichTextViewerProps): ReactElement | null => {
  if (!content.trim()) {
    return null;
  }

  const preservedContent = preserveBlankParagraphs(normalizeLineEndings(content));

  return (
    <StyledMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      allowedElements={[...MARKDOWN_ALLOWED_ELEMENTS]}
      unwrapDisallowed
    >
      {preservedContent}
    </StyledMarkdown>
  );
};

export default RichTextViewer;
