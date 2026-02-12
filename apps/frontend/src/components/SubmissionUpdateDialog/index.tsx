import { useMutation } from "@apollo/client";
import { IconButton, IconButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { FC, memo, useCallback, useMemo, useState } from "react";

import { useAuthContext } from "@/components/Contexts/AuthContext";
import { useSubmissionContext } from "@/components/Contexts/SubmissionContext";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import { hasPermission } from "@/config/AuthPermissions";
import {
  UPDATE_SUBMISSION_INFO,
  UpdateSubmissionInfoInput,
  UpdateSubmissionInfoResp,
} from "@/graphql";
import { Logger } from "@/utils";

import FormDialog, { InputForm } from "./FormDialog";

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledIconButton = styled(IconButton)(({ disabled }) => ({
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  padding: "0px",
  margin: "0px",
}));

/**
 * The statuses of the Data Submission that qualify for updating
 */
const ENABLED_STATUSES: SubmissionStatus[] = ["New", "In Progress", "Rejected", "Withdrawn"];

type Props = {
  /**
   * The icon to display in the button
   */
  icon: React.ReactNode;
} & Omit<IconButtonProps, "onClick">;

/**
 * Provides functionality to adjust the Data Model Version of a data submission.
 *
 * This component will handle the following:
 * - Visibility of the button based on permissions
 * - Changing the Data Model Version
 * - Updating the local cache state
 *
 * @returns The SubmissionUpdate component
 */
const SubmissionUpdate: FC<Props> = ({ icon, disabled, ...rest }: Props) => {
  const { data, updateQuery } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const { _id, status } = data?.getSubmission || {};

  const [updateSubmission] = useMutation<UpdateSubmissionInfoResp, UpdateSubmissionInfoInput>(
    UPDATE_SUBMISSION_INFO,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const canSeeButton = useMemo<boolean>(
    () => hasPermission(user, "data_submission", "review", data?.getSubmission, false),
    [user, data?.getSubmission]
  );

  const isDisabled = useMemo<boolean>(
    () => !ENABLED_STATUSES.includes(status) || disabled,
    [status, disabled]
  );

  const onClickIcon = async () => {
    setConfirmOpen(true);
  };

  const onCloseDialog = async () => {
    setConfirmOpen(false);
  };

  const onConfirmDialog = useCallback(
    async ({ version, submitterID }: InputForm) => {
      setLoading(true);
      try {
        const { data: d, errors } = await updateSubmission({
          variables: { _id, version, submitterID },
        });

        if (errors || !d?.updateSubmissionInfo?._id) {
          throw new Error(errors?.[0]?.message || "Unknown API error");
        }

        updateQuery((prev) => {
          const newData = { ...prev };

          // Update submitter information if changed
          if (newData?.getSubmission?.submitterID !== submitterID) {
            newData.getSubmission = {
              ...newData.getSubmission,
              submitterID: d.updateSubmissionInfo.submitterID,
              submitterName: d.updateSubmissionInfo.submitterName,
            };
          }

          // Update model version if changed
          if (newData?.getSubmission?.modelVersion !== version) {
            newData.getSubmission = {
              ...newData.getSubmission,
              modelVersion: d.updateSubmissionInfo.modelVersion,
              metadataValidationStatus: "New",
              fileValidationStatus: "New",
            };
            newData.submissionStats = {
              ...prev.submissionStats,
              stats: prev.submissionStats?.stats?.map((stat) => ({
                ...stat,
                new: stat?.total || 0,
                error: 0,
                passed: 0,
                warning: 0,
              })),
            };
          }

          return newData;
        });

        enqueueSnackbar("Changes applied successfully to the submission.", { variant: "default" });
      } catch (err) {
        Logger.error("SubmissionUpdate: Received the following error", err);
        enqueueSnackbar(err.message, { variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [_id, updateSubmission, enqueueSnackbar, updateQuery]
  );

  if (!canSeeButton) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        title="Changes are not allowed in the current submission state."
        placement="top"
        aria-label="Update submission button tooltip"
        data-testid="update-submission-tooltip"
        disableHoverListener={!isDisabled}
        disableInteractive
        arrow
      >
        <span>
          <StyledIconButton
            onClick={onClickIcon}
            disabled={loading || isDisabled}
            aria-label="Update submission button"
            data-testid="update-submission-button"
            disableRipple
            {...rest}
          >
            {icon}
          </StyledIconButton>
        </span>
      </StyledTooltip>
      <FormDialog open={confirmOpen} onSubmitForm={onConfirmDialog} onClose={onCloseDialog} />
    </>
  );
};

export default memo<Props>(SubmissionUpdate, isEqual);
