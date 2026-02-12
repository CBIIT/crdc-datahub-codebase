import { useLazyQuery } from "@apollo/client";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Button, Stack, Typography, styled } from "@mui/material";
import { useSnackbar } from "notistack";
import { FC, ReactElement, useMemo, useState } from "react";

import { hasPermission } from "../../config/AuthPermissions";
import { TOOLTIP_TEXT } from "../../config/DashboardTooltips";
import env from "../../env";
import { RETRIEVE_CLI_CONFIG, RetrieveCLIConfigResp } from "../../graphql";
import { downloadBlob, extractVersion, filterAlphaNumeric } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import Tooltip from "../Tooltip";
import UploaderConfigDialog, { InputForm } from "../UploaderConfigDialog";
import UploaderToolDialog from "../UploaderToolDialog";

import FlowWrapper from "./FlowWrapper";

export type Props = {
  /**
   * The submission to download a pre-configured CLI config for.
   */
  submission: Submission;
};

const StyledBox = styled(Box)({
  maxWidth: "790px",
  lineHeight: "22px",
  marginTop: "10px",
});

const StyledDownloadButton = styled(Button)({
  padding: "10px 6px",
  fontSize: "14px",
  fontStyle: "normal",
  lineHeight: "16px",
  letterSpacing: "0.32px",
  width: "137px",
  height: "47px",
  "&.MuiButtonBase-root": {
    marginLeft: "auto",
  },
});

const StyledToolButton = styled(Typography)({
  color: "#005999",
  cursor: "pointer",
  lineHeight: "16px",
  fontWeight: 700,
  display: "inline",
  textDecoration: "underline",
  textDecorationThickness: "1px",
  textUnderlineOffset: "1.5px",
});

const StyledOpenInNewIcon = styled(OpenInNewIcon)({
  color: "#005999",
  fontSize: "18px",
  verticalAlign: "middle",
  marginLeft: "4px",
});

const StyledTooltip = styled(Tooltip)(() => ({
  alignSelf: "start",
}));

const StyledUploaderCLIVersionText = styled("span")(() => ({
  color: "#000",
  fontWeight: 400,
  fontSize: "11.5px",
  textTransform: "uppercase",
}));

const StyledVersionButton = styled(Button)(() => ({
  fontWeight: 700,
  textDecoration: "underline",
  color: "#005A9E",
  cursor: "pointer",
  fontSize: "11.5px",
  margin: 0,
  marginTop: "-3px",
  marginLeft: "3px",
  padding: 0,
  minWidth: 0,
  textTransform: "none",
  "&:hover": {
    background: "transparent",
    textDecoration: "underline",
  },
}));

/**
 * Provides a way to download the Uploader CLI tool and a pre-configured CLI config file.
 *
 * @param {Props} props
 * @returns {React.FC<Props>}
 */
export const DataUpload: FC<Props> = ({ submission }: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const { _id, name } = submission || {};

  const [cliDialogOpen, setCLIDialogOpen] = useState<boolean>(false);
  const [configDialogOpen, setConfigDialogOpen] = useState<boolean>(false);
  const [retrieveCLIConfig] = useLazyQuery<RetrieveCLIConfigResp>(RETRIEVE_CLI_CONFIG, {
    context: { clientName: "backend" },
  });

  const handleConfigDownload = async ({ manifest, dataFolder, archive_manifest }: InputForm) => {
    try {
      const { data, error } = await retrieveCLIConfig({
        variables: {
          _id,
          dataFolder,
          manifest,
          archive_manifest,
          apiURL: env.VITE_BACKEND_API,
        },
      });

      if (error || !data?.retrieveCLIConfig?.length) {
        throw new Error(error.message);
      }

      const filteredName = filterAlphaNumeric(name.trim()?.replaceAll(" ", "-"), "-");
      const prefixedName = `cli-config-${filteredName}`;
      const filename = `${prefixedName.replace(/-+$/, "")}.yml`;

      downloadBlob(data.retrieveCLIConfig, filename, "application/yaml");
      setConfigDialogOpen(false);
    } catch (e) {
      enqueueSnackbar("Unable to download Uploader CLI config file", {
        variant: "error",
      });
    }
  };

  const Actions: ReactElement = useMemo(() => {
    if (submission?.dataType !== "Metadata and Data Files") {
      return null;
    }

    return (
      <StyledDownloadButton
        disabled={!hasPermission(user, "data_submission", "create", submission)}
        onClick={() => setConfigDialogOpen(true)}
        variant="contained"
        color="info"
        data-testid="uploader-cli-config-button"
      >
        Download Configuration File
      </StyledDownloadButton>
    );
  }, [submission, user]);

  const Adornments: ReactElement = useMemo(() => {
    const version = extractVersion(env?.VITE_UPLOADER_CLI_VERSION);
    if (submission?.dataType !== "Metadata and Data Files" || !version) {
      return null;
    }

    return (
      <Stack direction="row" alignItems="center" ml="10px">
        <StyledUploaderCLIVersionText data-testid="uploader-cli-version-wrapper">
          Uploader CLI Version:{" "}
          <StyledTooltip
            title={TOOLTIP_TEXT.FILE_UPLOAD.UPLOAD_CLI_VERSION}
            open={undefined}
            disableHoverListener={false}
            placement="top"
            arrow
          >
            <StyledVersionButton
              variant="text"
              onClick={() => setCLIDialogOpen(true)}
              data-testid="uploader-cli-version-button"
              disableRipple
              disableFocusRipple
            >
              v{version}
            </StyledVersionButton>
          </StyledTooltip>
        </StyledUploaderCLIVersionText>
      </Stack>
    );
  }, [submission?.dataType, env?.VITE_UPLOADER_CLI_VERSION]);

  return (
    <FlowWrapper index={2} title="Upload Data Files" titleAdornment={Adornments} actions={Actions}>
      {submission?.dataType === "Metadata and Data Files" ? (
        <>
          <StyledBox data-testid="uploader-cli-footer">
            The CLI Tool is used to upload data files to CRDC Submission Portal and requires a
            configuration file to work. The CLI Tools is a one-time download however the
            configuration file needs to be customized for each submission. You can either edit the
            example configuration files found in the{" "}
            <StyledToolButton
              onClick={() => setCLIDialogOpen(true)}
              data-testid="uploader-cli-download-button"
            >
              <span>CLI Tool download</span>
              <StyledOpenInNewIcon />
            </StyledToolButton>
            , or you can click the button on the right to download a configuration file customized
            for this submission.
          </StyledBox>
          <UploaderToolDialog open={cliDialogOpen} onClose={() => setCLIDialogOpen(false)} />
          <UploaderConfigDialog
            open={configDialogOpen}
            onClose={() => setConfigDialogOpen(false)}
            onDownload={handleConfigDownload}
          />
        </>
      ) : (
        <StyledBox data-testid="uploader-cli-footer-alt">
          This submission is for metadata only; there is no need to upload data files.
        </StyledBox>
      )}
    </FlowWrapper>
  );
};
