import type { ReactElement, ReactNode } from "react";
import type { RenderLeafProps } from "slate-react";

import type { MarkFormat } from "./types";

type LeafRenderer = (children: ReactNode) => ReactElement;

type LeafMarkRenderer = {
  format: MarkFormat;
  render: LeafRenderer;
};

const LEAF_MARK_RENDERERS: LeafMarkRenderer[] = [
  {
    format: "bold",
    render: (children) => <strong>{children}</strong>,
  },
  {
    format: "italic",
    render: (children) => <em>{children}</em>,
  },
  {
    format: "underline",
    render: (children) => <u>{children}</u>,
  },
];

/**
 * Renders a Slate text leaf with the appropriate inline formatting elements.
 *
 * @returns {JSX.Element}
 */
const EditorLeaf = ({ attributes, children, leaf }: RenderLeafProps): ReactElement => {
  const markedContent = LEAF_MARK_RENDERERS.reduce<ReactNode>((content, { format, render }) => {
    if (!leaf[format]) {
      return content;
    }

    return render(content);
  }, children);

  return <span {...attributes}>{markedContent}</span>;
};

export default EditorLeaf;
