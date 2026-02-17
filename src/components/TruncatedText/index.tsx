import { styled, SxProps } from "@mui/material";
import { FC, memo, useMemo } from "react";

import StyledTooltip from "../StyledFormComponents/StyledTooltip";

const StyledText = styled("span")(() => ({
  display: "inline",
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}));

const StyledTextWrapper = styled("span", {
  shouldForwardProp: (p) => p !== "truncated" && p !== "underline" && p !== "sx",
})<{ truncated: boolean; underline: boolean }>(({ truncated, underline }) => ({
  display: "inline",
  textDecoration: truncated && underline ? "underline" : "none",
  textDecorationStyle: "dashed",
  textUnderlineOffset: "4px",
  cursor: truncated ? "pointer" : "inherit",
  width: "fit-content",
}));

type Props = {
  /**
   * The displayed text that will be hoverable
   * when a truncation tooltip is available
   */
  text: string;
  /**
   * Provide custom text to show in the tooltip,
   * otherwise 'text' will be used
   */
  tooltipText?: string;
  /**
   * The max number of characters allowed before
   * truncation will occur
   */
  maxCharacters?: number;
  /**
   * A boolean indicating whether or not to display
   * an underline when truncation occurs
   */
  underline?: boolean;
  /**
   * A boolean indicating whether or not to display
   * an ellipsis when truncation occurs
   */
  ellipsis?: boolean;
  /**
   * A boolean indicating whether or not the tooltip
   * should disable the hover listener
   */
  disableHoverListener?: boolean;
  /**
   * A boolean indicating whether or not the user
   * can hover over the tooltip
   */
  disableInteractiveTooltip?: boolean;
  /**
   * A boolean to force showing the tooltip even when text is not truncated
   */
  forceTooltip?: boolean;
  /**
   * Indicates whether or not to show an arrow with the tooltip
   */
  arrow?: boolean;
  /**
   * Optional custom styling to apply on the wrapper element
   */
  wrapperSx?: SxProps;
  /**
   * Optional custom styling to apply on the label element
   */
  labelSx?: SxProps;
};

/**
 * A component that truncates text to a specified number of characters.
 * If truncated, it displays an ellipsis and shows the full text in a tooltip on hover.
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const TruncatedText: FC<Props> = ({
  text,
  tooltipText,
  maxCharacters = 10,
  underline = true,
  ellipsis = true,
  disableHoverListener,
  disableInteractiveTooltip = true,
  forceTooltip = false,
  arrow = false,
  wrapperSx = {},
  labelSx = {},
}: Props) => {
  const isTruncated = useMemo<boolean>(() => text?.length > maxCharacters, [text, maxCharacters]);

  const displayText = useMemo<string>(() => {
    if (isTruncated) {
      return `${text?.trim()?.slice(0, maxCharacters)?.trim()}${ellipsis ? "..." : ""}`;
    }
    return text || "";
  }, [isTruncated, text, maxCharacters, ellipsis]);

  const shouldShowTooltip = forceTooltip || isTruncated;

  return (
    <StyledTooltip
      placement="top"
      title={tooltipText || text || ""}
      disableHoverListener={
        disableHoverListener !== undefined ? disableHoverListener : !shouldShowTooltip
      }
      disableInteractive={disableInteractiveTooltip}
      data-testid="truncated-text-tooltip"
      arrow={arrow}
      dynamic
    >
      <StyledTextWrapper
        truncated={shouldShowTooltip}
        underline={underline}
        data-testid="truncated-text-wrapper"
        sx={wrapperSx}
      >
        <StyledText data-testid="truncated-text-label" sx={labelSx}>
          {displayText}
        </StyledText>
      </StyledTextWrapper>
    </StyledTooltip>
  );
};

export default memo<Props>(TruncatedText);
