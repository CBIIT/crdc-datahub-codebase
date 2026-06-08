import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import { Box, styled } from "@mui/material";
import type { MouseEvent, ReactElement } from "react";
import { HistoryEditor } from "slate-history";
import { useSlate } from "slate-react";

import { BLOCK_DEFINITIONS, MARK_DEFINITIONS } from "../../config/EditorConfig";

import ToolbarButton from "./ToolbarButton";
import type { BlockFormat, MarkFormat } from "./types";
import { isBlockActive, isMarkActive, toggleBlock, toggleMark } from "./utils/editorTransforms";

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

const Toolbar = (): ReactElement => {
  const editor = useSlate();

  const handleMarkMouseDown = (format: MarkFormat) => (e: MouseEvent) => {
    e.preventDefault();
    toggleMark(editor, format);
  };

  const handleBlockMouseDown = (format: BlockFormat) => (e: MouseEvent) => {
    e.preventDefault();
    toggleBlock(editor, format);
  };

  const handleUndo = (e: MouseEvent) => {
    e.preventDefault();
    HistoryEditor.undo(editor);
  };

  const handleRedo = (e: MouseEvent) => {
    e.preventDefault();
    HistoryEditor.redo(editor);
  };

  return (
    <StyledToolbar data-testid="rich-text-editor-toolbar">
      {MARK_DEFINITIONS.map(({ format, tooltip, icon }) => (
        <ToolbarButton
          key={format}
          label={tooltip}
          tooltip={tooltip}
          icon={icon}
          active={isMarkActive(editor, format)}
          pressed={isMarkActive(editor, format)}
          onMouseDown={handleMarkMouseDown(format)}
        />
      ))}
      {BLOCK_DEFINITIONS.map(({ format, tooltip, icon }) => (
        <ToolbarButton
          key={format}
          label={tooltip}
          tooltip={tooltip}
          icon={icon}
          active={isBlockActive(editor, format)}
          pressed={isBlockActive(editor, format)}
          onMouseDown={handleBlockMouseDown(format)}
        />
      ))}
      <ToolbarDivider />
      <ToolbarButton
        label="Undo"
        tooltip="Undo (Ctrl+Z)"
        icon={UndoIcon}
        disabled={editor.history.undos.length === 0}
        onMouseDown={handleUndo}
      />
      <ToolbarButton
        label="Redo"
        tooltip="Redo (Ctrl+Y)"
        icon={RedoIcon}
        disabled={editor.history.redos.length === 0}
        onMouseDown={handleRedo}
      />
    </StyledToolbar>
  );
};

export default Toolbar;
