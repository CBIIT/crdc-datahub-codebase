import { Button, Dialog, DialogProps, IconButton, Stack, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import React, { useEffect, useMemo } from "react";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import { hasPermission } from "../../config/AuthPermissions";
import { Status as AuthStatus, useAuthContext } from "../Contexts/AuthContext";
import { useCollaboratorsContext } from "../Contexts/CollaboratorsContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";

import CollaboratorsTable from "./CollaboratorsTable";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "731px !important",
    padding: "47px 54px 74px",
    borderRadius: "8px",
    border: "2px solid #0B7F99",
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
  background: "#FFFFFF",
  "&.MuiButton-root": {
    minWidth: "120px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    border: "1px solid #000",
  },
});

const StyledSaveButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "120px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    border: "1px solid #000",
  },
});

const StyledCancelButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "120px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    border: "1px solid #000",
  },
});

const StyledHeader = styled(Typography)({
  color: "#0B7F99",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "30px",
  marginBottom: "44px",
});

const StyledDescription = styled(Typography)({
  fontSize: "16px",
  fontWeight: 400,
  lineHeight: "22px",
  "&:last-of-type": {
    marginTop: "12px",
    marginBottom: "44px",
  },
});

/**
 * A set of Submission statuses where the collaborator dialog actions
 * should be disabled
 */
export const DISABLE_COLLABORATOR_DIALOG_STATUSES: SubmissionStatus[] = [
  "Completed",
  "Canceled",
  "Deleted",
];

type Props = {
  onClose: () => void;
  onSave: (collaborators: Collaborator[]) => void;
} & Omit<DialogProps, "onClose" | "title">;

const CollaboratorsDialog = ({ onClose, onSave, open, ...rest }: Props) => {
  const { user, status } = useAuthContext();
  const { data: submission, updateQuery } = useSubmissionContext();
  const {
    saveCollaborators,
    loadPotentialCollaborators,
    resetCollaborators,
    loading: collaboratorLoading,
  } = useCollaboratorsContext();

  const isLoading = collaboratorLoading || status === AuthStatus.LOADING;
  const canModifyCollaborators = useMemo(
    () =>
      hasPermission(user, "data_submission", "create", null, true) &&
      submission?.getSubmission?.submitterID === user?._id &&
      !DISABLE_COLLABORATOR_DIALOG_STATUSES.includes(submission?.getSubmission?.status),
    [user, submission?.getSubmission]
  );

  useEffect(() => {
    if (!open || !canModifyCollaborators) {
      return;
    }

    loadPotentialCollaborators();
  }, [open, loadPotentialCollaborators, canModifyCollaborators]);

  const handleOnSave = async (event) => {
    event.preventDefault();

    const newCollaborators = await saveCollaborators();
    updateQuery((prev) => ({
      ...prev,
      getSubmission: {
        ...prev?.getSubmission,
        collaborators: newCollaborators,
      },
    }));

    onSave?.(newCollaborators);
  };

  const handleOnCancel = async () => {
    resetCollaborators();
    onClose?.();
  };

  return (
    <StyledDialog
      id="collaborator-dialog"
      open={open}
      onClose={onClose}
      title=""
      aria-label="Data Submission Collaborators dialog"
      PaperProps={{
        "aria-labelledby": "collaborator-dialog",
      }}
      data-testid="collaborators-dialog"
      scroll="body"
      aria-hidden={!open}
      {...rest}
    >
      <StyledCloseDialogButton
        onClick={onClose}
        aria-label="close"
        data-testid="collaborators-dialog-close-icon-button"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledHeader variant="h3" data-testid="collaborators-dialog-header">
        Data Submission
        <br />
        Collaborators
      </StyledHeader>
      <StyledDescription data-testid="collaborators-dialog-description">
        Below is a list of collaborators who have been granted access to this data submission. Once
        added, each collaborator can contribute to the submission by uploading data, running
        validations, and submitting.
      </StyledDescription>
      <StyledDescription data-testid="collaborators-dialog-disclaimer">
        <strong>Note:</strong> It is the responsibility of the person adding collaborators to ensure
        that the collaborators have permission to see and access the data that will be visible to
        them and that they will abide by all pre-release program-level restrictions.
      </StyledDescription>
      <form id="manage-collaborators-dialog-form" onSubmit={handleOnSave}>
        <CollaboratorsTable isEdit={canModifyCollaborators} />

        <Stack
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={2}
          marginTop="58px"
        >
          {canModifyCollaborators ? (
            <>
              <StyledSaveButton
                variant="contained"
                color="success"
                type="submit"
                disabled={isLoading || !open}
                aria-label="Save changes button"
                data-testid="collaborators-dialog-save-button"
              >
                Save
              </StyledSaveButton>
              <StyledCancelButton
                variant="contained"
                color="error"
                onClick={handleOnCancel}
                disabled={isLoading || !open}
                aria-label="Cancel button"
                data-testid="collaborators-dialog-cancel-button"
              >
                Cancel
              </StyledCancelButton>
            </>
          ) : (
            <StyledCloseButton
              variant="contained"
              color="info"
              onClick={onClose}
              aria-label="Close button"
              data-testid="collaborators-dialog-close-button"
            >
              Close
            </StyledCloseButton>
          )}
        </Stack>
      </form>
    </StyledDialog>
  );
};

export default React.memo(CollaboratorsDialog, isEqual);
