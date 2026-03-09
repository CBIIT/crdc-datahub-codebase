import { Grid, Stack, Typography, styled } from "@mui/material";
import { memo } from "react";

import CopyTextButton from "../CopyTextButton";
import TruncatedText from "../TruncatedText";

const StyledLabel = styled(Typography)(() => ({
  color: "#000000",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "19.6px",
  letterSpacing: "0.52px",
  textTransform: "uppercase",
}));

export const StyledValue = styled(Typography)(() => ({
  color: "#595959",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
  display: "inline",
}));

type Props = {
  /**
   * The name of the property.
   */
  label: string;
  /**
   * The value of the property.
   */
  value: string | JSX.Element;
  /**
   * The tooltip text for the value text.
   */
  tooltipText?: string;
  /**
   * Indicates whether the value text tooltip
   * should be disabled.
   */
  disableTooltip?: boolean;
  /**
   * Indicates if the copy to clipboard icon should
   * be displayed or not.
   */
  showCopyTextIcon?: boolean;
  /**
   * The text that will be copied to clipboard.
   */
  copyText?: string;
  /**
   * The tooltip text for the copy to clipboard icon button.
   */
  copyTooltipText?: string;
  /**
   * The number of characters to be shown before truncation occurs
   */
  truncateAfter?: number | false;
};

const SubmissionHeaderProperty = ({
  label,
  value,
  tooltipText,
  disableTooltip,
  showCopyTextIcon,
  copyText,
  copyTooltipText,
  truncateAfter = 16,
}: Props) => {
  const disableHoverListener = showCopyTextIcon ? false : undefined;

  return (
    <Grid lg={6} xs={12} item>
      <Stack direction="row" alignItems="center" width="100%" maxWidth="100%" spacing={2.75}>
        <StyledLabel variant="body1">{label}</StyledLabel>
        <Stack
          flexDirection="row"
          flexGrow={1}
          alignItems="flex-start"
          overflow="hidden"
          lineHeight="16px"
        >
          {typeof value === "string" ? (
            <StyledValue variant="body1" data-testid="property-value">
              {truncateAfter && truncateAfter > 0 ? (
                <TruncatedText
                  text={value}
                  maxCharacters={truncateAfter}
                  underline={false}
                  disableHoverListener={disableTooltip ? true : disableHoverListener}
                  wrapperSx={{ lineHeight: "19.6px" }}
                  tooltipText={tooltipText}
                  ellipsis
                  arrow
                />
              ) : (
                value
              )}
            </StyledValue>
          ) : (
            value
          )}

          {showCopyTextIcon && (
            <CopyTextButton
              data-testid={`copy-${label}-button`}
              aria-label={`Copy ${label}`}
              disabled={!copyText}
              title={copyTooltipText}
              copyText={copyText}
              sx={{ marginLeft: "8px" }}
            />
          )}
        </Stack>
      </Stack>
    </Grid>
  );
};

export default memo(SubmissionHeaderProperty);
