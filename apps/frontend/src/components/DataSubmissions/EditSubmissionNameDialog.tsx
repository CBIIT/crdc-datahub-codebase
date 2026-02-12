import { useMutation } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import { Box, Typography, styled } from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import { useSnackbar } from "notistack";
import React, { useState, useEffect, CSSProperties } from "react";

import { EDIT_SUBMISSION, EditSubmissionNameInput, EditSubmissionNameResp } from "@/graphql";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import DefaultDialog from "../StyledDialogComponents/StyledDialog";
import StyledCloseDialogButton from "../StyledDialogComponents/StyledDialogCloseButton";
import DefaultDialogContent from "../StyledDialogComponents/StyledDialogContent";
import DefaultDialogHeader from "../StyledDialogComponents/StyledHeader";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";

const StyledDialog = styled(DefaultDialog)({
  "& .MuiDialog-paper": {
    width: "577px !important",
    borderColor: "#5AB8FF",
  },
});

const StyledTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "#929292",
});

const StyledDialogActions = styled(DialogActions)({
  padding: "0 !important",
  justifyContent: "center",
  marginTop: "20px !important",
  gap: "10px",
});

const baseButtonStyles: CSSProperties = {
  width: "128px !important",
  height: "51px",
  borderRadius: "8px",
  fontWeight: 700,
  fontSize: "16px",
  letterSpacing: "0.32px",
  textTransform: "none" as const,
  margin: "0 15px",
};

const StyledButton = styled(LoadingButton)({
  ...baseButtonStyles,
  background: "#FFF",
  border: "1px solid #000",
  color: "#000",
});

const StyledGreenButton = styled(LoadingButton)({
  ...baseButtonStyles,
});

type Props = {
  open: boolean;
  submissionID: string;
  initialValue: string;
  onCancel: () => void;
  onSave: (newName: string) => void;
};

const EditSubmissionNameDialog: React.FC<Props> = ({
  open,
  submissionID,
  initialValue,
  onCancel,
  onSave,
}) => {
  const [newName, setNewName] = useState<string>(initialValue);
  const [error, setError] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();

  const [editSubmission] = useMutation<EditSubmissionNameResp, EditSubmissionNameInput>(
    EDIT_SUBMISSION,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  useEffect(() => {
    if (open) {
      setNewName(initialValue);
      setError("");
    }
  }, [open, initialValue]);

  const handleSave = async () => {
    if (!newName.trim()) {
      setError("Submission name is required.");
      return;
    }

    try {
      const { data: d, errors } = await editSubmission({
        variables: { _id: submissionID, newName: newName.trim() },
      });
      if (errors || !d?.editSubmission?._id) {
        throw new Error(errors?.[0]?.message || "Unknown API error");
      }

      onSave(newName.trim());
    } catch (err) {
      enqueueSnackbar(err.message, {
        variant: "error",
        autoHideDuration: 4000,
      });
      setError(err.message);
    }
  };

  return (
    <StyledDialog
      open={open}
      onClose={onCancel}
      data-testid="edit-submission-name-dialog"
      aria-labelledby="edit-submission-name-dialog-header"
      scroll="body"
    >
      <StyledCloseDialogButton
        onClick={onCancel}
        data-testid="edit-submission-name-dialog-close-icon"
        aria-label="Close dialog"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <DefaultDialogContent>
        <Box sx={{}}>
          <StyledTitle data-testid="edit-submission-name-dialog-title">DATA SUBMISSION</StyledTitle>
          <DefaultDialogHeader
            id="edit-submission-name-dialog-header"
            variant="h1"
            sx={{ mt: "5px" }}
            data-testid="edit-submission-name-dialog-header"
          >
            Update
            <br />
            Data Submission Name
          </DefaultDialogHeader>
        </Box>
        <Box sx={{}}>
          <StyledLabel sx={{ textAlign: "left" }} htmlFor="edit-submission-name-dialog-input">
            Submission Name
          </StyledLabel>
          <StyledOutlinedInput
            id="edit-submission-name-dialog-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            data-testid="edit-submission-name-dialog-input"
            inputProps={{ maxLength: 25 }}
            error={!!error}
            required
          />
          <Box sx={{ minHeight: "30px" }}>
            {error && (
              <StyledHelperText error data-testid="edit-submission-name-dialog-error">
                {error}
              </StyledHelperText>
            )}
          </Box>
        </Box>
      </DefaultDialogContent>
      <StyledDialogActions>
        <StyledButton
          variant="outlined"
          onClick={onCancel}
          data-testid="edit-submission-name-dialog-cancel-button"
        >
          Cancel
        </StyledButton>
        <StyledGreenButton
          variant="contained"
          onClick={handleSave}
          data-testid="edit-submission-name-dialog-save-button"
          color="success"
        >
          Save
        </StyledGreenButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default EditSubmissionNameDialog;
