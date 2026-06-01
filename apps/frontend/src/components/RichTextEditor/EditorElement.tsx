import type { ReactElement } from "react";
import type { RenderElementProps } from "slate-react";

import type { BlockFormat } from "./types";

type ElementRenderer = (props: RenderElementProps) => ReactElement;

const renderParagraph: ElementRenderer = ({ attributes, children }) => (
  <p {...attributes}>{children}</p>
);

const ELEMENT_RENDERERS: Record<BlockFormat, ElementRenderer> = {
  paragraph: renderParagraph,
  "bulleted-list": ({ attributes, children }) => <ul {...attributes}>{children}</ul>,
  "numbered-list": ({ attributes, children }) => <ol {...attributes}>{children}</ol>,
  "list-item": ({ attributes, children }) => <li {...attributes}>{children}</li>,
};

const getElementRenderer = (type: BlockFormat): ElementRenderer => {
  const renderer = ELEMENT_RENDERERS[type];

  if (!renderer) {
    return renderParagraph;
  }

  return renderer;
};

const EditorElement = (props: RenderElementProps): ReactElement =>
  getElementRenderer(props.element.type)(props);

export default EditorElement;
