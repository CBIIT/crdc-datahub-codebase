import { Button, Dialog, DialogProps, IconButton, Stack, Typography, styled } from "@mui/material";
import { useEffect, useRef, useState } from "react";

import ExcelSheetSvg from "@/assets/icons/excel_sheet_icon.svg?react";
import { Logger } from "@/utils";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import StyledFormOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    width: "577px !important",
    padding: "38px 46.5px 60px",
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
    minWidth: "128px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    backgroundColor: "white",
  },
});

const StyledConfirmButton = styled(Button)({
  "&.MuiButton-root": {
    minWidth: "128px",
    padding: "10px",
    fontSize: "16px",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "24px",
    letterSpacing: "0.32px",
    textTransform: "none",
    alignSelf: "center",
    backgroundColor: "white",
  },
});

const StyledTitle = styled(Typography)({
  color: "#929292",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  lineHeight: "21px",
  marginBottom: "5px",
});

const StyledHeader = styled(Typography)({
  color: "#077A94",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "30px",
  marginBottom: "45px",
});

const StyledDescription = styled("div")({
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "22px",
  marginBottom: "20px",
  letterSpacing: "0.02em",
});

const StyledOutlinedInput = styled(StyledFormOutlinedInput)({
  "& .MuiOutlinedInput-input:read-only": {
    backgroundColor: "white !important",
    cursor: "pointer",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
});

const VisuallyHiddenInput = styled("input")({
  display: "none !important",
});

const StyledExcelSheetSvg = styled(ExcelSheetSvg)({
  color: "#75757A",
});

type Props = {
  disabled?: boolean;
  onClose?: () => void;
  onConfirm?: (file: File) => void;
  onError?: (message: string) => void;
} & Omit<DialogProps, "onClose" | "onError" | "title">;

/**
 * ImportDialog component for uploading Excel files.
 *
 * @param param Props for the dialog component.
 * @returns JSX.Element
 */
const ImportDialog = ({
  disabled,
  onClose,
  onConfirm,
  onError,
  open,
  ...rest
}: Props): JSX.Element => {
  const [file, setFile] = useState<File>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const acceptedExtensions = [".xlsx"];

  useEffect(() => {
    setFile(null);

    return () => {
      setFile(null);
    };
  }, [onClose]);

  /**
   * Triggers the file input dialog.
   *
   * @returns void
   */
  const onImportInputClick = () => {
    uploadInputRef.current?.click();
  };

  /**
   * Handles the initial file import validation. and prepares
   * the file for import.
   *
   * @param event The change event from the file input.
   * @returns void
   */
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event?.target || {};
    const file = files?.[0];

    if (!file) {
      Logger.error(`ImportApplicationButton: No file selected`);
      return;
    }

    const isCorrectFormat = acceptedExtensions.some(
      (ext) => file.name?.toLowerCase()?.endsWith(ext)
    );
    if (!isCorrectFormat) {
      Logger.error(`ImportApplicationButton: Unsupported file format`);
      onError?.(
        "Import failed. Your data could not be imported. Please check the file format and template, then try again."
      );
      return;
    }

    setFile(file);
  };

  /**
   * Handles the import of the selected file.
   *
   * @returns void
   */
  const onImportClick = () => {
    if (!file) {
      return;
    }

    onConfirm?.(file);
  };

  return (
    <StyledDialog open={open} onClose={onClose} title="" data-testid="import-dialog" {...rest}>
      <StyledCloseDialogButton
        onClick={onClose}
        aria-label="close"
        data-testid="import-dialog-close-icon-button"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledTitle variant="h4" data-testid="import-dialog-title">
        Submission Request Form
      </StyledTitle>
      <StyledHeader variant="h3" data-testid="import-dialog-header">
        Import from File
      </StyledHeader>
      <StyledDescription data-testid="import-dialog-description">
        Importing a file will overwrite any data you have entered so far. Do you want to proceed?
      </StyledDescription>

      <VisuallyHiddenInput
        ref={uploadInputRef}
        type="file"
        accept={acceptedExtensions.toString()}
        data-testid="import-upload-file-input"
        aria-label="Upload application template"
        onChange={handleImport}
        readOnly={disabled}
      />

      <StyledOutlinedInput
        value={file?.name || ""}
        placeholder="Choose Excel Files"
        endAdornment={<StyledExcelSheetSvg />}
        onClick={onImportInputClick}
        data-testid="import-dialog-file-input"
        readOnly
      />

      <Stack
        direction="row"
        justifyContent="center"
        alignItems="center"
        spacing={2}
        marginTop="58px"
      >
        <StyledCloseButton
          id="error-dialog-close-button"
          variant="contained"
          color="info"
          onClick={onClose}
          disabled={disabled}
          aria-label="Cancel button"
          data-testid="import-dialog-cancel-button"
        >
          Cancel
        </StyledCloseButton>
        <StyledConfirmButton
          id="info-dialog-import-button"
          variant="contained"
          color="info"
          onClick={onImportClick}
          disabled={disabled}
          aria-label="Confirm to Remove button"
          data-testid="import-dialog-confirm-button"
        >
          Import
        </StyledConfirmButton>
      </Stack>
    </StyledDialog>
  );
};

export default ImportDialog;
