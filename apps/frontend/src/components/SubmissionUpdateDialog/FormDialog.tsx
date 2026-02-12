import { useQuery } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import { Box, DialogProps, MenuItem, styled, Typography } from "@mui/material";
import React, { CSSProperties, FC, useEffect, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

import CloseIconSvg from "@/assets/icons/close_icon.svg?react";
import { useSubmissionContext } from "@/components/Contexts/SubmissionContext";
import DefaultDialog from "@/components/StyledDialogComponents/StyledDialog";
import DefaultDialogActions from "@/components/StyledDialogComponents/StyledDialogActions";
import StyledCloseDialogButton from "@/components/StyledDialogComponents/StyledDialogCloseButton";
import StyledDialogContent from "@/components/StyledDialogComponents/StyledDialogContent";
import DefaultDialogHeader from "@/components/StyledDialogComponents/StyledHeader";
import StyledAsterisk from "@/components/StyledFormComponents/StyledAsterisk";
import StyledHelperText from "@/components/StyledFormComponents/StyledHelperText";
import StyledLabel from "@/components/StyledFormComponents/StyledLabel";
import StyledSelect from "@/components/StyledFormComponents/StyledSelect";
import Tooltip from "@/components/Tooltip";
import {
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput,
  LIST_POTENTIAL_COLLABORATORS,
  UpdateSubmissionInfoInput,
} from "@/graphql";
import { listAvailableModelVersions, Logger } from "@/utils";

const StyledDialog = styled(DefaultDialog)({
  "& .MuiDialog-paper": {
    width: "577px !important",
    border: "2px solid #5AB8FF",
  },
});

const StyledForm = styled("form")({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: "0 auto",
  marginTop: "28px",
  maxWidth: "485px",
});

const StyledTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "#929292",
});

const StyledHeader = styled(DefaultDialogHeader)({
  fontSize: "35px !important",
  marginBottom: "24px !important",
});

const StyledDialogActions = styled(DefaultDialogActions)({
  marginTop: "36px !important",
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

export type InputForm = Pick<UpdateSubmissionInfoInput, "submitterID" | "version">;

type Props = {
  /**
   * Function to handle form submission
   */
  onSubmitForm: (form: InputForm) => Promise<void>;
  /**
   * Function to handle closing the dialog
   */
  onClose: () => void;
} & Omit<DialogProps, "onClose">;

/**
 * Provides a dialog for authorized users to update the assigned Submitter or
 * Data Model Version of a Data Submission.
 *
 * @returns The FormDialog component
 */
const FormDialog: FC<Props> = ({ onSubmitForm, onClose, ...rest }) => {
  const { data } = useSubmissionContext();
  const { _id, dataCommons, modelVersion, submitterName, submitterID } = data?.getSubmission || {};

  const { handleSubmit, reset, control, formState } = useForm<InputForm>({
    defaultValues: {
      submitterID,
      version: modelVersion,
    },
    mode: "onSubmit",
  });
  const { errors, isSubmitting } = formState;

  const { data: submitters } = useQuery<
    ListPotentialCollaboratorsResp,
    ListPotentialCollaboratorsInput
  >(LIST_POTENTIAL_COLLABORATORS, {
    variables: { submissionID: _id },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    skip: !rest?.open || !_id,
    onError: (err) => {
      Logger.error("Error fetching submitter options", err);
    },
  });

  const [versions, setVersions] = useState<string[]>([]);

  const onSubmit: SubmitHandler<InputForm> = async (form: InputForm) => {
    await onSubmitForm(form);
    onClose();
  };

  useEffect(() => {
    if (!rest?.open) {
      return;
    }

    listAvailableModelVersions(dataCommons).then((versions) => {
      setVersions(versions);
    });
  }, [dataCommons, rest?.open]);

  useEffect(() => {
    if (!submitterID || !modelVersion) {
      return;
    }

    reset({
      submitterID,
      version: modelVersion,
    });
  }, [submitterID, modelVersion]);

  return (
    <StyledDialog
      onClose={onClose}
      aria-labelledby="update-submission-dialog-header"
      data-testid="update-submission-dialog"
      scroll="body"
      {...rest}
    >
      <StyledCloseDialogButton
        data-testid="update-submission-dialog-close-icon"
        aria-label="close"
        onClick={onClose}
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledTitle data-testid="edit-submission-name-dialog-title">DATA SUBMISSION</StyledTitle>
      <StyledHeader
        id="update-submission-dialog-header"
        data-testid="update-submission-dialog-header"
        variant="h1"
      >
        Update Data Submission
      </StyledHeader>
      <StyledDialogContent>
        <StyledForm>
          <Box>
            <StyledLabel id="submitter-input-label">
              Submitter
              <StyledAsterisk />
              <Tooltip
                title="Transfers data submission ownership; previous Submitter may lose access."
                data-testid="submitter-input-tooltip"
              />
            </StyledLabel>
            <Controller
              name="submitterID"
              control={control}
              rules={{ required: "This field is required" }}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  size="small"
                  MenuProps={{ disablePortal: true }}
                  data-testid="update-submission-submitter-field"
                  inputProps={{ "aria-labelledby": "submitter-input-label" }}
                >
                  <MenuItem value={submitterID}>{submitterName}</MenuItem>
                  {submitters?.listPotentialCollaborators?.map(({ _id, firstName, lastName }) => (
                    <MenuItem key={_id} value={_id}>
                      {firstName} {lastName}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            <StyledHelperText data-testid="update-submission-dialog-error-submitter">
              {errors?.submitterID?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="version-input-label">
              Data Model Version
              <StyledAsterisk />
              <Tooltip
                title="Changing the model version for an in-progress submission will reset all validation results. The submitter must re-run validation to align with the new model version."
                data-testid="version-input-tooltip"
              />
            </StyledLabel>
            <Controller
              name="version"
              control={control}
              rules={{ required: "This field is required" }}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  size="small"
                  MenuProps={{ disablePortal: true }}
                  data-testid="update-submission-version-field"
                  inputProps={{ "aria-labelledby": "version-input-label" }}
                >
                  {versions.length === 0 && (
                    <MenuItem value={modelVersion}>v{modelVersion}</MenuItem>
                  )}
                  {versions.map((version) => (
                    <MenuItem key={version} value={version}>
                      {version?.toLocaleLowerCase().charAt(0) === "v" ? version : `v${version}`}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            <StyledHelperText data-testid="update-submission-dialog-error-version">
              {errors?.version?.message}
            </StyledHelperText>
          </Box>
        </StyledForm>
      </StyledDialogContent>
      <StyledDialogActions>
        <StyledButton
          data-testid="update-submission-dialog-cancel-button"
          variant="contained"
          color="info"
          size="large"
          onClick={onClose}
        >
          Cancel
        </StyledButton>
        <StyledGreenButton
          data-testid="update-submission-dialog-submit-button"
          variant="contained"
          color="success"
          size="large"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
        >
          Save
        </StyledGreenButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default React.memo<Props>(FormDialog);
