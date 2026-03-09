import { useMutation } from "@apollo/client";
import { Box, Button, ButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useCallback, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { hasPermission } from "../../config/AuthPermissions";
import { CANCEL_APP, CancelAppInput, CancelAppResp } from "../../graphql";
import { Logger } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import { useFormContext } from "../Contexts/FormContext";
import DeleteDialog from "../DeleteDialog";
import Asterisk from "../StyledFormComponents/StyledAsterisk";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import BaseOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

const StyledTooltip = styled(StyledFormTooltip)({
  margin: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledFormBox = styled(Box)({
  marginTop: "18.5px",
});

const StyledOutlinedInput = styled(BaseOutlinedInput)({
  "& .MuiInputBase-inputMultiline": {
    resize: "vertical",
    minHeight: "125px",
    maxHeight: "375px",
  },
});

type FormFields = {
  comment: string;
};

type Props = {
  /**
   * An optional closure function to be called when the cancel action is completed.
   */
  onCancel?: () => void;
} & Omit<ButtonProps, "onClick">;

/**
 * Provides a button to cancel the contextually relevant Submission Request.
 *
 * @returns The CancelApplicationButton component.
 */
const CancelApplicationButton = ({ disabled, onCancel, ...rest }: Props) => {
  const formId = useId();
  const { data } = useFormContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const {
    register,
    watch,
    formState: { isValid },
  } = useForm<FormFields>({ mode: "onBlur" });

  const [cancelApp] = useMutation<CancelAppResp, CancelAppInput>(CANCEL_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const textValues = useMemo(
    () => ({
      tooltipText: `This action will cancel the entire submission request and set its status to 'Canceled'`,
      dialogTitle: `Cancel Submission Request`,
      dialogDescription: `Are you sure you want to cancel the submission request for the study listed below?`,
    }),
    []
  );

  const comment = watch("comment");
  const confirmButtonProps = useMemo<ButtonProps>(
    () => ({
      disabled: !isValid || loading,
    }),
    [isValid, loading]
  );

  const canSeeButton = useMemo<boolean>(() => {
    if (data?.applicant?.applicantID !== user?._id) {
      return false;
    }
    if (!hasPermission(user, "submission_request", "cancel", data)) {
      return false;
    }
    if (data?.status === "Canceled" || data?.status === "Deleted") {
      return false;
    }

    return true;
  }, [data, user]);

  const onButtonClick = async () => {
    setConfirmOpen(true);
  };

  const onCloseDialog = async () => {
    setConfirmOpen(false);
  };

  const onConfirmDialog = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d, errors } = await cancelApp({
        variables: { _id: data?._id, comment },
      });

      if (errors || !d?.cancelApplication?._id) {
        throw new Error(errors?.[0]?.message || "Unknown API error");
      }

      setConfirmOpen(false);
      onCancel?.();
    } catch (err) {
      Logger.error("CancelApplicationButton: API error received", err);
      enqueueSnackbar(`Oops! Unable to cancel the Submission Request.`, { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [comment, cancelApp, enqueueSnackbar, onCancel]);

  if (!canSeeButton) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        title={textValues.tooltipText}
        placement="top"
        aria-label="Cancel tooltip"
        data-testid="cancel-application-tooltip"
        disableInteractive
        arrow
      >
        <span>
          <Button
            variant="contained"
            color="error"
            type="button"
            onClick={onButtonClick}
            disabled={loading || disabled}
            aria-label="Cancel button"
            data-testid="cancel-application-button"
            {...rest}
          >
            Cancel Request
          </Button>
        </span>
      </StyledTooltip>
      <DeleteDialog
        open={confirmOpen}
        header={textValues.dialogTitle}
        PaperProps={{
          "aria-labelledby": "",
          "aria-label": textValues.dialogTitle,
        }}
        description={
          <div>
            {textValues.dialogDescription}
            <br />
            <br />
            Study: {data.studyAbbreviation || "NA"}
            <StyledFormBox>
              <StyledLabel htmlFor={formId}>
                Reason
                <Asterisk />
              </StyledLabel>
              <StyledOutlinedInput
                id={formId}
                data-testid="cancel-application-reason"
                placeholder="500 characters allowed"
                required
                multiline
                inputProps={{ maxLength: 500 }}
                {...register("comment", {
                  required: true,
                  maxLength: 500,
                  minLength: 1,
                  setValueAs: (v) => v?.trim(),
                })}
              />
            </StyledFormBox>
          </div>
        }
        closeText="Cancel"
        onClose={onCloseDialog}
        confirmText="Confirm"
        onConfirm={onConfirmDialog}
        confirmButtonProps={confirmButtonProps}
        scroll="body"
      />
    </>
  );
};

export default memo<Props>(CancelApplicationButton, isEqual);
