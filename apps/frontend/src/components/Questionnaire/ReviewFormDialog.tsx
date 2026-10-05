import { LoadingButton } from "@mui/lab";
import { Box, Button, ButtonProps, DialogProps, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import { FC, ReactNode, memo, useCallback, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { stripHtmlTags } from "@/utils";

import Dialog from "../GenericDialog";
import RichTextEditor from "../RichTextEditor";
import type { RichTextEditorHandle } from "../RichTextEditor";
import { getPlainTextLength } from "../RichTextEditor/utils/markdown/markdownSerializer";
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

/**
 * Gets the visible text length that would remain after the backend sanitizes the comment.
 *
 * @param {string} content - The stored markdown rich-text content.
 * @returns {number} The length of the visible text remaining after sanitization.
 */
const getSanitizedTextLength = (content: string): number =>
  getPlainTextLength(stripHtmlTags(content).trim());

const INVALID_COMMENT_MESSAGE = "Please enter a valid comment.";

type ReviewFormFields = {
  reviewComment: string;
};

type Props = {
  header?: string;
  confirmText?: string;
  confirmButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  loading?: boolean;
  onCancel?: () => void;
  onSubmit?: (reviewComment: string) => void | Promise<unknown>;
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
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ReviewFormFields>({
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      reviewComment: "",
    },
  });

  const [plainTextLength, setPlainTextLength] = useState(0);
  const [sanitizedTextLength, setSanitizedTextLength] = useState(0);

  const editorRef = useRef<RichTextEditorHandle>(null);

  const reviewCommentLengthLabel = useMemo(
    () => Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(plainTextLength),
    [plainTextLength]
  );
  const reviewCommentLimitLabel = Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(MAX_REVIEW_COMMENT_LIMIT);

  const submissionPending = loading || isSubmitting;
  const submitDisabled = submissionPending || isSubmitSuccessful;

  const errorMessage = useMemo<string>(() => {
    if (plainTextLength > 0 && sanitizedTextLength === 0) {
      return INVALID_COMMENT_MESSAGE;
    }

    return errors?.reviewComment?.message || "";
  }, [errors?.reviewComment?.message, plainTextLength, sanitizedTextLength]);

  const handleOnSubmit = async (data: ReviewFormFields) => {
    await onSubmit?.(data.reviewComment);
  };

  const handleOnCancel = () => {
    onCancel?.();
  };

  const handleOnClose = (_event: unknown, reason: string) => {
    if (reason === "backdropClick") {
      return;
    }
    handleOnCancel();
  };

  const handleExited = useCallback(() => {
    reset();
    setPlainTextLength(0);
    setSanitizedTextLength(0);
    editorRef.current?.reset();
  }, [reset]);

  return (
    <StyledDialog
      open={open}
      onClose={handleOnClose}
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
            disabled={!sanitizedTextLength || submitDisabled}
            loading={submissionPending}
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
            required: (v: string) =>
              getSanitizedTextLength(v) > 0 ||
              (getPlainTextLength(v) > 0 ? INVALID_COMMENT_MESSAGE : "This field is required"),
            maxLength: (v: string) =>
              getPlainTextLength(v) <= MAX_REVIEW_COMMENT_LIMIT ||
              `Maximum of ${reviewCommentLimitLabel} characters allowed`,
          },
        }}
        render={({ field }) => (
          <RichTextEditor
            ref={editorRef}
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              setSanitizedTextLength(getSanitizedTextLength(value));
            }}
            onTextLengthChange={setPlainTextLength}
            placeholder={`${reviewCommentLimitLabel} characters allowed`}
            disabled={submitDisabled}
            aria-label="Review comment input"
            data-testid="review-comment"
          />
        )}
      />

      <StyledCharacterCount>
        {errorMessage.length > 0 && (
          <StyledErrorText data-testid="review-comment-dialog-error">
            {errorMessage}
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
