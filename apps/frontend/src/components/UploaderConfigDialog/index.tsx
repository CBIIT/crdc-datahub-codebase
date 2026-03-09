import { LoadingButton } from "@mui/lab";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  IconButton,
  Typography,
  styled,
} from "@mui/material";
import { isEqual } from "lodash";
import React, { FC, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import Tooltip from "../Tooltip";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "731px !important",
    padding: "47px 59px 71px 54px",
    border: "2px solid #0B7F99",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledHeader = styled(Typography)({
  color: "#0B7F99",
  fontFamily: "'Nunito Sans' !important",
  fontSize: "35px !important",
  fontStyle: "normal",
  fontWeight: "900 !important",
  lineHeight: "30px !important",
  marginBottom: "30px !important",
});

const StyledDialogContent = styled(DialogContent)({
  padding: 0,
  marginBottom: "32px",
});

const StyledBodyText = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "400 !important",
  lineHeight: "19.6px !important",
  marginBottom: "28px !important",
  letterSpacing: "unset !important",
});

const StyledCloseDialogButton = styled(IconButton)({
  position: "absolute !important" as "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
});

const StyledForm = styled("form")({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: "0 auto",
  marginTop: "28px",
  maxWidth: "484px",
});

const StyledDialogActions = styled(DialogActions)({
  padding: "0 !important",
  justifyContent: "center",
});

const StyledButton = styled(LoadingButton)({
  width: "128px",
  height: "42px",
  padding: "12px 60px !important",
  borderRadius: "8px !important",
  background: "#FFF !important",
  border: "1px solid #000 !important",
  color: "#000 !important",
  textAlign: "center",
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "700 !important",
  lineHeight: "24px !important",
  letterSpacing: "0.32px",
  textTransform: "none !important" as "none",
  alignSelf: "center",
  margin: "0 15px !important",
  marginTop: "45px !important",
  "&:hover": {
    background: "transparent !important",
  },
});

export type InputForm = {
  dataFolder: string;
  manifest: string;
  archive_manifest?: string;
};

type Props = {
  onClose: () => void;
  onDownload: (form: InputForm) => Promise<void>;
} & Omit<DialogProps, "onClose">;

/**
 * Provides a dialog form for downloading a Uploader CLI configuration file.
 *
 * @param {Props} props
 * @returns {React.FC<Props>}
 */
const UploaderConfigDialog: FC<Props> = ({ onClose, onDownload, open, ...rest }) => {
  const { reset, register, handleSubmit, formState } = useForm<InputForm>();
  const { errors } = formState;

  const [downloading, setDownloading] = useState<boolean>(false);

  const onSubmit = async (data: InputForm) => {
    setDownloading(true);
    await onDownload(data);
    setDownloading(false);
  };

  useEffect(() => {
    reset();
  }, [open]);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby="uploader-config-dialog-header"
      data-testid="uploader-config-dialog"
      {...rest}
    >
      <StyledCloseDialogButton
        data-testid="uploader-config-dialog-close-icon"
        aria-label="close"
        onClick={onClose}
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledHeader
        id="uploader-config-dialog-header"
        data-testid="uploader-config-dialog-header"
        variant="h1"
      >
        Download Configuration File
      </StyledHeader>
      <StyledDialogContent>
        <StyledBodyText data-testid="uploader-config-dialog-body" variant="body1">
          Please provide the full path to the data files and to the file manifest.
        </StyledBodyText>
        <StyledForm onSubmit={handleSubmit(onSubmit)} id="uploader-config-dialog-form">
          <Box>
            <StyledLabel id="data-folder-input-label">
              Full Path to Data Files Folder
              <StyledAsterisk />
              <Tooltip
                title="Enter the full path for the Data Files folder on your local machine or S3 bucket."
                open={undefined}
                disableHoverListener={false}
                data-testid="data-folder-input-tooltip"
              />
            </StyledLabel>
            <StyledOutlinedInput
              {...register("dataFolder", {
                required: "This field is required",
                setValueAs: (v: string) => v?.trim(),
              })}
              placeholder="/Users/me/my-data-files-folder"
              data-testid="uploader-config-dialog-input-data-folder"
              inputProps={{ "aria-labelledby": "data-folder-input-label" }}
            />
            <StyledHelperText data-testid="uploader-config-dialog-error-data-folder">
              {errors?.dataFolder?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="manifest-input-label">
              Full Path to Manifest File
              <StyledAsterisk />
              <Tooltip
                title="Enter the full path for the File Manifest on your local machine or S3 bucket."
                open={undefined}
                disableHoverListener={false}
                data-testid="manifest-input-tooltip"
              />
            </StyledLabel>
            <StyledOutlinedInput
              {...register("manifest", {
                required: "This field is required",
                setValueAs: (v: string) => v?.trim(),
              })}
              placeholder="/Users/me/my-metadata-folder/my-file-manifest.tsv"
              data-testid="uploader-config-dialog-input-manifest"
              inputProps={{ "aria-labelledby": "manifest-input-label" }}
            />
            <StyledHelperText data-testid="uploader-config-dialog-error-manifest">
              {errors?.manifest?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="archive-manifest-input-label">
              Full Path to Archive Manifest File
              <Tooltip
                title="Enter the full path for the Archive Manifest file on your local machine or S3 bucket."
                open={undefined}
                disableHoverListener={false}
                data-testid="archive-manifest-input-tooltip"
              />
            </StyledLabel>
            <StyledOutlinedInput
              {...register("archive_manifest", {
                setValueAs: (v: string) => v?.trim(),
              })}
              placeholder="/Users/me/my-metadata-folder/my-archive-manifest.tsv"
              data-testid="uploader-config-dialog-input-archive-manifest"
              inputProps={{ "aria-labelledby": "archive-manifest-input-label" }}
            />
            <StyledHelperText data-testid="uploader-config-dialog-error-archive-manifest">
              {errors?.archive_manifest?.message}
            </StyledHelperText>
          </Box>
        </StyledForm>
      </StyledDialogContent>
      <StyledDialogActions>
        <StyledButton
          data-testid="uploader-config-dialog-close-button"
          variant="outlined"
          onClick={onClose}
        >
          Cancel
        </StyledButton>
        <StyledButton
          data-testid="uploader-config-dialog-download-button"
          variant="outlined"
          type="submit"
          form="uploader-config-dialog-form"
          loading={downloading}
        >
          Download
        </StyledButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default React.memo<Props>(UploaderConfigDialog, isEqual);
