import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

const MARKDOWN_ALLOWED_ELEMENTS = ["p", "strong", "em", "u", "ul", "ol", "li"] as const;

type RichTextViewerProps = {
  content: string;
  className?: string;
};

const RichTextViewer = ({ content, className }: RichTextViewerProps): ReactElement | null => {
  if (!content.trim()) {
    return null;
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      allowedElements={[...MARKDOWN_ALLOWED_ELEMENTS]}
      unwrapDisallowed
    >
      {content}
    </ReactMarkdown>
  );
};

export default RichTextViewer;
