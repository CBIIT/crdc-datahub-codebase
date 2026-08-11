import { styled } from "@mui/material";
import type { ReactElement } from "react";
import type { RenderElementProps } from "slate-react";

import type { CustomElement } from "./types";
import { isLinkElement } from "./utils/editorGuards";

const StyledEditorLink = styled("a")({
  color: "#1976d2",
  textDecoration: "underline",
  cursor: "pointer",
});

type ElementRenderer = (props: RenderElementProps) => ReactElement;

const renderParagraph: ElementRenderer = ({ attributes, children }) => (
  <p {...attributes}>{children}</p>
);

const renderLink: ElementRenderer = ({ attributes, children, element }) => {
  if (!isLinkElement(element)) {
    return renderParagraph({ attributes, children, element });
  }

  return (
    <StyledEditorLink {...attributes} href={element.url} target="_blank" rel="noopener noreferrer">
      {children}
    </StyledEditorLink>
  );
};

const ELEMENT_RENDERERS: Record<CustomElement["type"], ElementRenderer> = {
  paragraph: renderParagraph,
  "bulleted-list": ({ attributes, children }) => <ul {...attributes}>{children}</ul>,
  "numbered-list": ({ attributes, children }) => <ol {...attributes}>{children}</ol>,
  "list-item": ({ attributes, children }) => <li {...attributes}>{children}</li>,
  link: renderLink,
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
