import { LoadingButton } from "@mui/lab";
import { Box, Button, ButtonProps, DialogProps, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import { FC, ReactNode, memo, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import Dialog from "../GenericDialog";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import BaseOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";

const StyledOutlinedInput = styled(BaseOutlinedInput)({
  marginTop: "24px",
  width: "fit-content",
  maxWidth: "100%",
  "&.MuiInputBase-multiline": {
    padding: "12px",
    alignItems: "flex-start",
  },
  "& textarea.MuiInputBase-inputMultiline": {
    resize: "both",
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
});

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

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    width: "fit-content",
    maxWidth: "calc(100% - 64px)",
    borderRadius: "8px",
    "& .MuiDialogContent-root": {
      overflow: "hidden",
    },
  },
});

const MAX_REVIEW_COMMENT_LIMIT = 10_000;

type ReviewFormFields = {
  reviewComment: string;
};

type Props = {
  header?: string;
  confirmText?: string;
  confirmButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  loading?: boolean;
  onCancel?: () => void;
  onSubmit?: (reviewComment: string) => void;
  children?: ReactNode;
} & Omit<DialogProps, "onClose" | "onSubmit" | "children" | "title">;

const ReviewFormDialog: FC<Props> = ({
  open,
  header,
  confirmText = "Confirm",
  confirmButtonProps = {},
  loading,
  onCancel,
  onSubmit,
  children,
  ...rest
}) => {
  const {
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<ReviewFormFields>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
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

  const handleOnSubmit = (data: ReviewFormFields) => {
    onSubmit?.(data.reviewComment);
  };

  const handleOnCancel = () => {
    onCancel?.();
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleOnCancel}
      TransitionProps={{ onExited: () => reset() }}
      title={header}
      scroll="body"
      actions={
        <>
          <Button
            data-testid="review-form-dialog-cancel-button"
            onClick={handleOnCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <LoadingButton
            data-testid="review-form-dialog-confirm-button"
            onClick={handleSubmit(handleOnSubmit)}
            disabled={!reviewComment?.trim()?.length || loading}
            loading={loading}
            {...confirmButtonProps}
          >
            {confirmText}
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

      {children}
    </StyledDialog>
  );
};

export default memo<Props>(ReviewFormDialog, isEqual);
