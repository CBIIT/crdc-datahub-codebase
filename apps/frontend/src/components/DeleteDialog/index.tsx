import {
  Button,
  ButtonProps,
  Dialog,
  DialogProps,
  IconButton,
  Stack,
  Typography,
  TypographyProps,
  styled,
} from "@mui/material";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "731px !important",
    padding: "47px 54px 74px",
    borderRadius: "8px",
    border: "2px solid #6B7294",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledCloseButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "101px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
  },
});

const StyledConfirmButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "137px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
  },
});

const StyledHeader = styled(Typography)({
  color: "#4B5368",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "30px",
  marginBottom: "50px",
});

const StyledDescription = styled("div")({
  fontFamily: "'Public Sans', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "22px",
});

type Props = {
  header?: string;
  headerProps?: Omit<TypographyProps, "children">;
  description?: string | JSX.Element;
  closeText?: string;
  closeButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  onClose: () => void;
  confirmText?: string;
  confirmButtonProps?: Omit<ButtonProps, "children" | "onClick">;
  onConfirm: () => void;
} & Omit<DialogProps, "onClose" | "title">;

const DeleteDialog = ({
  header = "Remove Data",
  headerProps = {},
  description,
  closeText = "Cancel",
  closeButtonProps = {},
  onClose,
  confirmText = "Confirm to Remove",
  confirmButtonProps = {},
  onConfirm,
  open,
  ...rest
}: Props) => (
  <StyledDialog open={open} onClose={onClose} title="" data-testid="delete-dialog" {...rest}>
    <StyledCloseDialogButton
      onClick={onClose}
      aria-label="close"
      data-testid="delete-dialog-close-icon-button"
    >
      <CloseIconSvg />
    </StyledCloseDialogButton>
    <StyledHeader
      variant="h3"
      data-testid="delete-dialog-header"
      aria-label="Dialog header"
      {...headerProps}
    >
      {header}
    </StyledHeader>
    <StyledDescription id="dialog-description" data-testid="delete-dialog-description">
      {description || (
        <>
          The metadata or files specified in the selected files, along with their associated child
          nodes, will be removed from this data submission, and this action is irreversible.
          <br />
          Are you sure you want to proceed?
        </>
      )}
    </StyledDescription>

    <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} marginTop="58px">
      <StyledCloseButton
        id="error-dialog-close-button"
        variant="contained"
        color="info"
        onClick={onClose}
        aria-label="Cancel button"
        data-testid="delete-dialog-cancel-button"
        {...closeButtonProps}
      >
        {closeText}
      </StyledCloseButton>
      <StyledConfirmButton
        id="error-dialog-delete-button"
        variant="contained"
        color="error"
        onClick={onConfirm}
        aria-label="Confirm to Remove button"
        data-testid="delete-dialog-confirm-button"
        {...confirmButtonProps}
      >
        {confirmText}
      </StyledConfirmButton>
    </Stack>
  </StyledDialog>
);

export default DeleteDialog;
