import { LoadingButton } from "@mui/lab";
import { Button, DialogProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo, useState } from "react";

import Dialog from "../GenericDialog";

import TextInput from "./TextInput";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "567px !important",
  },
});

type Props = {
  disableActions?: boolean;
  loading?: boolean;
  onCancel?: () => void;
  onSubmit?: (reviewComment: string) => void;
} & DialogProps;

const RejectFormDialog: FC<Props> = ({
  open,
  disableActions,
  loading,
  onCancel,
  onSubmit,
  onClose,
  ...rest
}) => {
  const [reviewComment, setReviewComment] = useState("");

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = (event?.target?.value || "").trim().substring(0, 500);
    setReviewComment(val);
  };

  const handleOnCancel = () => {
    onCancel?.();
    setReviewComment("");
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      scroll="body"
      title="Reject Submission Request"
      actions={
        <>
          <Button onClick={handleOnCancel} disabled={disableActions}>
            Cancel
          </Button>
          <LoadingButton
            onClick={() => onSubmit(reviewComment)}
            loading={loading}
            disabled={!reviewComment || disableActions}
            autoFocus
          >
            Confirm to Reject
          </LoadingButton>
        </>
      }
      {...rest}
    >
      <TextInput
        name="reviewComment"
        value={reviewComment}
        onChange={handleCommentChange}
        maxLength={500}
        placeholder="500 characters allowed"
        minRows={5}
        maxRows={15}
        data-testid="review-comment"
        sx={{ paddingY: "16px" }}
        required
        multiline
        resize
      />
    </StyledDialog>
  );
};

export default memo<Props>(RejectFormDialog, isEqual);
