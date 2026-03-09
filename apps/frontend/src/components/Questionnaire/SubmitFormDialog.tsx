import { LoadingButton } from "@mui/lab";
import { Button, DialogProps, styled } from "@mui/material";
import { FC } from "react";

import Dialog from "../GenericDialog";

const StyledSubmitLoadingButton = styled(LoadingButton)(() => ({
  color: "#0B7F99",
}));

type Props = {
  title?: string;
  message?: string;
  disableActions?: boolean;
  loading?: boolean;
  onCancel?: () => void;
  onSubmit?: () => void;
  onDiscard?: () => void;
} & DialogProps;

const SubmitFormDialog: FC<Props> = ({
  title,
  message,
  disableActions,
  loading,
  onCancel,
  onSubmit,
  onDiscard,
  open,
  onClose,
  ...rest
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title || "Submit Request"}
    message={
      message ||
      "Once your submission request is submitted for review, no further changes can be made. Are you sure you want to proceed?"
    }
    actions={
      <>
        <Button onClick={onCancel} disabled={disableActions}>
          Cancel
        </Button>
        <StyledSubmitLoadingButton
          onClick={onSubmit}
          loading={loading}
          disabled={disableActions}
          autoFocus
        >
          Confirm to Submit
        </StyledSubmitLoadingButton>
      </>
    }
    {...rest}
  />
);

export default SubmitFormDialog;
