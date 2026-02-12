import { useMutation } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import { ButtonProps, styled } from "@mui/material";
import { useSnackbar } from "notistack";
import { FC, useEffect, useState } from "react";

import { hasPermission } from "../../config/AuthPermissions";
import {
  VALIDATE_SUBMISSION,
  ValidateSubmissionInput,
  ValidateSubmissionResp,
} from "../../graphql";
import { safeParse } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";

const StyledValidateButton = styled(LoadingButton)({
  padding: "10px",
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "24px",
  letterSpacing: "0.32px",
  marginTop: "8px",
  "&.MuiButtonBase-root": {
    minWidth: "137px",
  },
});

export type Props = {
  /**
   * The full Data Submission object to initiate cross validation on.
   *
   * @deprecated This prop is deprecated. Use `useSubmissionContext` instead.
   */
  submission: Submission;
} & Omit<ButtonProps, "onClick">;

/**
 * Handles initiating cross validation on a submission.
 *
 * This component manages the following:
 * - Who can see the button
 * - When to disable the button
 *
 * @returns {React.FC<Props>}
 */
export const CrossValidationButton: FC<Props> = ({ submission, ...props }) => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const { updateQuery, refetch } = useSubmissionContext();

  const { _id, status, crossSubmissionStatus, otherSubmissions } = submission || {};
  const parsedSubmissions = safeParse<OtherSubmissions>(otherSubmissions);
  const hasOtherSubmissions =
    parsedSubmissions?.Submitted?.length > 0 || parsedSubmissions?.Released?.length > 0;

  const [loading, setLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(crossSubmissionStatus === "Validating");

  const [validateSubmission] = useMutation<ValidateSubmissionResp, ValidateSubmissionInput>(
    VALIDATE_SUBMISSION,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const handleClick = async () => {
    setLoading(true);

    try {
      const { data, errors } = await validateSubmission({
        variables: {
          _id,
          types: ["cross-submission"],
          scope: "All",
        },
      });

      if (errors || !data?.validateSubmission?.success) {
        throw new Error("Unable to initiate validation process.");
      }

      enqueueSnackbar(
        "Validation process is starting; this may take some time. Please wait before initiating another validation.",
        { variant: "success" }
      );
      setIsValidating(true);
      handleOnValidate();
    } catch (error) {
      enqueueSnackbar("Unable to initiate validation process.", {
        variant: "error",
      });
      setIsValidating(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOnValidate = () => {
    // NOTE: This forces the UI to rerender with the new statuses immediately
    updateQuery((prev) => ({
      ...prev,
      getSubmission: {
        ...prev.getSubmission,
        crossSubmissionStatus: "Validating",
      },
    }));

    // Kick off polling to check for validation status change
    // NOTE: We're waiting 1000ms to allow the cache to update
    setTimeout(refetch, 1000);
  };

  useEffect(() => {
    setIsValidating(crossSubmissionStatus === "Validating");
  }, [crossSubmissionStatus]);

  if (
    !hasPermission(user, "data_submission", "review", submission) ||
    !hasOtherSubmissions ||
    status !== "Submitted"
  ) {
    return null;
  }

  return (
    <StyledValidateButton
      onClick={handleClick}
      loading={loading}
      disabled={isValidating || status !== "Submitted" || props.disabled}
      data-testid="cross-validate-button"
      {...props}
    >
      {isValidating ? "Validating..." : "Cross Validate"}
    </StyledValidateButton>
  );
};
