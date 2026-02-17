import { useMutation } from "@apollo/client";
import { Box, ButtonProps, IconButton, IconButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useCallback, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import RestoreIcon from "../../assets/icons/filled_circular_back.svg?react";
import DeleteIcon from "../../assets/icons/filled_circular_delete.svg?react";
import { hasPermission } from "../../config/AuthPermissions";
import {
  CANCEL_APP,
  CancelAppInput,
  CancelAppResp,
  RESTORE_APP,
  RestoreAppInput,
  RestoreAppResp,
} from "../../graphql";
import { Logger } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import DeleteDialog from "../DeleteDialog";
import Asterisk from "../StyledFormComponents/StyledAsterisk";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import BaseOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledIconButton = styled(IconButton)(({ disabled }) => ({
  cursor: disabled ? "not-allowed" : "pointer",
  padding: "0px",
  minWidth: "unset",
}));

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

/**
 * The statuses of the application that can be restored from.
 */
const RESTORE_STATUSES: ApplicationStatus[] = ["Canceled", "Deleted"];

type FormFields = {
  comment: string;
};

type Props = {
  /**
   * The the application to be canceled/restored
   */
  application: Application | Omit<Application, "questionnaireData">;
  /**
   * Optional callback function for when successful cancellation/restoration occurs
   */
  onCancel?: () => void;
} & Omit<IconButtonProps, "onClick">;

/**
 * Provides a button to either cancel or restore an application,
 * depending on the current status of the application.
 *
 * @returns The ToggleApplicationButton component.
 */
const ToggleApplicationButton = ({ application, onCancel, disabled, ...rest }: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const formId = useId();
  const {
    register,
    watch,
    formState: { isValid },
  } = useForm<FormFields>({ mode: "onBlur" });

  const { _id, status } = application || {};

  const [cancelApp] = useMutation<CancelAppResp, CancelAppInput>(CANCEL_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [restoreApp] = useMutation<RestoreAppResp, RestoreAppInput>(RESTORE_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const isRestoreAction = useMemo<boolean>(() => RESTORE_STATUSES.includes(status), [status]);

  const isFromDeletedStatus = useMemo<boolean>(() => status === "Deleted", [status]);

  const textValues = useMemo(
    () => ({
      icon: isRestoreAction ? (
        <RestoreIcon data-testid="application-restore-icon" />
      ) : (
        <DeleteIcon data-testid="application-cancel-icon" />
      ),
      tooltipText: `${isRestoreAction ? "Restore" : "Cancel"} submission request`,
      dialogTitle: `${isRestoreAction ? "Restore" : "Cancel"} Submission Request`,
      dialogDescription: isRestoreAction
        ? `Are you sure you want to restore the previously ${
            isFromDeletedStatus ? "deleted" : "canceled"
          } submission request for the study listed below?`
        : `Are you sure you want to cancel the submission request for the study listed below?`,
    }),
    [isRestoreAction, isFromDeletedStatus]
  );

  const comment = watch("comment");
  const confirmButtonProps = useMemo<ButtonProps>(
    () => ({
      disabled: !isValid || loading,
    }),
    [isValid, loading]
  );

  const onClickIcon = async () => {
    setConfirmOpen(true);
  };

  const onCloseDialog = async () => {
    setConfirmOpen(false);
  };

  const onConfirmDialog = useCallback(async () => {
    setLoading(true);
    try {
      if (isRestoreAction) {
        const { data: d, errors } = await restoreApp({
          variables: { _id, comment },
        });

        if (errors || !d?.restoreApplication?._id) {
          throw new Error(errors?.[0]?.message || "Unknown API error");
        }
      } else {
        const { data: d, errors } = await cancelApp({
          variables: { _id, comment },
        });

        if (errors || !d?.cancelApplication?._id) {
          throw new Error(errors?.[0]?.message || "Unknown API error");
        }
      }

      setConfirmOpen(false);
      onCancel();
    } catch (err) {
      Logger.error("ToggleApplicationButton: API error received", err);
      enqueueSnackbar(
        `Oops! Unable to ${isRestoreAction ? "restore" : "cancel"} that Submission Request`,
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  }, [isRestoreAction, comment, restoreApp, cancelApp, onCancel, enqueueSnackbar]);

  if (!hasPermission(user, "submission_request", "cancel", application)) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        title={textValues.tooltipText}
        placement="top"
        aria-label="Cancel/Restore action tooltip"
        data-testid="cancel-restore-application-tooltip"
        disableInteractive
        arrow
      >
        <span>
          <StyledIconButton
            onClick={onClickIcon}
            disabled={loading || disabled}
            aria-label="Cancel/Restore icon"
            data-testid="cancel-restore-application-button"
            disableRipple
            {...rest}
          >
            {textValues.icon}
          </StyledIconButton>
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
            Study: {application.studyAbbreviation || "NA"}
            <StyledFormBox>
              <StyledLabel htmlFor={formId}>
                Reason
                <Asterisk />
              </StyledLabel>
              <StyledOutlinedInput
                id={formId}
                data-testid="cancel-restore-application-reason"
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

export default memo<Props>(ToggleApplicationButton, isEqual);
