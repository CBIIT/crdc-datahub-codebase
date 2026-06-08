import { IconButton, Tooltip, styled } from "@mui/material";
import type { MouseEvent, ReactElement } from "react";

import { ToolbarIcon } from "@/config/toolbarConfig";

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

type Props = {
  label: string;
  tooltip: string;
  icon: ToolbarIcon;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onMouseDown: (event: MouseEvent) => void;
};

/**
 * An icon button displayed in the rich text toolbar.
 *
 * @returns {JSX.Element}
 */
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

export default ToolbarButton;
