import { LoadingButton } from "@mui/lab";
import {
  Box,
  Button,
  Checkbox,
  CheckboxProps,
  DialogProps,
  FormControlLabel,
  Typography,
  styled,
} from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo, useMemo } from "react";
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
    "& .MuiDialogContent-root": {
      overflow: "hidden",
    },
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
  shouldForwardProp: (prop) => prop !== "resize",
})<{ resize?: boolean }>(({ resize }) => ({
  marginTop: "24px",
  "&.MuiInputBase-multiline": {
    padding: "12px",
    alignItems: "flex-start",
  },
  "& textarea.MuiInputBase-inputMultiline": {
    resize: resize ? "both" : "none",
    overflow: "auto !important",
    padding: 0,
    lineHeight: "25px",
    width: "600px",
    minWidth: "600px",
    maxWidth: "750px",
    height: "375px",
    minHeight: "375px",
    maxHeight: "500px",
    boxSizing: "border-box",
  },
}));

const StyledCharacterCount = styled(Box)({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "flex-start",
  gap: "8px",
  marginTop: "4px",
  width: 0,
  minWidth: "100%",
  overflow: "hidden",
});

const StyledErrorText = styled(StyledHelperText)({
  marginTop: 0,
  flex: 1,
  minWidth: 0,
  wordBreak: "break-word",
});

const StyledCountLabel = styled(Typography)({
  fontSize: "12px",
  lineHeight: "20px",
  whiteSpace: "nowrap",
});

const MAX_REVIEW_COMMENT_LIMIT = 10_000;

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
  const reviewCommentLengthLabel = useMemo(
    () =>
      Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(reviewComment?.length || 0),
    [reviewComment]
  );
  const reviewCommentLimitLabel = Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(MAX_REVIEW_COMMENT_LIMIT);

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
            maxLength: (v: string) =>
              v.trim().length <= MAX_REVIEW_COMMENT_LIMIT ||
              `Maximum of ${reviewCommentLimitLabel} characters allowed`,
          },
        }}
        render={({ field }) => (
          <StyledOutlinedInput
            {...field}
            inputProps={{
              maxLength: MAX_REVIEW_COMMENT_LIMIT,
              "aria-label": "Review comment input",
            }}
            name="reviewComment"
            placeholder={`${reviewCommentLimitLabel} characters allowed`}
            data-testid="review-comment"
            sx={{ paddingY: "16px" }}
            required
            multiline
            resize
          />
        )}
      />

      <StyledCharacterCount>
        {errors?.reviewComment?.message?.length > 0 && (
          <StyledErrorText data-testid="review-comment-dialog-error">
            {errors.reviewComment.message}
          </StyledErrorText>
        )}
        <StyledCountLabel data-testid="review-comment-character-count">
          {reviewCommentLengthLabel} / {reviewCommentLimitLabel}
        </StyledCountLabel>
      </StyledCharacterCount>

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
