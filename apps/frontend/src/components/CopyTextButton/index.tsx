import { IconButton, IconButtonProps, styled, TooltipProps } from "@mui/material";
import { forwardRef, memo } from "react";

import CopyIconSvg from "../../assets/icons/copy_icon_2.svg?react";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

const StyledCopyIDButton = styled(IconButton)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: 0,
  height: "fit-content",
  margin: 0,
  "&.MuiIconButton-root.Mui-disabled": {
    opacity: theme.palette.action.disabledOpacity,
    cursor: "not-allowed",
  },
}));

const CopyButton = forwardRef<HTMLButtonElement, IconButtonProps>((props: IconButtonProps, ref) => (
  <StyledCopyIDButton
    ref={ref}
    data-testid="copy-text-button"
    aria-label="Copy text to clipboard"
    {...props}
  >
    <CopyIconSvg />
  </StyledCopyIDButton>
));

type Props = {
  /**
   * Indicates whether the button should be disabled.
   */
  disabled?: boolean;
  /**
   * The props that will be assigned to the tooltip component.
   */
  tooltipProps?: TooltipProps;
  /**
   * The text that will be copied to clipboard.
   */
  copyText: string;
  /**
   * The callback function after the text is copied to clipbaord.
   * @param text the text that was copied.
   * @returns void
   */
  onCopy?: (text: string) => void;
} & IconButtonProps;

const CopyTextButton = ({
  title,
  disabled = false,
  copyText,
  onCopy,
  tooltipProps,
  ...rest
}: Props) => {
  const handleCopyText = () => {
    if (!copyText?.trim()) {
      return;
    }

    navigator.clipboard.writeText(copyText);
    onCopy?.(copyText);
  };

  return title && !disabled ? (
    <StyledTooltip
      placement="top"
      title={title}
      open={undefined}
      disableHoverListener={!title}
      arrow
      dynamic
      {...tooltipProps}
    >
      <CopyButton onClick={handleCopyText} disabled={disabled} {...rest} />
    </StyledTooltip>
  ) : (
    <CopyButton onClick={handleCopyText} disabled={disabled} {...rest} />
  );
};

export default memo(CopyTextButton);
