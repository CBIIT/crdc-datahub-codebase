import { IconButton, Tooltip as MuiToolTip, TooltipProps, styled } from "@mui/material";
import { useState } from "react";

import infoCircleIcon from "../../assets/icons/info_circle.svg?url";

const InfoIcon = styled("div")(() => ({
  backgroundImage: `url("${infoCircleIcon}")`,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  width: "12px",
  height: "12px",
}));

const StyledTooltip = styled((props: TooltipProps) => (
  <MuiToolTip classes={{ popper: props?.className }} {...props} />
))(() => ({
  "& .MuiTooltip-tooltip": {
    maxWidth: "412px",
    minHeight: "43px",
    color: "#2B528B",
    border: "1px solid #2B528B",
    background: "#FFFFFF",
    padding: "12px 15px",
    borderRadius: "12px",
    fontWeight: "400",
    fontFamily: "'Inter', 'Rubik', sans-serif",
    fontSize: "16px",
    lineHeight: "19px",
    boxShadow: "0px 4px 10px 0px rgba(0, 0, 0, 0.15)",
  },
}));

const TooltipButton = styled(IconButton)(() => ({
  padding: 0,
  fontSize: "12px",
  verticalAlign: "top",
  marginLeft: "6px",
  color: "#000000",
}));

const TooltipIcon = styled(InfoIcon)`
  font-size: 12px;
  color: inherit;
`;

type Props = {
  icon?: React.ReactElement | JSX.Element;
} & Partial<TooltipProps>;

const Tooltip = ({ classes, icon, children, title, ...rest }: Props) => {
  const [tooltipIsOpen, setTooltipIsOpen] = useState<boolean>(false);

  const toggleTooltip = () => {
    setTooltipIsOpen((tooltipIsOpen) => !tooltipIsOpen);
  };

  const closeTooltip = () => {
    setTooltipIsOpen(false);
  };

  return (
    <StyledTooltip
      open={tooltipIsOpen}
      onBlur={closeTooltip}
      title={title || ""}
      placement="right"
      disableHoverListener
      {...rest}
    >
      {children ?? (
        <TooltipButton onClick={toggleTooltip} aria-label="Toggle Tooltip" disableRipple>
          {icon ?? <TooltipIcon />}
        </TooltipButton>
      )}
    </StyledTooltip>
  );
};

export default Tooltip;
