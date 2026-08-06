import { Avatar, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import { CSSProperties, FC, useMemo, useState } from "react";

import { SortHistory } from "../../../utils";
import { useFormContext } from "../../Contexts/FormContext";
import ReviewCommentsDialog from "../../ReviewCommentsDialog";
import ReviewCommentsListDialog from "../../ReviewCommentsListDialog";

import { StatusIconMap } from "./SubmissionRequestIconMap";

/**
 * Returns the styling for a component based on the Questionnaire Status
 *
 * @param status The current Questionnaire's status
 * @returns Color scheme to match the status
 */
const getColorScheme = (status: ApplicationStatus): CSSProperties => {
  switch (status) {
    case "Approved":
      return {
        color: "#0D6E87 !important",
        background: "#CDEAF0 !important",
      };
    case "Rejected":
      return {
        color: "#B83700 !important",
        background: "#FFDBCB !important",
      };
    default:
      return {
        color: "#2E5481 !important",
        background: "#C0DAF3 !important",
      };
  }
};

const StyledAvatar = styled(Avatar)({
  background: "transparent",
  marginRight: "8px",
  marginLeft: "8px !important",
  width: "39px",
  height: "39px",
});

const StyledStatus = styled("span")<{
  status: ApplicationStatus;
  leftGap: boolean;
}>(({ status, leftGap }) => ({
  fontWeight: "600",
  fontSize: "16px",
  fontFamily: "Public Sans",
  textTransform: "uppercase",
  marginLeft: !leftGap ? "6px !important" : null,
  marginRight: "10px !important",
  letterSpacing: "0.32px",
  lineHeight: "22px",
  color: getColorScheme(status).color,
}));

const StyledButton = styled(Button)<{ status: ApplicationStatus }>(({ status }) => ({
  ...getColorScheme(status),
  fontWeight: "700",
  borderRadius: "8px",
  border: "0 !important",
  textTransform: "none",
  width: "165px",
  lineHeight: "19px",
  padding: "10px 20px 10px 20px",
}));

/**
 * Status Bar Application Status Section
 *
 * @returns The comprehensive status bar section.
 */
const StatusSection: FC = (): JSX.Element => {
  const {
    data: { status, history },
  } = useFormContext();

  const [openDialog, setOpenDialog] = useState<"list" | "detail" | null>(null);
  const [selectedReview, setSelectedReview] = useState<HistoryEvent | null>(null);

  const reviewEvents = useMemo<HistoryEvent[]>(
    () =>
      SortHistory(history).filter(
        (h: HistoryEvent) =>
          typeof h.reviewComment === "string" && h.reviewComment.trim().length > 0
      ),
    [history]
  );

  const handleCloseDialogs = () => {
    setOpenDialog(null);
    setSelectedReview(null);
  };

  const handleViewReview = (event: HistoryEvent) => {
    setSelectedReview(event);
    setOpenDialog("detail");
  };

  const handleBackToList = () => {
    setOpenDialog("list");
  };

  return (
    <>
      {StatusIconMap[status] && (
        <StyledAvatar>
          <img src={StatusIconMap[status]} alt={`${status} icon`} data-testid="status-bar-icon" />
        </StyledAvatar>
      )}
      <StyledStatus
        data-testid="status-bar-status"
        status={status}
        leftGap={!StatusIconMap[status]}
      >
        {status}
      </StyledStatus>

      {reviewEvents.length > 0 && (
        <>
          <StyledButton
            id="status-bar-review-comments-button"
            variant="contained"
            onClick={() => setOpenDialog("list")}
            aria-label="View Comments"
            status={status}
          >
            View Comments
          </StyledButton>
          {openDialog === "list" && (
            <ReviewCommentsListDialog
              open
              onClose={handleCloseDialogs}
              preTitle="CRDC Submission Request"
              events={reviewEvents}
              onView={handleViewReview}
            />
          )}
          {openDialog === "detail" && (
            <ReviewCommentsDialog
              open
              onClose={handleCloseDialogs}
              onBack={handleBackToList}
              status={status}
              lastReview={selectedReview}
              preTitle="CRDC Submission Request"
              title="Comments"
            />
          )}
        </>
      )}
    </>
  );
};

export default StatusSection;
