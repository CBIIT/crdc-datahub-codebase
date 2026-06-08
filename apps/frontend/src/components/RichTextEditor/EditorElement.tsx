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

/**
 * Renders a Slate block element as its corresponding HTML element.
 *
 */
const EditorElement = (props: RenderElementProps): ReactElement => {
  const renderer = ELEMENT_RENDERERS[props.element.type] ?? renderParagraph;

  return renderer(props);
};

export default EditorElement;
