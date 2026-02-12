import { styled, Button, ButtonProps } from "@mui/material";
import { useSnackbar } from "notistack";
import { forwardRef, memo, useState } from "react";

import DownloadIcon from "../../assets/icons/download_icon_filled.svg?react";
import { downloadBlob, FormatDate, Logger } from "../../utils";
import { Status as FormStatus, useFormContext } from "../Contexts/FormContext";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

import { GenerateDocument } from "./pdf/Generate";

const StyledButton = styled(Button)({
  color: "#156071",
  fontSize: "16px",
  fontWeight: 600,
});

const StyledTooltip = styled(StyledFormTooltip)({
  marginLeft: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledDownloadIcon = styled(DownloadIcon)({
  color: "inherit",
  marginLeft: "10px",
});

export type ExportRequestButtonProps = ButtonProps;

/**
 * Provides the button and supporting functionality to export a
 * Submission Request to PDF format.
 *
 * @returns {React.FC} The export PDF button.
 */
const ExportRequestButton = forwardRef<HTMLButtonElement, ExportRequestButtonProps>(
  ({ disabled, ...buttonProps }, ref) => {
    const { enqueueSnackbar } = useSnackbar();
    const { data, status } = useFormContext();
    const [loading, setLoading] = useState<boolean>(false);

    const handleClick = async () => {
      setLoading(true);

      try {
        const printRegion: HTMLElement = document.querySelector("[data-pdf-print-region]");
        if (!printRegion) {
          throw new Error("Unable to locate the print region for the PDF.");
        }

        const pdfBlob = await GenerateDocument(data, printRegion.cloneNode(true) as HTMLElement);

        const studyAbbr =
          data?.questionnaireData?.study?.abbreviation || data?.questionnaireData?.study?.name;
        const submittedDate =
          data?.status === "In Progress"
            ? FormatDate(data?.updatedAt, "YYYY-MM-DD")
            : FormatDate(data?.submittedDate, "YYYY-MM-DD");
        const filename = `CRDCSubmissionPortal-Request-${studyAbbr}-${submittedDate}.pdf`;

        downloadBlob(pdfBlob, filename, "application/pdf");
      } catch (error) {
        Logger.error("ExportRequestButton", error);

        enqueueSnackbar("An error occurred while exporting the Submission Request to PDF.", {
          variant: "error",
        });
      }

      setLoading(false);
    };

    return (
      <StyledTooltip
        title="Click to export this Submission Request as a PDF."
        placement="top"
        data-testid="export-submission-request-tooltip"
        disableInteractive
        arrow
      >
        <span>
          <StyledButton
            onClick={handleClick}
            disabled={loading || disabled || status !== FormStatus.LOADED}
            data-testid="export-submission-request-button"
            aria-label="Export Submission Request to PDF"
            variant="text"
            type="button"
            size="large"
            ref={ref}
            {...buttonProps}
          >
            Download PDF <StyledDownloadIcon />
          </StyledButton>
        </span>
      </StyledTooltip>
    );
  }
);

export default memo<ExportRequestButtonProps>(ExportRequestButton);
