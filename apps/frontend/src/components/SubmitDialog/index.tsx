import { useQuery } from "@apollo/client";
import {
  Button,
  Dialog,
  DialogProps,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { memo } from "react";

import {
  GET_SUBMISSION_SUMMARY,
  GetSubmissionSummaryInput,
  GetSubmissionSummaryResp,
} from "@/graphql";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import { useSubmissionContext } from "../Contexts/SubmissionContext";

import SubmitSummaryTable from "./SubmitSummaryTable";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "702px !important",
    padding: "38px 53.5px 60px",
    borderRadius: "8px",
    border: "2px solid #6B7294",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledCloseButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "128px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    backgroundColor: "white",
  },
});

const StyledConfirmButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "128px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
  },
});

const StyledTitle = styled(Typography)({
  color: "#929292",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  lineHeight: "21px",
  marginBottom: "5px",
});

const StyledHeader = styled(Typography)({
  color: "#077A94",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "30px",
  marginBottom: "45px",
});

const StyledDescription = styled("div")({
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "22px",
  marginBottom: "20px",
  letterSpacing: "0.02em",
});

const StyledIntentionLabel = styled(Typography)({
  color: "#083650",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "19.6px",
});

const StyledIntentionValue = styled(Typography)({
  color: "#000000",
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: "18px",
});

const StyledIntentionWrapper = styled(Stack)({
  marginTop: "57px",
  marginBottom: "15.5px",
  gap: "21px",
  justifyContent: "flex-start",
  alignItems: "center",
  flexDirection: "row",
});

/**
 * Skeleton widths for the loading state.
 */
const SKELETON_WIDTHS = {
  intention: 75,
} as const;

type Props = {
  /**
   * The main text content displayed in the dialog body.
   */
  bodyText: string;
  /**
   * Whether the dialog buttons are disabled.
   */
  disabled?: boolean;
  /**
   * Callback function to be called when the dialog is closed.
   *
   * @returns void
   */
  onClose?: () => void;
  /**
   * Callback function to be called when the dialog is confirmed.
   *
   * @returns void
   */
  onConfirm?: () => void;
} & Omit<DialogProps, "onClose" | "title">;

/**
 * SubmitDialog component for uploading Excel files.
 *
 * @param param Props for the dialog component.
 * @returns JSX.Element
 */
const SubmitDialog = ({
  bodyText,
  disabled,
  onClose,
  onConfirm,
  open,
  ...rest
}: Props): JSX.Element => {
  const { enqueueSnackbar } = useSnackbar();
  const { data } = useSubmissionContext();

  const intention = data?.getSubmission?.intention;

  const { data: submissionSummaryData, loading: isSummaryLoading } = useQuery<
    GetSubmissionSummaryResp,
    GetSubmissionSummaryInput
  >(GET_SUBMISSION_SUMMARY, {
    variables: { submissionID: data?.getSubmission?._id },
    context: { clientName: "backend" },
    fetchPolicy: "cache-and-network",
    skip: !data?.getSubmission?._id || !open,
    onError: () => {
      enqueueSnackbar("Unable to retrieve submission summary data.", { variant: "error" });
    },
  });

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      title=""
      data-testid="submit-dialog"
      scroll="body"
      {...rest}
    >
      <StyledCloseDialogButton
        onClick={onClose}
        aria-label="close"
        data-testid="submit-dialog-close-icon-button"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>

      <StyledTitle variant="h4" data-testid="submit-dialog-title">
        Data Submission
      </StyledTitle>
      <StyledHeader variant="h3" data-testid="submit-dialog-header">
        Submit Data Submission
      </StyledHeader>
      <StyledDescription data-testid="submit-dialog-description">
        Please review the content of your data submission before proceeding.
        <br />
        <br />
        {bodyText}
      </StyledDescription>

      <StyledIntentionWrapper aria-busy={!intention} aria-live="polite">
        <StyledIntentionLabel>Data Submission Type:</StyledIntentionLabel>
        <StyledIntentionValue data-testid="submit-dialog-intention">
          {!intention ? <Skeleton variant="text" width={SKELETON_WIDTHS.intention} /> : intention}
        </StyledIntentionValue>
      </StyledIntentionWrapper>

      <SubmitSummaryTable
        intention={intention}
        data={submissionSummaryData?.getSubmissionSummary || []}
        loading={!intention || isSummaryLoading}
      />

      <Stack
        direction="row"
        justifyContent="center"
        alignItems="center"
        spacing={2}
        marginTop="58px"
      >
        <StyledCloseButton
          id="submit-dialog-no-button"
          variant="contained"
          color="info"
          onClick={onClose}
          disabled={disabled}
          aria-label="Cancel button"
          data-testid="submit-dialog-cancel-button"
        >
          No
        </StyledCloseButton>
        <StyledConfirmButton
          id="submit-dialog-yes-button"
          variant="contained"
          color="success"
          onClick={onConfirm}
          disabled={disabled}
          aria-label="Confirm button"
          data-testid="submit-dialog-confirm-button"
        >
          Yes
        </StyledConfirmButton>
      </Stack>
    </StyledDialog>
  );
};

export default memo(SubmitDialog);
