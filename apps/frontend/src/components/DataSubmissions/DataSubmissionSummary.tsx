import { Button, Divider, Grid, Stack, Typography, styled } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import React, { FC, useMemo, useState } from "react";

import EditIconSvg from "@/assets/icons/pencil_icon.svg?react";

import EmailIconSvg from "../../assets/icons/email_icon.svg?react";
import { SortHistory } from "../../utils";
import { CollaboratorsDialog } from "../Collaborators";
import { useAuthContext } from "../Contexts/AuthContext";
import { CollaboratorsProvider } from "../Contexts/CollaboratorsContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import HistoryDialog from "../HistoryDialog";
import ReviewCommentsDialog from "../ReviewCommentsDialog";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";
import SubmissionUpdate from "../SubmissionUpdateDialog";
import TruncatedText from "../TruncatedText";

import DataSubmissionIconMap from "./DataSubmissionIconMap";
import EditSubmissionNameDialog from "./EditSubmissionNameDialog";
import SubmissionHeaderProperty, { StyledValue } from "./SubmissionHeaderProperty";

const StyledSummaryWrapper = styled("div")(() => ({
  borderRadius: "8px 8px 0px 0px",
  textWrap: "nowrap",
  padding: "25px 119px 25px 51px",
}));

const StyledSubmissionStatus = styled(Typography)(() => ({
  color: "#004A80",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "40px",
  minHeight: "40px",
}));

const StyledButtonWrapper = styled(Stack)(() => ({
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "10px",
  width: "100%",
}));

const StyledReviewCommentsButton = styled(Button)(() => ({
  "&.MuiButton-root": {
    minWidth: "168px",
    marginTop: "10px",
    padding: "11px 10px",
    border: "1px solid #B3B3B3",
    color: "#BE4511",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "17px",
    letterSpacing: "0.32px",
    "&:hover": {
      backgroundColor: "#FFF",
      borderColor: "#B3B3B3",
      color: "#BE4511",
    },
    "&:disabled": {
      backgroundColor: "#FFF",
      borderColor: "#B3B3B3",
      color: "#B1B1B1",
      fontWeight: 700,
    },
  },
}));

const StyledHistoryButton = styled(Button)(() => ({
  "&.MuiButton-root": {
    minWidth: "168px",
    marginBottom: "10px",
    padding: "11px 20px",
    border: "1px solid #B3B3B3",
    color: "#004A80",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "17px",
    letterSpacing: "0.32px",
    "&:hover": {
      backgroundColor: "#FFF",
      borderColor: "#B3B3B3",
      color: "#004A80",
    },
  },
}));

const StyledSectionDivider = styled(Divider)(() => ({
  "&.MuiDivider-root": {
    display: "flex",
    alignSelf: "flex-start",
    width: "2px",
    height: "157px",
    background: "#6CACDA",
    marginLeft: "48px",
    marginRight: "81px",
  },
}));

const StyledConciergeName = styled(StyledValue)(() => ({
  maxWidth: "100%",
  lineHeight: "19.6px",
  flexShrink: 1,
}));

const StyledCollaboratorsButton = styled(Button)({
  justifyContent: "flex-start",
  padding: 0,
  margin: 0,
  color: "#0B7F99",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "19.6px",
  minWidth: 0,
  textDecoration: "underline",
  "&:hover": {
    textDecoration: "underline",
  },
});

const StyledGridContainer = styled(Grid)(({ theme }) => ({
  "&.MuiGrid-container": {
    marginLeft: "0px",
    width: "100%",
    overflow: "hidden",
  },
  "& .MuiGrid-item:nth-of-type(2n + 1)": {
    paddingLeft: 0,
  },
  [theme.breakpoints.down("lg")]: {
    "& .MuiGrid-item": {
      paddingLeft: 0,
    },
  },
}));

const StyledEmailWrapper = styled("a")({
  marginLeft: "22px !important",
  lineHeight: "19.6px",
});

const StyledEditIcon = styled(EditIconSvg)({
  color: "#005999",
});

const buildReleasedStatusWrapper =
  (dataCommonsDisplayName: string): React.FC<{ children: React.ReactNode }> =>
  ({ children }) => (
    <StyledTooltip
      title={`Released to ${dataCommonsDisplayName}`}
      placement="top"
      open={undefined}
      arrow
    >
      <span>{children}</span>
    </StyledTooltip>
  );

const getHistoryTextColorFromStatus = (status: SubmissionStatus) => {
  let color: string;
  switch (status) {
    case "Completed":
      color = "#10EBA9";
      break;
    case "Rejected":
      color = "#FFA985";
      break;
    default:
      color = "#FFF";
  }

  return color;
};

type DialogOptions = "history" | "review comments" | "collaborators" | null;

type Props = {
  dataSubmission: Submission;
};

const DataSubmissionSummary: FC<Props> = ({ dataSubmission }) => {
  const [openDialog, setOpenDialog] = useState<DialogOptions>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { updateQuery } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const isPrimarySubmitter = user?._id === dataSubmission?.submitterID;
  const numCollaborators = dataSubmission?.collaborators?.length || 0;
  const lastReview = useMemo(
    () =>
      SortHistory(dataSubmission?.history).find(
        (h: HistoryBase<SubmissionStatus>) => h.status === "Rejected" && h.reviewComment?.length > 0
      ),
    [dataSubmission]
  );

  const handleOpenDialog = (dialog: DialogOptions) => {
    setOpenDialog(dialog);
  };

  const handleCloseDialog = () => {
    setOpenDialog(null);
  };

  return (
    <StyledSummaryWrapper>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing="14px">
        <Stack direction="column" alignItems="center" minWidth="192px">
          <StyledSubmissionStatus variant="h5" aria-label="Data Submission status">
            {dataSubmission?.status}
          </StyledSubmissionStatus>
          <StyledButtonWrapper>
            <StyledReviewCommentsButton
              variant="contained"
              color="info"
              onClick={() => handleOpenDialog("review comments")}
              disabled={!lastReview}
            >
              Review Comments
            </StyledReviewCommentsButton>
            <StyledHistoryButton
              variant="contained"
              color="info"
              onClick={() => handleOpenDialog("history")}
            >
              Full History
            </StyledHistoryButton>
          </StyledButtonWrapper>
        </Stack>

        <StyledSectionDivider orientation="vertical" />

        <StyledGridContainer
          container
          flexDirection={{ xs: "column", lg: "row" }}
          rowSpacing={2}
          columnSpacing={0}
        >
          <SubmissionHeaderProperty
            label="Submission Name"
            value={
              <Stack direction="row" alignItems="center" spacing={1}>
                <StyledValue data-testid="submission-name-display">
                  <TruncatedText
                    text={dataSubmission?.name}
                    maxCharacters={15}
                    ellipsis
                    underline={false}
                    tooltipText={dataSubmission?.name}
                  />
                </StyledValue>
                {isPrimarySubmitter && (
                  <IconButton
                    size="small"
                    onClick={() => setIsEditing(true)}
                    aria-label="Edit Submission Name"
                    sx={{ p: 0 }}
                    data-testid="edit-submission-name-icon"
                  >
                    <StyledEditIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            }
          />
          <SubmissionHeaderProperty
            label="Submission Type"
            value={dataSubmission?.intention}
            truncateAfter={false}
          />
          <SubmissionHeaderProperty
            label="Submitter"
            value={
              <Stack direction="row" alignItems="center" spacing={1}>
                <StyledValue>
                  <TruncatedText
                    text={dataSubmission?.submitterName}
                    maxCharacters={16}
                    underline={false}
                    tooltipText={dataSubmission?.submitterName}
                    ellipsis
                  />
                </StyledValue>
                <SubmissionUpdate icon={<StyledEditIcon />} />
              </Stack>
            }
          />
          <SubmissionHeaderProperty
            label="Collaborators"
            value={
              <StyledTooltip
                placement="top"
                title="Click to add new collaborators or view existing ones."
                disableHoverListener={!dataSubmission}
                slotProps={{
                  tooltip: { "data-testid": "collaborators-button-tooltip" } as unknown,
                }}
              >
                <span>
                  <StyledCollaboratorsButton
                    variant="text"
                    onClick={() => handleOpenDialog("collaborators")}
                    disabled={!dataSubmission}
                    data-testid="collaborators-button"
                  >
                    {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
                      numCollaborators
                    )}
                  </StyledCollaboratorsButton>
                </span>
              </StyledTooltip>
            }
          />
          <SubmissionHeaderProperty
            label="Study"
            value={dataSubmission?.studyAbbreviation || "NA"}
            tooltipText={dataSubmission?.studyName}
            disableTooltip={!dataSubmission?.studyName}
            copyText={dataSubmission?.studyName}
            copyTooltipText="Copy the Study full name"
            truncateAfter={25}
            showCopyTextIcon
          />
          <SubmissionHeaderProperty
            label="Data Commons"
            value={dataSubmission?.dataCommonsDisplayName}
            truncateAfter={false}
          />
          <SubmissionHeaderProperty
            label="Program"
            value={dataSubmission?.organization?.abbreviation || "NA"}
            tooltipText={dataSubmission?.organization?.name}
            disableTooltip={!dataSubmission?.organization?.name}
            copyText={dataSubmission?.organization?.name}
            copyTooltipText="Copy the Program full name"
            truncateAfter={23}
            showCopyTextIcon
          />
          <SubmissionHeaderProperty
            label="Data Concierge"
            value={
              <Stack direction="row" alignItems="center" spacing={1.375}>
                <StyledConciergeName>
                  <TruncatedText
                    text={dataSubmission?.conciergeName}
                    maxCharacters={16}
                    underline={false}
                    ellipsis
                  />
                </StyledConciergeName>
                {dataSubmission?.conciergeName && dataSubmission?.conciergeEmail && (
                  <StyledEmailWrapper
                    href={`mailto:${dataSubmission?.conciergeEmail}`}
                    aria-label="Email Data Concierge"
                    data-testid="email-primary-contact-link"
                  >
                    <EmailIconSvg />
                  </StyledEmailWrapper>
                )}
              </Stack>
            }
          />
        </StyledGridContainer>
      </Stack>
      <HistoryDialog
        open={openDialog === "history"}
        onClose={handleCloseDialog}
        preTitle="Data Submission"
        title="Submission History"
        history={dataSubmission?.history}
        iconMap={DataSubmissionIconMap}
        getTextColor={getHistoryTextColorFromStatus}
        getStatusWrapper={(status) =>
          status === "Released"
            ? buildReleasedStatusWrapper(dataSubmission?.dataCommonsDisplayName)
            : ({ children }) => children
        }
      />
      <ReviewCommentsDialog
        open={openDialog === "review comments"}
        onClose={handleCloseDialog}
        preTitle="Data Submission"
        lastReview={lastReview}
      />
      <CollaboratorsProvider>
        <CollaboratorsDialog
          open={openDialog === "collaborators"}
          onClose={handleCloseDialog}
          onSave={handleCloseDialog}
        />
      </CollaboratorsProvider>

      {isEditing && (
        <EditSubmissionNameDialog
          open={isEditing}
          submissionID={dataSubmission?._id}
          initialValue={dataSubmission?.name}
          onCancel={() => setIsEditing(false)}
          onSave={(newName) => {
            setIsEditing(false);
            updateQuery((prev) => ({
              ...prev,
              getSubmission: {
                ...prev.getSubmission,
                name: newName, // Use the new name from the mutation response
              },
            }));
            enqueueSnackbar("The Data Submission name has been successfully changed.", {
              variant: "success",
              autoHideDuration: 4000,
            });
          }}
        />
      )}
    </StyledSummaryWrapper>
  );
};

export default React.memo<Props>(DataSubmissionSummary, (prevProps, nextProps) =>
  isEqual(prevProps, nextProps)
);
