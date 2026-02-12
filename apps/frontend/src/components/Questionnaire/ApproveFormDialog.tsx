import { LoadingButton } from "@mui/lab";
import {
  Button,
  Checkbox,
  CheckboxProps,
  DialogProps,
  FormControlLabel,
  OutlinedInputProps,
  styled,
} from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo } from "react";
import { Controller, useForm } from "react-hook-form";

import CheckboxCheckedIconSvg from "../../assets/icons/checkbox_checked.svg?url";
import Dialog from "../GenericDialog";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import BaseOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";

const UncheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  outline: "2px solid #1D91AB",
  outlineOffset: -2,
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#083A50",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const CheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  backgroundImage: `url("${CheckboxCheckedIconSvg}")`,
  backgroundSize: "auto",
  backgroundRepeat: "no-repeat",
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#1D91AB",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "567px !important",
  },
});

const StyledCheckbox = styled(Checkbox)({
  "&.MuiCheckbox-root": {
    padding: "10px",
  },
  "& .MuiSvgIcon-root": {
    fontSize: "24px",
  },
  "&.Mui-disabled": {
    cursor: "not-allowed",
  },
});

const StyledOutlinedInput = styled(BaseOutlinedInput, {
  shouldForwardProp: (prop) => prop !== "resize" && prop !== "rowHeight",
})<OutlinedInputProps & { resize: boolean; rowHeight?: number }>(
  ({ resize, rowHeight = 25, rows, minRows, maxRows }) => ({
    marginTop: "24px",
    "&.MuiInputBase-multiline": {
      padding: "12px",
    },
    "& .MuiInputBase-inputMultiline": {
      resize: resize ? "vertical" : "none",
      minHeight: resize && rowHeight ? `${(+rows || +minRows || 1) * rowHeight}px` : 0,
      maxHeight: resize && maxRows && rowHeight ? `${+maxRows * rowHeight}px` : "none",
      overflow: "auto",
    },
    "&.MuiInputBase-multiline .MuiInputBase-input": {
      lineHeight: `${rowHeight}px`,
      padding: 0,
    },
  })
);

export type FormInput = {
  pendingModelChange: boolean;
  reviewComment: string;
};

type Props = {
  loading?: boolean;
  onCancel?: () => void;
  onSubmit?: (data: FormInput) => void;
} & DialogProps;

const ApproveFormDialog: FC<Props> = ({ open, loading, onCancel, onSubmit, onClose, ...rest }) => {
  const {
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      pendingModelChange: false,
      reviewComment: "",
    },
  });
  const reviewComment = watch("reviewComment");

  const handleOnSubmit = (data: FormInput) => {
    onSubmit?.(data);
    reset();
  };

  const handleOnCancel = () => {
    reset();
    onCancel?.();
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      scroll="body"
      title="Approve Submission Request"
      data-testid="approve-form-dialog"
      actions={
        <>
          <Button onClick={handleOnCancel} disabled={loading}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleSubmit(handleOnSubmit)}
            loading={loading}
            disabled={!reviewComment || loading}
            autoFocus
            data-testid="confirm-to-approve-button"
          >
            Confirm to Approve
          </LoadingButton>
        </>
      }
      {...rest}
    >
      <Controller
        name="reviewComment"
        control={control}
        rules={{
          validate: {
            required: (v: string) => v.trim() !== "" || "This field is required",
            maxLength: (v: string) => v.trim().length <= 500 || "Maximum of 500 characters allowed",
          },
        }}
        render={({ field }) => (
          <StyledOutlinedInput
            {...field}
            inputProps={{
              maxLength: 500,
              style: { height: "auto !important" },
              "aria-label": "Review comment input",
            }}
            name="reviewComment"
            placeholder="500 characters allowed"
            minRows={5}
            maxRows={15}
            data-testid="review-comment"
            sx={{ paddingY: "16px" }}
            required
            multiline
            resize
          />
        )}
      />
      {errors?.reviewComment?.message?.length > 0 && (
        <StyledHelperText data-testid="review-comment-dialog-error">
          {errors.reviewComment.message}
        </StyledHelperText>
      )}

      <Controller
        name="pendingModelChange"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <StyledCheckbox
                {...field}
                checkedIcon={<CheckedIcon readOnly={loading} />}
                icon={<UncheckedIcon readOnly={loading} />}
                disabled={loading}
                inputProps={
                  { "data-testid": "pendingModelChange-checkbox" } as CheckboxProps["inputProps"]
                }
              />
            }
            label="Require Data Model changes"
          />
        )}
      />
      {errors?.pendingModelChange?.message?.length > 0 && (
        <StyledHelperText data-testid="pending-model-change-dialog-error">
          {errors.pendingModelChange.message}
        </StyledHelperText>
      )}
    </StyledDialog>
  );
};

export default memo<Props>(ApproveFormDialog, isEqual);
