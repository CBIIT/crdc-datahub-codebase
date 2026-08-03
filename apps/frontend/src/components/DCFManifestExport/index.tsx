import { useLazyQuery } from "@apollo/client";
import { Button, ButtonProps, styled } from "@mui/material";
import { useSnackbar } from "notistack";
import { FC, memo, useCallback, useMemo, useState } from "react";

import DownloadIconSvg from "@/assets/icons/download_icon.svg?react";
import { useAuthContext } from "@/components/Contexts/AuthContext";
import { useSubmissionContext } from "@/components/Contexts/SubmissionContext";
import Tooltip from "@/components/StyledFormComponents/StyledTooltip";
import { hasPermission } from "@/config/AuthPermissions";
import {
  DOWNLOAD_DCF_MANIFEST,
  DownloadDCFManifestInput,
  DownloadDCFManifestResp,
} from "@/graphql";
import { Logger } from "@/utils";

const StyledButton = styled(Button)({
  fontWeight: 600,
});

/**
 * An array of statuses that allow the DCF manifest to be downloaded.
 */
const AVAILABLE_STATUSES: SubmissionStatus[] = ["Submitted", "Released", "Completed"];

export type DCFManifestExportProps = Omit<ButtonProps, "onClick">;

/**
 * Provides a button to download the DCF manifest for a submission.
 * Gates visibility based on role, status, and data type.
 *
 * @returns A button component to download the DCF manifest.
 */
const DCFManifestExport: FC<DCFManifestExportProps> = ({ disabled, ...rest }) => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const { data } = useSubmissionContext();

  const { _id } = data?.getSubmission || {};

  const [downloading, setDownloading] = useState<boolean>(false);

  const [downloadManifest] = useLazyQuery<DownloadDCFManifestResp, DownloadDCFManifestInput>(
    DOWNLOAD_DCF_MANIFEST,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
      variables: { submissionID: _id },
    }
  );

  const handleOnClick = useCallback(async () => {
    setDownloading(true);

    try {
      const { data, error } = await downloadManifest();

      if (error) {
        throw error;
      }
      if (!data?.downloadDCFManifest) {
        throw new Error("Oops! The API did not return a download link.");
      }

      window.open(data.downloadDCFManifest, "_blank", "noopener");
    } catch (error) {
      Logger.error("Error downloading DCF manifest.", error);
      enqueueSnackbar(error?.message?.trim() || "Oops! Unable to download the DCF Manifest.", {
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  }, [downloadManifest, setDownloading, enqueueSnackbar]);

  const isVisible = useMemo(
    () =>
      hasPermission(user, "data_submission", "review", data?.getSubmission) &&
      AVAILABLE_STATUSES.includes(data?.getSubmission?.status) &&
      data?.getSubmission?.dataType === "Metadata and Data Files",
    [data?.getSubmission, user]
  );

  if (!_id || !isVisible) {
    return null;
  }

  return (
    <Tooltip
      title="Download the latest generated DCF manifest for this submission."
      aria-label="DCF Manifest Download Button Tooltip"
      data-testid="dcf-manifest-export-tooltip"
      arrow
    >
      <span>
        <StyledButton
          variant="text"
          onClick={handleOnClick}
          data-testid="dcf-manifest-export-button"
          endIcon={<DownloadIconSvg />}
          disabled={downloading || disabled}
          {...rest}
        >
          DCF Manifest
        </StyledButton>
      </span>
    </Tooltip>
  );
};

export default memo<DCFManifestExportProps>(DCFManifestExport);
