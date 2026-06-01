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

const renderMarkedContent = ({ children, leaf }: RenderLeafProps): ReactNode =>
  LEAF_MARK_RENDERERS.reduce<ReactNode>((content, markRenderer) => {
    if (!leaf[markRenderer.format]) {
      return content;
    }

    return markRenderer.render(content);
  }, children);

const EditorLeaf = ({ attributes, children, leaf, text }: RenderLeafProps): ReactElement => (
  <span {...attributes}>{renderMarkedContent({ attributes, children, leaf, text })}</span>
);

export default EditorLeaf;
