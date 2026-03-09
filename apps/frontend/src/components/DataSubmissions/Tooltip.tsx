import {
  Box,
  ClickAwayListener,
  Tooltip as MuiToolTip,
  TooltipProps,
  Typography,
  styled,
} from "@mui/material";
import { cloneElement, useState } from "react";

const StyledTooltip = styled((props: TooltipProps) => (
  <MuiToolTip classes={{ popper: props.className }} {...props} />
))(() => ({
  cursor: "pointer",
  "& .MuiTooltip-tooltip": {
    cursor: "initial",
    maxWidth: "264px",
    width: "264px",
    minHeight: "43px",
    color: "#2B528B",
    border: "1px solid #2B528B",
    background: "#FFFFFF",
    padding: "13px 21px 17px",
    borderRadius: "12px",
    fontWeight: "400",
    fontFamily: "'Inter', 'Rubik', sans-serif",
    fontSize: "16px",
    lineHeight: "19px",
    boxShadow: "0px 4px 10px 0px rgba(0, 0, 0, 0.15)",
  },
}));

const StyledTitle = styled(Typography)(() => ({
  color: "#346798",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontSize: "14px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "20px",
}));

const StyledSubtitle = styled(Typography)(() => ({
  color: "#346798",
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontSize: "18px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "20px",
}));

const StyledBodyWrapper = styled("div")(() => ({
  color: "#595959",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
  textWrap: "initial",
}));

type Props = TooltipProps & {
  icon?: React.ReactElement | JSX.Element;
  title?: string;
  subtitle?: string;
  body?: string | JSX.Element;
};

const Tooltip = ({
  classes,
  icon,
  children,
  title,
  subtitle,
  body,
  placement,
  disableFocusListener,
  disableHoverListener,
  disableTouchListener,
  ...rest
}: Props) => {
  const [open, setOpen] = useState(false);

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  const toggleTooltip = () => {
    setOpen((prev) => !prev);
  };

  return (
    <ClickAwayListener onClickAway={handleTooltipClose}>
      <Box
        onMouseOver={!disableHoverListener ? handleTooltipOpen : undefined}
        onMouseOut={!disableHoverListener ? handleTooltipClose : undefined}
        onTouchStart={!disableTouchListener ? handleTooltipOpen : undefined}
        onFocus={!disableFocusListener ? handleTooltipOpen : undefined}
        onBlur={!disableFocusListener ? handleTooltipClose : undefined}
        sx={{ width: "100%" }}
      >
        <StyledTooltip
          {...rest}
          PopperProps={{
            disablePortal: true,
            ...rest.PopperProps,
          }}
          open={open}
          onClose={handleTooltipClose}
          title={
            <>
              {title && <StyledTitle variant="h5">{title}</StyledTitle>}
              {subtitle && <StyledSubtitle variant="h6">{subtitle}</StyledSubtitle>}
              {body && <StyledBodyWrapper>{body}</StyledBodyWrapper>}
            </>
          }
          placement={placement || "bottom"}
        >
          {cloneElement(children, {
            onClick: disableHoverListener ? toggleTooltip : handleTooltipOpen,
          })}
        </StyledTooltip>
      </Box>
    </ClickAwayListener>
  );
};

export default Tooltip;
