import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Button, ButtonProps, Stack, styled, TextField, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { hasPermission } from "@/config/AuthPermissions";

import {
  LIST_USERS,
  ListUsersResp,
  REOPEN_APPROVED_SR,
  ReopenApprovedSRInput,
  ReopenApprovedSRResp,
} from "../../graphql";
import { Logger } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import DeleteDialog from "../DeleteDialog";
import StyledAutocomplete from "../StyledFormComponents/StyledAutocomplete";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledActionButton = styled(Button)({
  background: "#C1DCFF !important",
  borderRadius: "8px",
  border: "2px solid #84A2C9",
  color: "#1F4371 !important",
  width: "82px",
  height: "30px",
  textTransform: "none",
  fontWeight: 700,
  fontSize: "16px",
  "&.Mui-disabled": {
    cursor: "not-allowed",
    opacity: 0.6,
  },
});

const StyledFormBox = styled(Box)({
  padding: "40px 72px 0",
});

const StyledFieldLabel = styled(Typography)({
  fontStyle: "normal",
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "20px",
  color: "#083A50",
  marginBottom: "4px",
});

const StyledDescriptionText = styled(Typography)({
  fontStyle: "normal",
  fontWeight: 400,
  fontSize: "16px",
  lineHeight: "22px",
  color: "#453E3E",
  marginTop: "5px",
});

type UserOption = Pick<User, "_id"> & { label: string };

type FormValues = {
  study: string;
  program: string;
  owner: UserOption | null;
};

type Props = {
  application: Omit<Application, "questionnaireData">;
  onComplete?: () => void;
} & Omit<ButtonProps, "onClick">;

const ReopenApplicationButton = ({ application, onComplete, disabled, ...rest }: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  const { control, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: {
      study: application?.studyName
        ? `${application.studyName}${
            application.studyAbbreviation ? ` (${application.studyAbbreviation})` : ""
          }`
        : "NA",
      program: application?.programName
        ? `${application.programName}${
            application.programAbbreviation ? ` (${application.programAbbreviation})` : ""
          }`
        : "NA",
      owner: null,
    },
  });

  const selectedOwner = watch("owner");

  const [listUsers] = useLazyQuery<ListUsersResp>(LIST_USERS, {
    context: { clientName: "backend" },
    fetchPolicy: "cache-first",
  });

  const [reopenApprovedSR] = useMutation<ReopenApprovedSRResp, ReopenApprovedSRInput>(
    REOPEN_APPROVED_SR,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const canReopen = useMemo<boolean>(
    () =>
      hasPermission(user, "submission_request", "reopen", application, true) &&
      application?.canBeReopened === true,
    [user, application]
  );

  const isInternalUser = useMemo<boolean>(
    () => (["Admin", "Federal Lead", "Data Commons Personnel"] as UserRole[]).includes(user?.role),
    [user?.role]
  );

  const currentOwnerOption = useMemo<UserOption | null>(() => {
    if (!application?.applicant) {
      return null;
    }

    return {
      _id: application.applicant.applicantID,
      label: application.applicant.applicantName,
    };
  }, [application?.applicant]);

  const onOpenModal = useCallback(async () => {
    if (!isInternalUser) {
      setValue("owner", currentOwnerOption);
      setConfirmOpen(true);
      return;
    }

    try {
      const { data, error } = await listUsers();
      if (error || !data?.listUsers) {
        throw new Error("Unable to retrieve users.");
      }

      let eligibleUsers: UserOption[] = data.listUsers
        .filter((u) => u.userStatus === "Active" && (u.role === "User" || u.role === "Submitter"))
        .map((u) => ({
          _id: u._id,
          label: [u.firstName, u.lastName].join(" ").trim(),
        }));

      // Make sure the current owner is always in the options list
      if (currentOwnerOption && !eligibleUsers.some((u) => u._id === currentOwnerOption._id)) {
        eligibleUsers.unshift(currentOwnerOption);
      }

      eligibleUsers =
        eligibleUsers.sort(
          (a, b) => a?.label.toLowerCase().localeCompare(b?.label.toLowerCase())
        ) || [];

      setUserOptions(eligibleUsers);

      const matchingOption =
        eligibleUsers.find((u) => u._id === currentOwnerOption?._id) || currentOwnerOption;
      setValue("owner", matchingOption);

      setConfirmOpen(true);
    } catch (err) {
      Logger.error("ReopenApplicationButton: failed to list users", err);
      enqueueSnackbar("There was an issue loading owners.", {
        variant: "error",
      });
    }
  }, [currentOwnerOption, enqueueSnackbar, isInternalUser, listUsers, setValue]);

  const onCloseDialog = useCallback(() => {
    setConfirmOpen(false);
    reset();
  }, [reset]);

  const onConfirmDialog = useCallback(async () => {
    setLoading(true);
    try {
      const ownerId =
        selectedOwner?._id !== application.applicant?.applicantID ? selectedOwner?._id : undefined;

      const { data: d, errors } = await reopenApprovedSR({
        variables: { id: application._id, ownerId },
      });

      if (errors || !d?.reopenApprovedSubmissionRequest?._id) {
        throw new Error();
      }

      setConfirmOpen(false);
      enqueueSnackbar(
        "The Submission Request has been reopened and sent back to the user for editing.",
        {
          variant: "success",
        }
      );
      onComplete?.();
    } catch (err) {
      Logger.error("ReopenApplicationButton: API error received", err);
      enqueueSnackbar("There was an issue while trying to reopen the Submission Request.", {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [
    selectedOwner,
    application._id,
    application.applicant?.applicantID,
    reopenApprovedSR,
    onComplete,
    enqueueSnackbar,
  ]);

  if (!canReopen) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        title="Reopen submission request for editing"
        placement="top"
        aria-label="Reopen action tooltip"
        data-testid="reopen-application-tooltip"
        disableInteractive
        arrow
      >
        <span>
          <StyledActionButton
            onClick={onOpenModal}
            disabled={loading || disabled}
            aria-label="Reopen submission request"
            data-testid="reopen-application-button"
            disableRipple
            {...rest}
          >
            Reopen
          </StyledActionButton>
        </span>
      </StyledTooltip>
      <DeleteDialog
        open={confirmOpen}
        header="Reopen Submission Request"
        headerProps={{ sx: { color: "#1873BD" } }}
        PaperProps={{
          "aria-labelledby": "",
          "aria-label": "Reopen Submission Request",
        }}
        closeText="Cancel"
        onClose={onCloseDialog}
        confirmText="Confirm"
        onConfirm={onConfirmDialog}
        confirmButtonProps={{
          disabled: loading || (isInternalUser && !selectedOwner),
          color: "success",
        }}
        scroll="body"
        description={
          <div>
            <StyledDescriptionText>
              Reopen an Approved Submission Request for Editing
            </StyledDescriptionText>
            <StyledFormBox>
              <Stack gap="20px">
                <Stack direction="column" alignItems="flex-start">
                  <StyledFieldLabel>Study</StyledFieldLabel>
                  <Controller
                    name="study"
                    control={control}
                    render={({ field }) => (
                      <StyledOutlinedInput
                        {...field}
                        data-testid="reopen-dialog-study"
                        fullWidth
                        readOnly
                      />
                    )}
                  />
                </Stack>

                <Stack direction="column" alignItems="flex-start">
                  <StyledFieldLabel>Program</StyledFieldLabel>
                  <Controller
                    name="program"
                    control={control}
                    render={({ field }) => (
                      <StyledOutlinedInput
                        {...field}
                        data-testid="reopen-dialog-program"
                        fullWidth
                        readOnly
                      />
                    )}
                  />
                </Stack>

                {isInternalUser && (
                  <Stack direction="column" alignItems="flex-start">
                    <StyledFieldLabel>Owner</StyledFieldLabel>
                    <Controller
                      name="owner"
                      control={control}
                      render={({ field }) => (
                        <StyledAutocomplete
                          data-testid="reopen-dialog-owner-autocomplete"
                          disablePortal={false}
                          options={userOptions}
                          value={field.value}
                          onChange={(_event, newValue: UserOption) => field.onChange(newValue)}
                          getOptionLabel={(option: UserOption) => option?.label || ""}
                          isOptionEqualToValue={(option: UserOption, value: UserOption) =>
                            option?._id === value?._id
                          }
                          renderOption={(props, option: UserOption) => (
                            <li {...props} key={option._id}>
                              {option.label}
                            </li>
                          )}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Search for a user..."
                              size="small"
                            />
                          )}
                          fullWidth
                          disableClearable
                        />
                      )}
                    />
                  </Stack>
                )}
              </Stack>
            </StyledFormBox>
          </div>
        }
      />
    </>
  );
};

export default memo<Props>(ReopenApplicationButton, isEqual);
