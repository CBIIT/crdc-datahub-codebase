import { useMutation, useQuery } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import { Box, DialogProps, MenuItem, styled, TextField } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { FC } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
  REQUEST_ACCESS,
  RequestAccessInput,
  RequestAccessResp,
} from "../../graphql";
import { formatFullStudyName, Logger, validateUTF8 } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import { useInstitutionList } from "../Contexts/InstitutionListContext";
import StyledBodyText from "../StyledDialogComponents/StyledBodyText";
import DefaultDialog from "../StyledDialogComponents/StyledDialog";
import DefaultDialogActions from "../StyledDialogComponents/StyledDialogActions";
import StyledCloseDialogButton from "../StyledDialogComponents/StyledDialogCloseButton";
import StyledDialogContent from "../StyledDialogComponents/StyledDialogContent";
import DefaultDialogHeader from "../StyledDialogComponents/StyledHeader";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import StyledAutocomplete from "../StyledFormComponents/StyledAutocomplete";
import StyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../StyledFormComponents/StyledSelect";

const StyledDialog = styled(DefaultDialog)({
  "& .MuiDialog-paper": {
    width: "803px !important",
    border: "2px solid #5AB8FF",
  },
});

const StyledForm = styled("form")({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  margin: "0 auto",
  marginTop: "28px",
  maxWidth: "485px",
});

const StyledHeader = styled(DefaultDialogHeader)({
  color: "#1873BD",
  fontSize: "45px !important",
  marginBottom: "24px !important",
});

const StyledDialogActions = styled(DefaultDialogActions)({
  marginTop: "36px !important",
});

const StyledButton = styled(LoadingButton)({
  minWidth: "137px",
  padding: "10px",
  fontSize: "16px",
  lineHeight: "24px",
  letterSpacing: "0.32px",
});

export type InputForm = RequestAccessInput;

type Props = {
  onClose: () => void;
} & Omit<DialogProps, "onClose">;

const RoleOptions: UserRole[] = ["Submitter"];

/**
 * Provides a dialog for users to request access to a specific role.
 *
 * @param {Props} props
 * @returns {React.FC<Props>}
 */
const FormDialog: FC<Props> = ({ onClose, ...rest }) => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const { data: listInstitutions } = useInstitutionList();

  const { handleSubmit, register, control, formState } = useForm<InputForm>({
    defaultValues: {
      role: RoleOptions.includes(user.role) ? user.role : "Submitter",
      institutionName: "",
      studies: [],
      additionalInfo: "",
    },
  });
  const { errors, isSubmitting } = formState;

  const { data: listStudies } = useQuery<ListApprovedStudiesResp, ListApprovedStudiesInput>(
    LIST_APPROVED_STUDIES,
    {
      variables: {
        orderBy: "studyName",
        sortDirection: "asc",
      },
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: () => {
        enqueueSnackbar("Unable to retrieve approved studies list.", {
          variant: "error",
        });
      },
    }
  );

  const [requestAccess] = useMutation<RequestAccessResp, RequestAccessInput>(REQUEST_ACCESS, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const onSubmit: SubmitHandler<InputForm> = async (input: InputForm) => {
    const { data, errors } = await requestAccess({
      variables: input,
    }).catch((e) => ({
      data: null,
      errors: e,
    }));

    if (!data?.requestAccess?.success || errors) {
      enqueueSnackbar("Unable to submit access request form. Please try again.", {
        variant: "error",
      });
      Logger.error("Unable to submit form", errors);
      return;
    }

    onClose();
  };

  return (
    <StyledDialog
      onClose={onClose}
      aria-labelledby="access-request-dialog-header"
      data-testid="access-request-dialog"
      scroll="body"
      {...rest}
    >
      <StyledCloseDialogButton
        data-testid="access-request-dialog-close-icon"
        aria-label="close"
        onClick={onClose}
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledHeader
        id="access-request-dialog-header"
        data-testid="access-request-dialog-header"
        variant="h1"
      >
        Request Access
      </StyledHeader>
      <StyledDialogContent>
        <StyledBodyText data-testid="access-request-dialog-body" variant="body1">
          Please fill out the form below to request access.
        </StyledBodyText>
        <StyledForm>
          <Box>
            <StyledLabel id="role-input-label">
              Role
              <StyledAsterisk />
            </StyledLabel>
            <Controller
              name="role"
              control={control}
              rules={{ required: "This field is required" }}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  size="small"
                  MenuProps={{ disablePortal: true }}
                  data-testid="access-request-role-field"
                  inputProps={{ "aria-labelledby": "role-input-label" }}
                >
                  {RoleOptions.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            <StyledHelperText data-testid="access-request-dialog-error-role">
              {errors?.role?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="institution-input-label">
              Institution
              <StyledAsterisk />
            </StyledLabel>
            <Controller
              name="institutionName"
              control={control}
              rules={{
                validate: {
                  required: (v: string) => v.trim() !== "" || "This field is required",
                  maxLength: (v: string) => v.length <= 100 || "Maximum of 100 characters allowed",
                  utf8: validateUTF8,
                },
              }}
              render={({ field }) => (
                <StyledAutocomplete
                  {...field}
                  options={listInstitutions?.map((i) => i.name) || []}
                  onChange={(_, data: string) => field.onChange(data.trim())}
                  onInputChange={(_, data: string) => field.onChange(data.trim())}
                  renderInput={({ inputProps, ...params }) => (
                    <TextField
                      {...params}
                      inputProps={{
                        "aria-labelledby": "institution-input-label",
                        maxLength: 100,
                        ...inputProps,
                      }}
                      placeholder="100 characters allowed"
                    />
                  )}
                  data-testid="access-request-institution-field"
                  freeSolo
                />
              )}
            />
            <StyledHelperText data-testid="access-request-dialog-error-institution">
              {errors?.institutionName?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="studies-input-label">
              Studies
              <StyledAsterisk />
            </StyledLabel>
            <Controller
              name="studies"
              control={control}
              rules={{ required: "This field is required" }}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  size="small"
                  MenuProps={{ disablePortal: true }}
                  data-testid="access-request-studies-field"
                  inputProps={{
                    "aria-labelledby": "studies-input-label",
                  }}
                  placeholderText="Select one or more studies from the list"
                  multiple
                >
                  {listStudies?.listApprovedStudies?.studies?.map((study) => (
                    <MenuItem
                      key={study._id}
                      value={study._id}
                      data-testid={`studies-${study.studyName}`}
                    >
                      {formatFullStudyName(study.studyName, study.studyAbbreviation)}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            <StyledHelperText data-testid="access-request-dialog-error-organization">
              {errors?.studies?.message}
            </StyledHelperText>
          </Box>
          <Box>
            <StyledLabel id="additionalInfo-input-label">Additional Info</StyledLabel>
            <StyledOutlinedInput
              {...register("additionalInfo", {
                setValueAs: (v: string) => v?.trim(),
                validate: {
                  maxLength: (v: string) =>
                    v.length > 200 ? "Maximum of 200 characters allowed" : null,
                },
              })}
              placeholder="Maximum of 200 characters"
              data-testid="access-request-additionalInfo-field"
              inputProps={{ "aria-labelledby": "additionalInfo-input-label", maxLength: 200 }}
              multiline
              rows={3}
            />
            <StyledHelperText data-testid="access-request-dialog-error-additionalInfo">
              {errors?.additionalInfo?.message}
            </StyledHelperText>
          </Box>
        </StyledForm>
      </StyledDialogContent>
      <StyledDialogActions>
        <StyledButton
          data-testid="access-request-dialog-cancel-button"
          variant="contained"
          color="info"
          size="large"
          onClick={onClose}
        >
          Cancel
        </StyledButton>
        <StyledButton
          data-testid="access-request-dialog-submit-button"
          variant="contained"
          color="success"
          size="large"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
        >
          Submit
        </StyledButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default React.memo<Props>(FormDialog);
