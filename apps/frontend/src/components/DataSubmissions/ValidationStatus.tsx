import { Box, styled } from "@mui/material";
import { useMemo } from "react";

import BellIcon from "../../assets/icons/bell_icon.svg?react";
import { FormatDate, capitalizeFirstLetter as capitalizeFirst } from "../../utils";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

const StyledChip = styled(Box, { shouldForwardProp: (p) => p !== "variant" })<{
  variant: "green" | "red";
}>(({ variant }) => ({
  backgroundColor: variant === "green" ? "#EDF5F3" : "#FCF7F2",
  border: `1px solid ${variant === "green" ? "#2A836D" : "#F87C46"}`,
  borderRadius: "8px",
  color: variant === "green" ? "#165848" : "#903813",
  fontWeight: 600,
  fontFamily: "Public Sans",
  fontSize: "13px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
  maxWidth: "229px",
  padding: "5px 9px",
}));

const StyledBellIcon = styled(BellIcon)({
  width: "17px",
  height: "auto",
  marginRight: "7px",
});

/**
 * Provides the implementation for the ValidationControls current validation Status text.
 *
 * @returns {React.FC}
 */
export const ValidationStatus: React.FC = () => {
  const { data } = useSubmissionContext();
  const { validationStarted, validationEnded, validationScope, validationType } =
    data?.getSubmission || {};

  const hadValidation: boolean = useMemo<boolean>(
    () =>
      !!validationStarted || !!validationEnded || !!validationScope || validationType?.length > 0,
    [validationStarted, validationEnded, validationScope, validationType]
  );

  const typeDescription: string = useMemo<string>(() => {
    if (validationType?.length === 1 && validationType.includes("file")) {
      return "Data Files";
    }
    if (validationType?.length === 1 && validationType.includes("metadata")) {
      return "Metadata";
    }

    return "Both";
  }, [validationType]);

  const titleText = useMemo<string>(() => {
    const typeAndTarget = `(Type: ${typeDescription}, Target: ${capitalizeFirst(
      validationScope || ""
    )} Uploaded Data)`;
    const startDate = FormatDate(validationStarted, "MM-DD-YYYY [at] hh:mm A", "N/A");
    const endDate = FormatDate(validationEnded, "MM-DD-YYYY [at] hh:mm A", "N/A");

    const inProgressTemplate = `The validation ${typeAndTarget} started on ${startDate} and is still in progress...`;
    const completedTemplate = `The last validation ${typeAndTarget} that ran on ${startDate} was completed on ${endDate}.`;

    return validationEnded ? completedTemplate : inProgressTemplate;
  }, [validationStarted, validationEnded, typeDescription, validationType, validationScope]);

  // No validation has ever been run, hide the component
  if (!hadValidation) {
    return null;
  }

  return (
    <StyledTooltip title={titleText} placement="bottom" data-testid="validation-status-tooltip">
      <StyledChip data-testid="validation-status-chip" variant={validationEnded ? "green" : "red"}>
        <StyledBellIcon data-testid="validation-status-icon" />
        {`VALIDATION ${validationEnded ? "COMPLETED" : "IN-PROGRESS..."}`}
      </StyledChip>
    </StyledTooltip>
  );
};
