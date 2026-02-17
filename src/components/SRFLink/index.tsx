import { IconButton, IconButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { memo, useMemo } from "react";
import { Link, LinkProps } from "react-router-dom";

import PageIconSvg from "@/assets/icons/page_icon.svg?react";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledIconButton = styled(IconButton)<
  { component: React.ElementType } & Pick<LinkProps, "to" | "target">
>(({ disabled }) => ({
  cursor: disabled ? "not-allowed" : "pointer",
  padding: "0px",
  minWidth: "unset",
  color: disabled ? "#787878" : "#005999",
}));

type Props = {
  /**
   * The Submission Request Form ID associated Data Submission.
   */
  appId: string;
} & Omit<IconButtonProps, "onClick">;

/**
 * Provides a button to view a Submission Request Form associated
 * with a Data Submission, if it exists.
 *
 * @returns The Submission Request Form Action Button component.
 */
const SRFLink = ({ appId, disabled, ...rest }: Props) => {
  const tooltip = useMemo<string>(
    () =>
      disabled
        ? "You don't have permission to view the Submission Request Form for this study."
        : "Click to open the Submission Request Form for this study.",
    [disabled]
  );

  if (!appId) {
    return null;
  }

  return (
    <StyledTooltip
      title={tooltip}
      placement="top"
      aria-label="Submission Request Form Action Tooltip"
      data-testid={`view-submission-request-form-tooltip-${appId}`}
      disableInteractive
      arrow
    >
      <span>
        <StyledIconButton
          component={Link}
          to={`/submission-request/${appId}`}
          target="_blank"
          disabled={disabled}
          aria-label="View Submission Request Form icon"
          data-testid="view-submission-request-form-button"
          disableRipple
          {...rest}
        >
          <PageIconSvg />
        </StyledIconButton>
      </span>
    </StyledTooltip>
  );
};

export default memo<Props>(SRFLink, isEqual);
