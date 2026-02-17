import { Button, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import { CSSProperties, FC, useCallback, useState } from "react";

import BellIcon from "../../../assets/icons/border_filled_bell_icon.svg?react";
import { TOOLTIP_TEXT } from "../../../config/QuestionnaireTooltips";
import { FormatDate } from "../../../utils";
import { useFormContext } from "../../Contexts/FormContext";
import HistoryDialog from "../../HistoryDialog";
import TooltipList from "../../SummaryList/TooltipList";
import Tooltip from "../../Tooltip";

import { HistoryIconMap } from "./SubmissionRequestIconMap";

/**
 * Determines the text color for a History event based
 *
 * @param status The current Questionnaire's status
 * @returns Color scheme to match the status
 */
const getStatusColor = (status: ApplicationStatus): CSSProperties["color"] => {
  switch (status) {
    case "Approved":
      return "#10EBA9";
    case "Rejected":
      return "#FFA985";
    case "In Review":
      return "#4DC9FF";
    default:
      return "#fff";
  }
};

const StyledDate = styled("span")({
  fontWeight: "600",
  fontSize: "16px",
  fontFamily: "Public Sans",
  textTransform: "uppercase",
  color: "#2E5481",
  lineHeight: "22px",
  marginRight: "10px !important",
});

const StyledButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "192px",
    padding: "10px 20px",
    border: "1px solid #004A80",
    color: "#004A80",
    fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "17px",
    letterSpacing: "0.32px",
    textTransform: "none",
    "&:hover": {
      backgroundColor: "#FFF",
      borderColor: "#004A80",
      color: "#004A80",
    },
  },
});

const StyledBellIcon = styled(BellIcon)({
  width: "18px",
  marginLeft: "5px",
  color: "#C94313",
});

/**
 * Status Bar History Section
 *
 * @returns The History Section of the Status Bar
 */
const HistorySection: FC = () => {
  const {
    data: { updatedAt, history, conditional, pendingConditions },
  } = useFormContext();
  const [open, setOpen] = useState<boolean>(false);

  const buildStatusWrapper = useCallback(
    (status: ApplicationStatus): React.FC<{ children: React.ReactNode }> => {
      // Show pending conditions if they exist
      if ((conditional || pendingConditions?.length > 0) && status === "Approved") {
        return ({ children }) => (
          <Tooltip
            title={<TooltipList data={pendingConditions} />}
            placement="top"
            open={undefined}
            disableHoverListener={false}
            disableInteractive
            arrow
          >
            <Stack
              direction="row"
              alignItems="center"
              data-testid="status-bar-pending-conditions"
              sx={{ cursor: "pointer" }}
            >
              {children}
              <StyledBellIcon />
            </Stack>
          </Tooltip>
        );
      }

      // No pending conditions, show tooltip with status description
      return ({ children }) => (
        <Tooltip
          title={TOOLTIP_TEXT.STATUS_DESCRIPTIONS[status]}
          placement="top"
          open={undefined}
          disableHoverListener={false}
          disableInteractive
          arrow
        >
          <span>{children}</span>
        </Tooltip>
      );
    },
    [conditional, pendingConditions]
  );

  return (
    <>
      <StyledDate data-testid="status-bar-last-updated">
        {FormatDate(updatedAt, "M/D/YYYY", "N/A")}
      </StyledDate>

      {history && history.length > 0 && (
        <>
          <StyledButton
            id="status-bar-full-history-button"
            variant="contained"
            color="info"
            onClick={() => setOpen(true)}
            aria-label="Full History"
            disableElevation
          >
            Full History
          </StyledButton>
          <HistoryDialog
            preTitle="CRDC Submission Request"
            title="Submission History"
            history={history}
            iconMap={HistoryIconMap}
            getTextColor={getStatusColor}
            getStatusWrapper={buildStatusWrapper}
            open={open}
            onClose={() => setOpen(false)}
            showHeaders={false}
            data-testid="status-bar-history-dialog"
          />
        </>
      )}
    </>
  );
};

export default HistorySection;
