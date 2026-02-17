import { LoadingButton } from "@mui/lab";
import { Box, DialogProps, MenuItem, styled } from "@mui/material";
import { FC } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import DefaultBodyText from "../StyledDialogComponents/StyledBodyText";
import DefaultDialog from "../StyledDialogComponents/StyledDialog";
import DefaultDialogActions from "../StyledDialogComponents/StyledDialogActions";
import StyledCloseDialogButton from "../StyledDialogComponents/StyledDialogCloseButton";
import StyledDialogContent from "../StyledDialogComponents/StyledDialogContent";
import DefaultDialogHeader from "../StyledDialogComponents/StyledHeader";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledSelect from "../StyledFormComponents/StyledSelect";

const StyledDialog = styled(DefaultDialog)({
  "& .MuiDialog-paper": {
    width: "731px !important",
    border: "2px solid #5AB8FF",
    padding: "44px 60px 102px",
  },
});

const StyledForm = styled("form")({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: "0 auto",
  marginTop: "0",
  maxWidth: "485px",
});

const StyledHeader = styled(DefaultDialogHeader)({
  color: "#1873BD",
  fontSize: "35px !important",
  lineHeight: "79px !important",
  marginBottom: "0 !important",
});

const StyledBodyText = styled(DefaultBodyText)({
  maxWidth: "510px",
  marginTop: "38px",
  marginBottom: "14px !important",
});

const StyledDialogActions = styled(DefaultDialogActions)({
  marginTop: "54px !important",
});

const StyledButton = styled(LoadingButton)({
  minWidth: "128px",
  height: "50px",
  padding: "10px",
  fontSize: "16px",
  lineHeight: "24px",
  letterSpacing: "0.32px",
});

export type InputForm = {
  /**
   * The Data Commons Display Name selected by the user
   */
  dataCommon: string;
};

type Props = {
  /**
   * The list of Data Commons that the study has been released in
   */
  dataCommons: string[];
  /**
   * Function to handle form submission
   */
  onSubmitForm: (form: InputForm) => void;
  /**
   * Function to handle closing the dialog
   */
  onClose: () => void;
} & Omit<DialogProps, "onClose">;

const DataExplorerDCSelectionDialog: FC<Props> = ({
  open,
  dataCommons,
  onSubmitForm,
  onClose,
  ...rest
}) => {
  const { handleSubmit, control, formState, reset } = useForm<InputForm>({
    defaultValues: { dataCommon: "" },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit: SubmitHandler<InputForm> = async (form: InputForm) => {
    onSubmitForm(form);
    reset();
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby="data-commons-selection-dialog-header"
      data-testid="data-commons-selection-dialog"
      scroll="body"
      {...rest}
    >
      <StyledCloseDialogButton
        data-testid="data-commons-selection-dialog-close-icon"
        aria-label="close"
        onClick={onClose}
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledHeader
        id="data-commons-selection-dialog-header"
        data-testid="data-commons-selection-dialog-header"
        variant="h1"
      >
        Multiple Data Commons
      </StyledHeader>
      <StyledDialogContent>
        <StyledBodyText data-testid="dataCommon-dialog-body" variant="body1">
          This study has been released to multiple Data Commons. Please select one to view the
          corresponding metadata.
        </StyledBodyText>
        <StyledForm>
          <Box>
            <StyledLabel htmlFor="dataCommon-input">
              Data Commons
              <StyledAsterisk />
            </StyledLabel>
            <Controller
              name="dataCommon"
              control={control}
              rules={{ required: "This field is required" }}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  size="small"
                  MenuProps={{ disablePortal: true }}
                  data-testid="dataCommon-field"
                  inputProps={{
                    id: "dataCommon-input",
                    "data-testid": "dataCommon-input",
                  }}
                >
                  {dataCommons?.map((dataCommon) => (
                    <MenuItem
                      key={dataCommon}
                      value={dataCommon}
                      data-testid={`dataCommon-option-${dataCommon}`}
                    >
                      {dataCommon}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            <StyledHelperText data-testid="dataCommon-dialog-error-role">
              {errors?.dataCommon?.message}
            </StyledHelperText>
          </Box>
        </StyledForm>
      </StyledDialogContent>
      <StyledDialogActions>
        <StyledButton
          data-testid="data-commons-selection-dialog-cancel-button"
          variant="contained"
          color="info"
          size="large"
          onClick={onClose}
        >
          Cancel
        </StyledButton>
        <StyledButton
          data-testid="data-commons-selection-dialog-submit-button"
          variant="contained"
          color="success"
          size="large"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
        >
          Confirm
        </StyledButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default DataExplorerDCSelectionDialog;
