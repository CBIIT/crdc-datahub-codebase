import { Box, styled } from "@mui/material";
import type { ReactElement } from "react";

import { BLOCK_BUTTONS, MARK_BUTTONS } from "../../config/toolbarConfig";

import { BlockButton, MarkButton, RedoButton, UndoButton } from "./ToolbarButton";

const StyledToolbar = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "2px",
  padding: "6px 8px",
  borderBottom: "1px solid #E0E0E0",
  flexWrap: "wrap",
});

const ToolbarDivider = styled(Box)({
  width: "1px",
  height: "20px",
  backgroundColor: "#E0E0E0",
  margin: "0 4px",
});

const Toolbar = (): ReactElement => (
  <StyledToolbar data-testid="rich-text-editor-toolbar">
    {MARK_BUTTONS.map((button) => (
      <MarkButton key={button.format} {...button} />
    ))}
    {BLOCK_BUTTONS.map((button) => (
      <BlockButton key={button.format} {...button} />
    ))}
    <ToolbarDivider />
    <UndoButton />
    <RedoButton />
  </StyledToolbar>
);

export default Toolbar;
