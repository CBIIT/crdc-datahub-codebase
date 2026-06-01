import { LoadingButton } from "@mui/lab";
import { Box, Button, ButtonProps, DialogProps, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import { FC, ReactNode, memo, useCallback, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import Dialog from "../GenericDialog";
import RichTextEditor from "../RichTextEditor";
import type { RichTextEditorHandle } from "../RichTextEditor";
import { getPlainTextLength } from "../RichTextEditor/utils/plainTextUtils";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";

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
    maxHeight: "calc(100vh - 64px)",
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

  const [plainTextLength, setPlainTextLength] = useState(0);

  const editorRef = useRef<RichTextEditorHandle>(null);

  const reviewCommentLengthLabel = useMemo(
    () => Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(plainTextLength),
    [plainTextLength]
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

  const handleExited = useCallback(() => {
    reset();
    setPlainTextLength(0);
    editorRef.current?.reset();
  }, [reset]);

  return (
    <StyledDialog
      open={open}
      onClose={handleOnCancel}
      TransitionProps={{ onExited: handleExited }}
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
            disabled={!plainTextLength || loading}
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
            required: (v: string) => getPlainTextLength(v) > 0 || "This field is required",
            maxLength: (v: string) =>
              getPlainTextLength(v) <= MAX_REVIEW_COMMENT_LIMIT ||
              `Maximum of ${reviewCommentLimitLabel} characters allowed`,
          },
        }}
        render={({ field }) => (
          <RichTextEditor
            ref={editorRef}
            value={field.value}
            onChange={field.onChange}
            onTextLengthChange={setPlainTextLength}
            placeholder={`${reviewCommentLimitLabel} characters allowed`}
            disabled={loading}
            aria-label="Review comment input"
            data-testid="review-comment"
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
