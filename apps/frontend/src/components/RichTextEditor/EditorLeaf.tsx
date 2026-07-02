import { createElement, type ReactElement, type ReactNode } from "react";
import type { RenderLeafProps } from "slate-react";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

/**
 * Renders a Slate text leaf with the appropriate inline formatting elements.
 *
 * @returns {JSX.Element}
 */
const EditorLeaf = ({ attributes, children, leaf }: RenderLeafProps): ReactElement => {
  const markedContent = MARK_DEFINITIONS.reduce<ReactNode>((content, { format, htmlTag }) => {
    if (!leaf[format]) {
      return content;
    }

    return createElement(htmlTag, null, content);
  }, children);

  return <span {...attributes}>{markedContent}</span>;
};

export default EditorLeaf;
