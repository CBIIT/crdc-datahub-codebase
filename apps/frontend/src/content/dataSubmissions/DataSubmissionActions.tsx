import { LoadingButton } from "@mui/lab";
import { Button, OutlinedInput, Stack, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import React, { useMemo, useState } from "react";

import SubmitDialog from "@/components/SubmitDialog";

import { useAuthContext } from "../../components/Contexts/AuthContext";
import { useSubmissionContext } from "../../components/Contexts/SubmissionContext";
import CustomDialog from "../../components/GenericDialog";
import Tooltip from "../../components/Tooltip";
import { hasPermission } from "../../config/AuthPermissions";
import { TOOLTIP_TEXT } from "../../config/DashboardTooltips";
import { ReleaseInfo, shouldDisableRelease, shouldEnableSubmit } from "../../utils";

const StyledActionWrapper = styled(Stack)(() => ({
  justifyContent: "center",
  alignItems: "center",
}));

const StyledOutlinedInput = styled(OutlinedInput)(() => ({
  borderRadius: "8px",
  backgroundColor: "#fff",
  color: "#083A50",
  "& .MuiInputBase-input": {
    fontWeight: 400,
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    lineHeight: "19.6px",
    padding: "12px",
    height: "20px",
  },
  "&.MuiInputBase-multiline": {
    padding: "12px",
  },
  "&.MuiInputBase-multiline .MuiInputBase-input": {
    lineHeight: "25px",
    padding: 0,
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#6B7294",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    border: "1px solid #209D7D",
    boxShadow:
      "2px 2px 4px 0px rgba(38, 184, 147, 0.10), -1px -1px 6px 0px rgba(38, 184, 147, 0.20)",
  },
  "& .MuiInputBase-input::placeholder": {
    color: "#87878C",
    fontWeight: 400,
    opacity: 1,
  },
}));

const StyledLoadingButton = styled(LoadingButton)(() => ({
  minWidth: "137px",
  width: "fit-content",
  padding: "10px",
  borderRadius: "8px",
  textAlign: "center",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "24px",
  letterSpacing: "0.32px",
  textTransform: "initial",
  zIndex: 3,
}));

const StyledDialog = styled(CustomDialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "567px !important",
  },
});

const StyledDialogText = styled(Typography)({
  fontWeight: 400,
  fontSize: "16px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  lineHeight: "19.6px",
});

export type ActiveDialog =
  | "Submit"
  | "Release"
  | "ReleaseCrossValidation"
  | "Withdraw"
  | "Reject"
  | "Complete"
  | "Cancel";

type ActionConfig = {
  hasPermission: (user: User, submission: Submission) => boolean;
  statuses: SubmissionStatus[];
};

type ActionKey =
  | "Submit"
  | "AdminSubmit"
  | "Release"
  | "Withdraw"
  | "SubmittedReject"
  | "ReleasedReject"
  | "Complete"
  | "Cancel";

const actionConfig: Record<ActionKey, ActionConfig> = {
  Submit: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "create", submission),
    statuses: ["New", "In Progress", "Withdrawn", "Rejected"],
  },
  AdminSubmit: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "admin_submit", submission),
    statuses: ["In Progress", "Withdrawn", "Rejected"],
  },
  Release: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "review", submission),
    statuses: ["Submitted"],
  },
  Withdraw: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "create", submission),
    statuses: ["Submitted"],
  },
  SubmittedReject: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "review", submission),
    statuses: ["Submitted"],
  },
  ReleasedReject: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "confirm", submission),
    statuses: ["Released"],
  },
  Complete: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "confirm", submission),
    statuses: ["Released"],
  },
  Cancel: {
    hasPermission: (user, submission) =>
      hasPermission(user, "data_submission", "cancel", submission),
    statuses: ["New", "In Progress", "Rejected"],
  },
};

type Props = {
  onAction: (action: SubmissionAction, reviewComment?: string) => Promise<void>;
};

const DataSubmissionActions = ({ onAction }: Props) => {
  const { user } = useAuthContext();
  const { data } = useSubmissionContext();
  const { getSubmission: submission } = data || {};

  const [currentDialog, setCurrentDialog] = useState<ActiveDialog | null>(null);
  const [action, setAction] = useState<SubmissionAction | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  const submitActionButton: SubmitButtonResult = useMemo(() => {
    if (!data?.getSubmission?._id) {
      return { enabled: false };
    }

    return shouldEnableSubmit(data, user);
  }, [data, user]);

  const releaseActionButton: ReleaseInfo = useMemo(() => {
    if (!submission?._id) {
      return { disable: true, requireAlert: false };
    }

    return shouldDisableRelease(submission);
  }, [submission?._id, submission?.crossSubmissionStatus, submission?.otherSubmissions]);

  const handleOnAction = async (action: SubmissionAction) => {
    if (currentDialog) {
      setCurrentDialog(null);
    }
    setAction(action);

    if (typeof onAction === "function") {
      await onAction(action, reviewComment || null);
    }
    setAction(null);
    setReviewComment("");
  };

  const onOpenDialog = (dialog: ActiveDialog) => {
    setCurrentDialog(dialog);
  };

  const onCloseDialog = () => {
    setCurrentDialog(null);
    setReviewComment("");
  };

  const canShowAction = (actionKey: ActionKey) => {
    const config = actionConfig[actionKey];
    return (
      config?.statuses?.includes(submission?.status) && config?.hasPermission(user, submission)
    );
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event?.target?.value || "";
    setReviewComment(val);
  };

  const submitButtonBodyText = useMemo(() => {
    if (submission?.status === "Rejected") {
      return "Are you sure you want to resubmit your data without making any changes? Your previous submission was rejected, and resubmitting without addressing the issues may result in another rejection.";
    }

    return "Once submitted, your submission will be locked and will no longer accept updates. Are you sure you want to proceed?";
  }, [submission?.status]);

  return (
    <StyledActionWrapper direction="row" spacing={2}>
      {/* Action Buttons */}
      {canShowAction("Submit") || canShowAction("AdminSubmit") ? (
        <Tooltip
          placement="top"
          title={submitActionButton?.tooltip}
          open={undefined}
          disableHoverListener={!submitActionButton?.tooltip || (action && action !== "Submit")}
        >
          <span>
            <StyledLoadingButton
              variant="contained"
              color="primary"
              onClick={() => onOpenDialog("Submit")}
              loading={action === "Submit"}
              disabled={!submitActionButton?.enabled || (action && action !== "Submit")}
            >
              {submitActionButton?.isAdminOverride ? "Admin Submit" : "Submit"}
            </StyledLoadingButton>
          </span>
        </Tooltip>
      ) : null}
      {canShowAction("Release") ? (
        <Tooltip
          placement="top"
          title={TOOLTIP_TEXT.SUBMISSION_ACTIONS.RELEASE.DISABLED.NO_CROSS_VALIDATION}
          open={undefined}
          disableHoverListener={!((action && action !== "Release") || releaseActionButton?.disable)}
        >
          <span>
            <StyledLoadingButton
              variant="contained"
              color="primary"
              onClick={() =>
                onOpenDialog(
                  releaseActionButton.requireAlert ? "ReleaseCrossValidation" : "Release"
                )
              }
              loading={action === "Release"}
              disabled={(action && action !== "Release") || releaseActionButton?.disable}
            >
              Release to {submission?.dataCommonsDisplayName}
            </StyledLoadingButton>
          </span>
        </Tooltip>
      ) : null}
      {canShowAction("Complete") ? (
        <StyledLoadingButton
          variant="contained"
          color="primary"
          onClick={() => onOpenDialog("Complete")}
          loading={action === "Complete"}
          disabled={action && action !== "Complete"}
        >
          Complete
        </StyledLoadingButton>
      ) : null}
      {canShowAction("Withdraw") ? (
        <Tooltip
          placement="top"
          title={TOOLTIP_TEXT.SUBMISSION_ACTIONS.WITHDRAW.ENABLED}
          open={undefined}
          disableHoverListener={action && action !== "Withdraw"}
        >
          <span>
            <StyledLoadingButton
              variant="contained"
              color="error"
              onClick={() => onOpenDialog("Withdraw")}
              loading={action === "Withdraw"}
              disabled={action && action !== "Withdraw"}
            >
              Withdraw
            </StyledLoadingButton>
          </span>
        </Tooltip>
      ) : null}
      {canShowAction("SubmittedReject") || canShowAction("ReleasedReject") ? (
        <StyledLoadingButton
          variant="contained"
          color="error"
          onClick={() => onOpenDialog("Reject")}
          loading={action === "Reject"}
          disabled={action && action !== "Reject"}
        >
          Reject
        </StyledLoadingButton>
      ) : null}
      {canShowAction("Cancel") ? (
        <StyledLoadingButton
          variant="contained"
          color="error"
          onClick={() => onOpenDialog("Cancel")}
          loading={action === "Cancel"}
          disabled={action && action !== "Cancel"}
        >
          Cancel
        </StyledLoadingButton>
      ) : null}
      {/* Submit Dialog */}
      <SubmitDialog
        open={currentDialog === "Submit" && !submitActionButton.isAdminOverride}
        bodyText={submitButtonBodyText}
        onClose={onCloseDialog}
        onConfirm={() => handleOnAction("Submit")}
        disabled={!!action}
      />
      {/* Admin Submit Dialog */}
      <StyledDialog
        open={currentDialog === "Submit" && submitActionButton.isAdminOverride}
        onClose={onCloseDialog}
        title="Admin Submit Data Submission"
        actions={
          <Stack direction="row" marginTop="24px">
            <Button onClick={onCloseDialog} disabled={!!action}>
              Cancel
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Submit")}
              loading={!!action}
              disabled={reviewComment?.trim()?.length <= 0}
              autoFocus
            >
              Confirm to Submit
            </LoadingButton>
          </Stack>
        }
      >
        <StyledOutlinedInput
          value={reviewComment}
          onChange={handleCommentChange}
          placeholder="Enter comments here. Max of 500 characters"
          inputProps={{ "aria-label": "Admin override justification" }}
          slotProps={{ input: { minLength: 1, maxLength: 500 } }}
          minRows={4}
          maxRows={4}
          multiline
          fullWidth
          required
        />
      </StyledDialog>
      {/* Release Dialog (default) */}
      <StyledDialog
        open={currentDialog === "Release"}
        onClose={onCloseDialog}
        title="Release Data Submission"
        actions={
          <>
            <Button onClick={onCloseDialog} disabled={!!action}>
              No
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Release")}
              loading={!!action}
              color="error"
              autoFocus
            >
              Yes
            </LoadingButton>
          </>
        }
      >
        <StyledDialogText variant="body2">
          This action will release this submission to data commons and it can no longer accept
          changes to the data. Are you sure you want to proceed?
        </StyledDialogText>
      </StyledDialog>
      {/* Release dialog (cross-validation) */}
      <StyledDialog
        open={currentDialog === "ReleaseCrossValidation"}
        onClose={onCloseDialog}
        title="Release Data Submission"
        actions={
          <>
            <Button onClick={onCloseDialog} disabled={!!action}>
              Cancel
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Release")}
              loading={!!action}
              color="error"
              autoFocus
            >
              Confirm Release
            </LoadingButton>
          </>
        }
      >
        <StyledDialogText variant="body2">
          There are other data submissions for the same study currently ongoing. Are you sure you
          want to release this data submission to Data Commons?
        </StyledDialogText>
      </StyledDialog>
      {/* Cancel Dialog */}
      <StyledDialog
        open={currentDialog === "Cancel"}
        onClose={onCloseDialog}
        title="Cancel Data Submission"
        actions={
          <>
            <Button onClick={onCloseDialog} disabled={!!action}>
              No
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Cancel")}
              loading={!!action}
              color="error"
              autoFocus
            >
              Yes
            </LoadingButton>
          </>
        }
      >
        <StyledDialogText variant="body2">
          This action will remove this submission and it will no longer be accessible. Are you sure
          you want to proceed?
        </StyledDialogText>
      </StyledDialog>
      {/* Withdraw Dialog */}
      <StyledDialog
        open={currentDialog === "Withdraw"}
        onClose={onCloseDialog}
        title="Withdraw Data Submission"
        actions={
          <>
            <Button onClick={onCloseDialog} disabled={!!action}>
              No
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Withdraw")}
              loading={!!action}
              color="error"
              autoFocus
            >
              Yes
            </LoadingButton>
          </>
        }
      >
        <StyledDialogText variant="body2">
          This action will halt the data curation process and give control back to you if you wish
          to update the data within the submission. Are you certain you want to proceed?
        </StyledDialogText>
      </StyledDialog>
      {/* Reject Dialog */}
      <StyledDialog
        open={currentDialog === "Reject"}
        onClose={onCloseDialog}
        title="Reject Data Submission"
        actions={
          <Stack direction="row" marginTop="24px">
            <Button onClick={onCloseDialog} disabled={!!action}>
              Cancel
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Reject")}
              loading={!!action}
              disabled={reviewComment?.trim()?.length <= 0}
              color="error"
              autoFocus
            >
              Confirm to Reject
            </LoadingButton>
          </Stack>
        }
      >
        <StyledOutlinedInput
          value={reviewComment}
          onChange={handleCommentChange}
          placeholder="Enter comments here. Max of 500 characters"
          inputProps={{ "aria-label": "Reject justification" }}
          slotProps={{ input: { minLength: 1, maxLength: 500 } }}
          minRows={4}
          maxRows={4}
          multiline
          fullWidth
          required
        />
      </StyledDialog>
      {/* Complete Dialog */}
      <StyledDialog
        open={currentDialog === "Complete"}
        onClose={onCloseDialog}
        title="Complete Data Submission"
        actions={
          <>
            <Button onClick={onCloseDialog} disabled={!!action}>
              No
            </Button>
            <LoadingButton
              onClick={() => handleOnAction("Complete")}
              loading={!!action}
              color="error"
              autoFocus
            >
              Yes
            </LoadingButton>
          </>
        }
      >
        <StyledDialogText variant="body2">
          This action will close out the submission and start close out activities. Are you sure you
          want to proceed?
        </StyledDialogText>
      </StyledDialog>
    </StyledActionWrapper>
  );
};

export default React.memo<Props>(DataSubmissionActions, (prevProps, nextProps) =>
  isEqual(prevProps, nextProps)
);
