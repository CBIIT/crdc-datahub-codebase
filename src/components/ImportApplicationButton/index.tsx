import { Button, ButtonProps, Stack, styled, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { useState } from "react";

import ImportIconSvg from "@/assets/icons/import_icon.svg?react";
import config from "@/config/SectionConfig";
import useFormMode from "@/hooks/useFormMode";
import { Logger } from "@/utils";

import { useAuthContext } from "../Contexts/AuthContext";
import { useFormContext } from "../Contexts/FormContext";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

import ImportDialog, { IMPORT_ERROR_MESSAGE } from "./ImportDialog";

const StyledImportIcon = styled(ImportIconSvg)({
  width: "27px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "16px",
  color: "currentColor",
});

const StyledText = styled(Typography)({
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  letterSpacing: "-0.25px",
  fontWeight: 600,
  fontSize: "16px",
  lineHeight: "150%",
  color: "inherit",
  paddingLeft: "14px",
});

const StyledStack = styled(Stack)({
  margin: "0 !important",
  width: "100%",
});

const StyledImportButton = styled(Button)({
  justifyContent: "flex-start",
  padding: "12px 14px",
  marginRight: "auto",
  color: "#136071",
  "&:hover": {
    color: "#00819E",
    background: "transparent",
  },
  "&.Mui-disabled": {
    color: "#BBBBBB",
    opacity: 1,
  },
  "& .MuiButton-startIcon": {
    marginRight: "0px !important",
  },
});

const StyledTooltip = styled(StyledFormTooltip)({
  marginLeft: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const disableImportStatuses: ApplicationStatus[] = [
  "Submitted",
  "Approved",
  "Rejected",
  "Canceled",
  "Deleted",
];

type Props = {
  /**
   * The active section of the form.
   */
  activeSection?: string;
} & Omit<ButtonProps, "onClick">;

/**
 * ImportApplicationButton component for handling the import of application data
 * from an Excel file.
 *
 * @param param Props for the button component.
 * @returns JSX.Element
 */
const ImportApplicationButton = ({ activeSection, disabled = false, ...rest }: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const { data, formRef, setData } = useFormContext();
  const { readOnlyInputs } = useFormMode();

  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const isFormOwner = user?._id === data?.applicant?.applicantID;
  const isReviewSection = activeSection?.toUpperCase() === config.REVIEW.id.toUpperCase();
  const shouldDisable =
    disabled || disableImportStatuses.includes(data?.status) || readOnlyInputs || isReviewSection;

  /**
   * Triggers the file input dialog.
   *
   * @returns void
   */
  const onImportClick = () => {
    if (shouldDisable) {
      return;
    }

    setOpenDialog(true);
  };

  /**
   * Resets the import state by closing the dialog and resetting the uploading flag.
   *
   * @returns void
   */
  const resetImportState = () => {
    setOpenDialog(false);
    setIsUploading(false);
  };

  /**
   * Handles the import of the selected file and uses middleware
   * to parse only the valid values from the Excel file. Finally,
   * it updates the form data to the new imported data.
   *
   * @param file The file to import.
   * @returns void
   */
  const handleImport = async (file: File) => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");

    // Add the file back to a FileList
    const dataTransfer = new DataTransfer();
    dataTransfer?.items?.add(file);

    const dataTransferFile = dataTransfer?.files?.[0];
    if (typeof dataTransferFile?.arrayBuffer !== "function") {
      Logger.error(
        `ImportApplicationButton: File does not have arrayBuffer method`,
        dataTransferFile
      );
      resetImportState();
      return;
    }

    let parsedForm: QuestionnaireData;
    try {
      parsedForm = await QuestionnaireExcelMiddleware.parse(dataTransferFile, {});
    } catch (error) {
      Logger.error(`ImportApplicationButton: Failed to parse file`, error);
      enqueueSnackbar(IMPORT_ERROR_MESSAGE, { variant: "error" });
      resetImportState();
      return;
    }

    const isCompleted = parsedForm?.sections?.every((section) => section.status === "Completed");
    const res = await setData(parsedForm, { skipSave: false });

    if (res?.status === "success") {
      enqueueSnackbar(
        isCompleted
          ? "Your data has been imported and all passed validation. You may proceed to Review & Submit."
          : "Your data has been imported, but some pages contain validation errors. Please review each page and resolve before submitting.",
        { variant: "success" }
      );
    } else {
      enqueueSnackbar(IMPORT_ERROR_MESSAGE, { variant: "error" });
    }

    setTimeout(() => formRef?.current?.reportValidity(), 200);
    resetImportState();
  };

  /**
   * Handles the error callback from the ImportDialog.
   *
   * @param message The error message to display.
   * @returns void
   */
  const handleImportError = (message: string) => {
    enqueueSnackbar(message, { variant: "error" });
    setOpenDialog(false);
  };

  if (!isFormOwner) {
    return null;
  }

  return (
    <>
      <StyledStack direction="row" alignItems="center" justifyContent="center">
        <StyledImportButton
          variant="text"
          onClick={onImportClick}
          disabled={shouldDisable}
          startIcon={<StyledImportIcon />}
          aria-label="Import application from Excel button"
          data-testid="import-application-excel-button"
          disableTouchRipple
          {...rest}
        >
          <StyledTooltip
            title="Import the Submission Request from Excel."
            placement="top"
            data-testid="import-application-excel-tooltip"
            disableInteractive
            arrow
          >
            <StyledText variant="body2" data-testid="import-application-excel-tooltip-text">
              Import Form
            </StyledText>
          </StyledTooltip>
        </StyledImportButton>
      </StyledStack>

      <ImportDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onConfirm={handleImport}
        onError={handleImportError}
        disabled={isUploading}
      />
    </>
  );
};

export default ImportApplicationButton;
