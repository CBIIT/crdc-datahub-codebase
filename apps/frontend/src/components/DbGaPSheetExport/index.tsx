import { useLazyQuery } from "@apollo/client";
import { Button, ButtonProps, styled } from "@mui/material";
import { useSnackbar } from "notistack";
import { FC, memo, useCallback, useState } from "react";

import DownloadIconSvg from "../../assets/icons/download_icon.svg?react";
import {
  DOWNLOAD_DB_GAP_SHEET,
  DownloadDbGaPSheetInput,
  DownloadDbGaPSheetResp,
} from "../../graphql";
import { Logger } from "../../utils";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import Tooltip from "../StyledFormComponents/StyledTooltip";

const StyledButton = styled(Button)({
  fontWeight: 600,
});

/**
 * An array of supported data commons for dbGaP sheet export.
 */
const SUPPORTED_DATA_COMMONS: DataCommon["name"][] = ["CDS"];

/**
 * Props for the dbGap Sheet Export component.
 */
export type DbGaPSheetExportProps = Omit<ButtonProps, "onClick">;

/**
 * A component that handles the logic of exporting dbGaP loading sheets. Will
 * only be rendered if the submission is valid and the data common is supported.
 *
 * @see {@link SUPPORTED_DATA_COMMONS} for the list of supported data commons.
 * @depends on {@link useSubmissionContext}
 * @returns The dbGaP Loading Sheets Button component
 */
const DbGaPSheetExport: FC<DbGaPSheetExportProps> = ({ disabled, ...rest }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { data } = useSubmissionContext();
  const { _id, dataCommons } = data?.getSubmission || {};

  const [downloading, setDownloading] = useState<boolean>(false);

  const [downloadSheet] = useLazyQuery<DownloadDbGaPSheetResp, DownloadDbGaPSheetInput>(
    DOWNLOAD_DB_GAP_SHEET,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
      variables: { submissionID: _id },
    }
  );

  const handleOnClick = useCallback(async () => {
    setDownloading(true);

    try {
      const { data, error } = await downloadSheet();

      if (error) {
        throw error;
      }
      if (!data?.downloadDBGaPLoadSheet) {
        throw new Error("Oops! The API did not return a download link.");
      }

      window.open(data.downloadDBGaPLoadSheet, "_blank", "noopener");
    } catch (error) {
      Logger.error("Error downloading dbGaP sheets.", error);
      enqueueSnackbar(
        error?.message?.trim() || "Oops! Unable to download the dbGaP Loading Sheets.",
        {
          variant: "error",
        }
      );
    } finally {
      setDownloading(false);
    }
  }, [downloadSheet, setDownloading, enqueueSnackbar]);

  if (!_id || !SUPPORTED_DATA_COMMONS.includes(dataCommons)) {
    return null;
  }

  return (
    <Tooltip
      title="This download generates dbGaP submission sheets based on available submission data. Additional information may still be required to complete the dbGaP submission."
      aria-label="dbGaP Loading Sheets Button Tooltip"
      data-testid="dbGaP-sheet-export-tooltip"
      arrow
    >
      <span>
        <StyledButton
          variant="text"
          onClick={handleOnClick}
          data-testid="dbgap-sheet-export-button"
          endIcon={<DownloadIconSvg />}
          disabled={downloading || disabled}
          {...rest}
        >
          dbGaP Sheets
        </StyledButton>
      </span>
    </Tooltip>
  );
};

export default memo<DbGaPSheetExportProps>(DbGaPSheetExport);
