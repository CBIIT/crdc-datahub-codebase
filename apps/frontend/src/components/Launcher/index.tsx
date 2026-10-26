import { IconButton, Tooltip, TooltipProps, styled, tooltipClasses } from "@mui/material";
import { FC, memo } from "react";

import { useLauncherItems } from "../Contexts/LauncherContext";

const StyledLauncher = styled("aside")({
  position: "fixed",
  top: "65%",
  right: "16px",
  transform: "translateY(-50%)",
  zIndex: 1250,
  width: "68px",
  padding: "5px",
  backgroundColor: "#083A50",
  border: "1px solid #FFFFFF",
  borderRadius: "20px",
  boxShadow: "0px 4px 20px rgba(8, 58, 80, 0.35)",
});

const StyledList = styled("ul")({
  display: "flex",
  flexDirection: "column",
  margin: 0,
  padding: 0,
  listStyle: "none",
});

const StyledListItem = styled("li")({
  display: "flex",
  justifyContent: "center",
  "& + &": {
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid rgba(255, 255, 255, 0.35)",
  },
});

const StyledItemButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== "gradient",
})<{ gradient: string }>(({ gradient }) => ({
  width: "54px",
  height: "49px",
  padding: 0,
  borderRadius: "15px",
  color: "#FFFFFF",
  "& svg": {
    maxWidth: "36px",
    maxHeight: "36px",
  },
  "&:hover, &.Mui-focusVisible, &[aria-pressed='true']": {
    background: gradient,
  },
  "&.Mui-focusVisible": {
    outline: "2px solid #FFFFFF",
    outlineOffset: "2px",
  },
}));

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: "84px",
    padding: "4px 6px",
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.35)",
    color: "#6A6A6A",
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 500,
    fontSize: "12px",
    lineHeight: "12px",
    letterSpacing: "0.02em",
    textAlign: "center",
  },
});

/**
 * A floating column of buttons that open features.
 *
 * @returns {JSX.Element | null} The launcher, or nothing when there are no items.
 */
const Launcher: FC = () => {
  const items = useLauncherItems();

  if (!items?.length) {
    return null;
  }

  return (
    <StyledLauncher aria-label="Feature launcher">
      <StyledList>
        {items.map(({ id, label, icon: Icon, gradient, isActive = false, onClick }) => (
          <StyledListItem key={id}>
            <StyledTooltip title={label} placement="left">
              <StyledItemButton
                aria-label={label}
                aria-pressed={isActive}
                gradient={gradient}
                onClick={onClick}
                disableRipple
              >
                <Icon aria-hidden="true" />
              </StyledItemButton>
            </StyledTooltip>
          </StyledListItem>
        ))}
      </StyledList>
    </StyledLauncher>
  );
};

export default memo(Launcher);
