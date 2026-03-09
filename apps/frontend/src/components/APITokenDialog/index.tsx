import { useMutation } from "@apollo/client";
import {
  Button,
  Dialog,
  DialogProps,
  IconButton,
  OutlinedInput,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import { FC, useState } from "react";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import CopyIconSvg from "../../assets/icons/copy_icon.svg?react";
import { GRANT_TOKEN, GrantTokenResp } from "../../graphql";
import GenericAlert, { AlertState } from "../GenericAlert";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    maxWidth: "none",
    borderRadius: "8px",
    width: "755px !important",
    padding: "47px 59px 71px 54px",
    border: "2px solid #0B7F99",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
});

const StyledHeader = styled(Typography)({
  color: "#0B7F99",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif !important",
  fontSize: "35px !important",
  fontStyle: "normal",
  fontWeight: "900 !important",
  lineHeight: "30px !important",
  marginBottom: "50px !important",
});

const StyledTitle = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "400 !important",
  lineHeight: "19.6px !important",
  marginBottom: "58px !important",
  letterSpacing: "unset !important",
});

const StyledExplanationText = styled(Typography)({
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  color: "#083A50 !important",
  textAlign: "center",
  fontSize: "16px !important",
  fontStyle: "italic",
  fontWeight: "400 !important",
  lineHeight: "19.6px !important",
  letterSpacing: "unset !important",
  marginTop: "20px !important",
});

const StyledTokenInput = styled(OutlinedInput)({
  display: "flex",
  width: "313px",
  height: "44px",
  padding: "12px 9px",
  margin: "34px auto 0",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
  background: "#FFFFFF",
  color: "#000000",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "8px",
    border: "1px solid #6B7294 !important",
  },
});

const StyledGenerateButton = styled(Button)({
  width: "128px",
  height: "42px",
  padding: "12px 7px !important",
  borderRadius: "8px !important",
  border: "1px solid #000 !important",
  color: "#FFFFFF",
  textAlign: "center",
  fontFamily: "'Nunito', 'Rubik', sans-serif !important",
  fontSize: "16px !important",
  fontStyle: "normal",
  fontWeight: "700 !important",
  lineHeight: "24px !important",
  letterSpacing: "0.32px !important",
  textTransform: "none !important" as "none",
});

const StyledCopyTokenButton = styled(IconButton)(() => ({
  color: "#000000 !important",
  padding: "8px !important",
  "&.MuiIconButton-root.Mui-disabled": {
    color: "#B0B0B0 !important",
  },
}));

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute !important" as "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledCloseButton = styled(Button)({
  width: "128px",
  height: "42px",
  padding: "12px 60px !important",
  borderRadius: "8px !important",
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
  marginTop: "45px !important",
  "&:hover": {
    background: "transparent !important",
  },
});

type Props = {
  onClose?: () => void;
} & Omit<DialogProps, "onClose">;

const APITokenDialog: FC<Props> = ({ onClose, open, ...rest }) => {
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokenIdx, setTokenIdx] = useState<number | null>(null);
  const [changesAlert, setChangesAlert] = useState<AlertState>(null);

  const [grantToken] = useMutation<GrantTokenResp>(GRANT_TOKEN, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const onGenerateTokenError = () => {
    setChangesAlert({
      severity: "error",
      message: `Token was unable to be created.`,
    });
    setTimeout(() => setChangesAlert(null), 10000);
  };

  const generateToken = async () => {
    try {
      const { data: d, errors } = await grantToken();
      const tokens = d?.grantToken?.tokens;
      if (errors || !tokens?.length) {
        onGenerateTokenError();
        return;
      }

      setTokens(tokens);
      setTokenIdx(0);
    } catch (err) {
      onGenerateTokenError();
    }
  };

  const handleCreateToken = () => {
    if (!tokens?.length || tokenIdx + 1 >= tokens.length) {
      generateToken();
      return;
    }
    setTokenIdx((idx) => idx + 1);
  };

  const handleCopyToken = () => {
    if (!tokens?.length || tokenIdx === null || tokenIdx > tokens.length) {
      return;
    }
    navigator.clipboard.writeText(tokens[tokenIdx]);
  };

  const handleCloseDialog = () => {
    if (typeof onClose === "function") {
      onClose();
    }
    setTokens(null);
    setTokenIdx(null);
    setChangesAlert(null);
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleCloseDialog}
      aria-labelledby="api-token-header"
      {...rest}
    >
      <GenericAlert
        open={!!changesAlert}
        severity={changesAlert?.severity}
        key="api-token-dialog-changes-alert"
      >
        <span>{changesAlert?.message}</span>
      </GenericAlert>
      <StyledCloseDialogButton aria-label="close" onClick={handleCloseDialog}>
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledHeader id="api-token-header" variant="h1">
        API Token
      </StyledHeader>
      <StyledTitle id="api-token-title" variant="body1">
        An API Token is required to utilize the Uploader CLI tool for file uploads.
        <br />
        <br />
        Each time you click the &#39;Create Token&#39; button, a new token will be generated, and
        <br />
        the previous token will be invalidated. A token expires 60 days after its creation.
      </StyledTitle>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.875}
        justifyContent="center"
        alignItems="center"
      >
        <StyledGenerateButton
          id="api-token-create-token-button"
          onClick={handleCreateToken}
          variant="contained"
        >
          Create Token
        </StyledGenerateButton>
        <StyledTokenInput
          id="api-token-input"
          value={tokens?.length ? "*************************************" : ""}
          inputProps={{ "aria-label": "API Token" }}
          readOnly
        />
        <StyledCopyTokenButton
          id="api-token-copy-token-button"
          disabled={!tokens?.length}
          onClick={handleCopyToken}
          aria-label="Copy Token"
        >
          <CopyIconSvg />
        </StyledCopyTokenButton>
      </Stack>
      <StyledExplanationText
        id="api-token-explanation"
        sx={{ visibility: tokens?.length ? "visible" : "hidden" }}
      >
        Copy your token to the clipboard,
        <br />
        as this will be the only time you can see this token
      </StyledExplanationText>
      <StyledCloseButton id="api-token-close-button" variant="outlined" onClick={handleCloseDialog}>
        Close
      </StyledCloseButton>
    </StyledDialog>
  );
};

export default APITokenDialog;
