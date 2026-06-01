import RedoIcon from "@mui/icons-material/Redo";
import UndoIcon from "@mui/icons-material/Undo";
import { IconButton, Tooltip, styled } from "@mui/material";
import type { SvgIconProps } from "@mui/material";
import type { ElementType, MouseEvent, ReactElement } from "react";
import { HistoryEditor } from "slate-history";
import { useSlate } from "slate-react";

import type { BlockFormat, MarkFormat } from "./types";
import { isBlockActive, isMarkActive, toggleBlock, toggleMark } from "./utils/editorTransforms";

const StyledIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ active }) => ({
  borderRadius: "4px",
  padding: "4px",
  color: active ? "#1976d2" : "#616161",
  backgroundColor: active ? "rgba(25, 118, 210, 0.08)" : "transparent",
  "&:hover": {
    backgroundColor: active ? "rgba(25, 118, 210, 0.12)" : "rgba(0, 0, 0, 0.04)",
  },
}));

export type ToolbarIcon = ElementType<SvgIconProps>;

export type MarkButtonConfig = {
  format: MarkFormat;
  tooltip: string;
  icon: ToolbarIcon;
};

export type BlockButtonConfig = {
  format: BlockFormat;
  tooltip: string;
  icon: ToolbarIcon;
};

type Props = {
  label: string;
  tooltip: string;
  icon: ToolbarIcon;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onMouseDown: (event: MouseEvent) => void;
};

const ToolbarButton = ({
  label,
  tooltip,
  icon: Icon,
  active = false,
  pressed,
  disabled = false,
  onMouseDown,
}: Props): ReactElement => (
  <Tooltip title={tooltip} placement="top">
    <span>
      <StyledIconButton
        active={active}
        onMouseDown={onMouseDown}
        aria-label={label}
        aria-pressed={pressed}
        size="small"
        disabled={disabled}
      >
        <Icon />
      </StyledIconButton>
    </span>
  </Tooltip>
);

/**
 * Toolbar button that toggles an inline mark for the active Slate selection.
 */
export const MarkButton = ({ format, tooltip, icon }: MarkButtonConfig): ReactElement => {
  const editor = useSlate();
  const active = isMarkActive(editor, format);

  const handleMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    toggleMark(editor, format);
  };

  return (
    <ToolbarButton
      label={tooltip}
      tooltip={tooltip}
      icon={icon}
      active={active}
      pressed={active}
      onMouseDown={handleMouseDown}
    />
  );
};

/**
 * Toolbar button that toggles a block format for the active Slate selection.
 */
export const BlockButton = ({ format, tooltip, icon }: BlockButtonConfig): ReactElement => {
  const editor = useSlate();
  const active = isBlockActive(editor, format);

  const handleMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    toggleBlock(editor, format);
  };

  return (
    <ToolbarButton
      label={tooltip}
      tooltip={tooltip}
      icon={icon}
      active={active}
      pressed={active}
      onMouseDown={handleMouseDown}
    />
  );
};

/**
 * Toolbar button that performs Slate history undo.
 */
export const UndoButton = (): ReactElement => {
  const editor = useSlate();
  const canUndo = editor.history.undos.length > 0;

  const handleMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    HistoryEditor.undo(editor);
  };

  return (
    <ToolbarButton
      label="Undo"
      tooltip="Undo (Ctrl+Z)"
      icon={UndoIcon}
      disabled={!canUndo}
      onMouseDown={handleMouseDown}
    />
  );
};

/**
 * Toolbar button that performs Slate history redo.
 */
export const RedoButton = (): ReactElement => {
  const editor = useSlate();
  const canRedo = editor.history.redos.length > 0;

  const handleMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    HistoryEditor.redo(editor);
  };

  return (
    <ToolbarButton
      label="Redo"
      tooltip="Redo (Ctrl+Y)"
      icon={RedoIcon}
      disabled={!canRedo}
      onMouseDown={handleMouseDown}
    />
  );
};
