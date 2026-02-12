import { useMutation } from "@apollo/client";
import { Box, Button, ButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useCallback, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import DeleteDialog from "@/components/DeleteDialog";
import Asterisk from "@/components/StyledFormComponents/StyledAsterisk";
import StyledLabel from "@/components/StyledFormComponents/StyledLabel";
import BaseOutlinedInput from "@/components/StyledFormComponents/StyledOutlinedInput";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import { REQUEST_PV, RequestPVInput, RequestPVResponse } from "@/graphql";
import { Logger } from "@/utils";

import { useSubmissionContext } from "../Contexts/SubmissionContext";

const StyledTooltip = styled(StyledFormTooltip)({
  margin: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledButton = styled(Button)(({ disabled, theme }) => ({
  background: disabled ? theme.palette.grey[300] : "#E9F1F4 !important",
  borderRadius: "8px",
  border: "2px solid !important",
  borderColor: disabled ? theme.palette.grey[500] : "#156071 !important",
  color: disabled ? theme.palette.grey[500] : "#156071 !important",
  textTransform: "none",
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19px",
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

type FormFields = {
  comment: string;
};

export type PVRequestButtonProps = {
  /**
   * The name of the node to request a new permissible value against.
   */
  nodeName: string;
  /**
   * The property for which the permissible value is being requested.
   */
  offendingProperty: string;
  /**
   * The value that is being requested.
   */
  offendingValue: string;
  /**
   * An optional closure function to be called when the submit action is completed.
   */
  onSubmit?: (property: string, value: string) => void;
} & Omit<ButtonProps, "onClick" | "onSubmit">;

/**
 * Provides a button to request a new permissible value (PV) for a data submission.
 *
 * @returns The PVRequestButton component.
 */
const PVRequestButton = ({
  nodeName,
  offendingProperty,
  offendingValue,
  disabled,
  onSubmit,
  ...rest
}: PVRequestButtonProps) => {
  const propertyFieldId = useId();
  const valueFieldId = useId();
  const descriptionFieldId = useId();

  const { data } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormFields>({ mode: "onBlur" });

  const [requestPV] = useMutation<RequestPVResponse, RequestPVInput>(REQUEST_PV, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const confirmButtonProps = useMemo<ButtonProps>(
    () => ({
      disabled: !isValid || loading,
      "aria-label": "Submit",
      color: "success",
      variant: "contained",
    }),
    [isValid, loading]
  );

  const onButtonClick = async () => {
    setConfirmOpen(true);
  };

  const onCloseDialog = async () => {
    setConfirmOpen(false);
  };

  const onConfirmDialog = useCallback(
    async ({ comment }: FormFields) => {
      setLoading(true);
      try {
        const { data: d, errors } = await requestPV({
          variables: {
            submissionID: data?.getSubmission?._id,
            nodeName,
            property: offendingProperty,
            value: offendingValue,
            comment,
          },
        });

        if (errors || !d?.requestPV?.success) {
          throw new Error(errors?.[0]?.message || d?.requestPV?.message);
        }

        setConfirmOpen(false);
        enqueueSnackbar(
          "Your request for a new permissible value has been submitted successfully.",
          {
            variant: "success",
          }
        );
        onSubmit?.(offendingProperty, offendingValue);
      } catch (err) {
        Logger.error("PVRequestButton: API error received", err);
        enqueueSnackbar("Oops! Unable to submit the PV request.", { variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [data?.getSubmission?._id, requestPV, enqueueSnackbar, onSubmit]
  );

  return (
    <>
      <StyledTooltip
        title="A request has already been submitted for this permissible value in this data submission."
        placement="top"
        aria-label="PV request button tooltip"
        data-testid="request-pv-tooltip"
        disableInteractive
        disableHoverListener={!disabled}
        arrow
      >
        <span>
          <StyledButton
            variant="outlined"
            color="error"
            type="button"
            onClick={onButtonClick}
            disabled={loading || disabled}
            aria-label="Request New PV"
            data-testid="request-pv-button"
            {...rest}
          >
            Request New PV
          </StyledButton>
        </span>
      </StyledTooltip>
      <DeleteDialog
        open={confirmOpen}
        header="Request New PV"
        PaperProps={{
          "aria-label": "Request New PV",
        }}
        description={
          <div>
            Review the information and provide a brief justification. Your request will be sent to
            the CRDC team for review and, if approved, will initiate the process to add it as a new
            Permissible Value.
            <br />
            <br />
            <StyledFormBox>
              <StyledLabel htmlFor={propertyFieldId}>
                Property
                <Asterisk />
              </StyledLabel>
              <StyledOutlinedInput
                id={propertyFieldId}
                data-testid="request-pv-property"
                value={offendingProperty}
                required
                readOnly
              />
            </StyledFormBox>
            <StyledFormBox>
              <StyledLabel htmlFor={valueFieldId}>
                Term
                <Asterisk />
              </StyledLabel>
              <StyledOutlinedInput
                id={valueFieldId}
                data-testid="request-pv-value"
                value={offendingValue}
                required
                readOnly
              />
            </StyledFormBox>
            <StyledFormBox>
              <StyledLabel htmlFor={descriptionFieldId}>
                Justification
                <Asterisk />
              </StyledLabel>
              <StyledOutlinedInput
                id={descriptionFieldId}
                data-testid="request-pv-description"
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
        confirmText="Submit"
        onConfirm={handleSubmit(onConfirmDialog)}
        confirmButtonProps={confirmButtonProps}
        scroll="body"
      />
    </>
  );
};

export default memo<PVRequestButtonProps>(PVRequestButton, isEqual);
