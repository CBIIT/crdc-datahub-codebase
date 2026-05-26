import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Button, ButtonProps, Stack, styled, TextField, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { hasPermission } from "../../config/AuthPermissions";
import {
  LIST_USERS,
  ListUsersResp,
  REOPEN_APP,
  ReopenAppInput,
  ReopenAppResp,
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
  width: "100px",
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
  marginTop: "18.5px",
});

const StyledFieldLabel = styled(Typography)({
  marginBottom: "4px",
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
      study: application?.studyAbbreviation || "NA",
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

  const [reopenApp] = useMutation<ReopenAppResp, ReopenAppInput>(REOPEN_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const canReopen = useMemo<boolean>(
    () => hasPermission(user, "submission_request", "reopen", application),
    [user, application]
  );

  const isLatestApproved = useMemo<boolean>(
    () => application?.status === "Approved" && !application?.nextRevisionID,
    [application?.status, application?.nextRevisionID]
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

  const onClickIcon = useCallback(async () => {
    const { data } = await listUsers();
    const eligibleUsers: UserOption[] = [];

    if (data?.listUsers) {
      data.listUsers
        .filter((u) => u.userStatus === "Active" && (u.role === "User" || u.role === "Submitter"))
        .forEach((u) => {
          eligibleUsers.push({
            _id: u._id,
            label: `${u.firstName} ${u.lastName ?? ""}`.trim(),
          });
        });
    }

    // Make sure the current owner is always in the options list
    if (currentOwnerOption && !eligibleUsers.some((u) => u._id === currentOwnerOption._id)) {
      eligibleUsers.unshift(currentOwnerOption);
    }

    setUserOptions(eligibleUsers);

    const matchingOption =
      eligibleUsers.find((u) => u._id === currentOwnerOption?._id) || currentOwnerOption;
    setValue("owner", matchingOption);

    setConfirmOpen(true);
  }, [currentOwnerOption, listUsers, setValue]);

  const onCloseDialog = useCallback(() => {
    setConfirmOpen(false);
    reset();
  }, [reset]);

  const onConfirmDialog = useCallback(async () => {
    setLoading(true);
    try {
      const assignee =
        selectedOwner?._id !== application.applicant?.applicantID ? selectedOwner?._id : undefined;

      const { data: d, errors } = await reopenApp({
        variables: { id: application._id, assignee },
      });

      if (errors || !d?.reopenApplication?._id) {
        throw new Error();
      }

      setConfirmOpen(false);
      // TODO: Confirm message text
      enqueueSnackbar("Submission Request has been successfully reopened.", {
        variant: "success",
      });
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
    reopenApp,
    onComplete,
    enqueueSnackbar,
  ]);

  if (!canReopen || !isLatestApproved) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        title="Reopen this submission request"
        placement="top"
        aria-label="Reopen action tooltip"
        data-testid="reopen-application-tooltip"
        disableInteractive
        arrow
      >
        <span>
          <StyledActionButton
            onClick={onClickIcon}
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
        PaperProps={{
          "aria-labelledby": "",
          "aria-label": "Reopen Submission Request",
        }}
        closeText="Cancel"
        onClose={onCloseDialog}
        confirmText="Confirm"
        onConfirm={onConfirmDialog}
        confirmButtonProps={{ disabled: loading || !selectedOwner }}
        scroll="body"
        description={
          <div>
            Reopen the submission request will send it back to the users to make changes.
            <StyledFormBox>
              <Stack gap="12px">
                <Stack direction="column" alignItems="flex-start">
                  <StyledFieldLabel>Study</StyledFieldLabel>
                  <Controller
                    name="study"
                    control={control}
                    render={({ field }) => (
                      <StyledOutlinedInput {...field} data-testid="reopen-dialog-study" fullWidth />
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
                      />
                    )}
                  />
                </Stack>

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
                        getOptionLabel={(option: UserOption) => option.label}
                        isOptionEqualToValue={(option: UserOption, value: UserOption) =>
                          option?._id === value?._id
                        }
                        renderInput={(params) => (
                          <TextField {...params} placeholder="Search for a user..." size="small" />
                        )}
                        fullWidth
                        disableClearable
                      />
                    )}
                  />
                </Stack>
              </Stack>
            </StyledFormBox>
          </div>
        }
      />
    </>
  );
};

export default memo<Props>(ReopenApplicationButton, isEqual);
