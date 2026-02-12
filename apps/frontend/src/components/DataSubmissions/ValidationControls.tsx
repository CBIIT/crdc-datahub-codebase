import { useMutation } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import {
  FormControlLabel,
  RadioGroup,
  Stack,
  TooltipProps,
  Typography,
  styled,
} from "@mui/material";
import { useSnackbar } from "notistack";
import React, { FC, ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { hasPermission } from "../../config/AuthPermissions";
import { TOOLTIP_TEXT } from "../../config/DashboardTooltips";
import {
  VALIDATE_SUBMISSION,
  ValidateSubmissionInput,
  ValidateSubmissionResp,
} from "../../graphql";
import {
  getDefaultValidationTarget,
  getDefaultValidationType,
  getValidationTypes,
} from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import StyledRadioButton from "../Questionnaire/StyledRadioButton";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

import { CrossValidationButton } from "./CrossValidationButton";
import FlowWrapper from "./FlowWrapper";
import { ValidationStatus } from "./ValidationStatus";

const StyledValidateButton = styled(LoadingButton)({
  padding: "10px",
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "24px",
  letterSpacing: "0.32px",
  "&.MuiButtonBase-root": {
    marginLeft: "auto",
    minWidth: "137px",
  },
});

const StyledRow = styled(Stack)({
  fontFamily: "Nunito",
});

const StyledRowTitle = styled(Typography)({
  fontWeight: 700,
  fontSize: "16px",
  color: "#083A50",
  minWidth: "170px",
});

const StyledRowContent = styled(Stack)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  width: "650px",
});

const StyledRadioControl = styled(FormControlLabel)({
  fontFamily: "Nunito",
  fontSize: "16px",
  fontWeight: "500",
  lineHeight: "20px",
  textAlign: "left",
  color: "#083A50",
  minWidth: "230px",
  "&:last-child": {
    marginRight: "0px",
    minWidth: "unset",
  },
});

/**
 * A map from Submission Status to the user roles that can validate the submission for that status.
 *
 * @note All of the permission logic really should be refactored into a hook or otherwise.
 */
const ValidateMap: Partial<
  Record<Submission["status"], (user: User, submission: Submission) => boolean>
> = {
  "In Progress": (user: User, submission: Submission) =>
    hasPermission(user, "data_submission", "create", submission) ||
    hasPermission(user, "data_submission", "review", submission),
  Withdrawn: (user: User, submission: Submission) =>
    hasPermission(user, "data_submission", "create", submission) ||
    hasPermission(user, "data_submission", "review", submission),
  Rejected: (user: User, submission: Submission) =>
    hasPermission(user, "data_submission", "create", submission) ||
    hasPermission(user, "data_submission", "review", submission),
  Submitted: (user: User, submission: Submission) =>
    hasPermission(user, "data_submission", "review", submission),
};

const CustomTooltip = (props: TooltipProps) => (
  <StyledTooltip
    {...props}
    slotProps={{
      popper: {
        modifiers: [
          {
            name: "offset",
            options: {
              offset: [0, -14],
            },
          },
        ],
      },
    }}
  />
);

/**
 * Provides the UI for validating a data submission's assets.
 *
 * @returns {React.FC}
 */
const ValidationControls: FC = () => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const { data, updateQuery, refetch } = useSubmissionContext();
  const { getSubmission: dataSubmission } = data || {};

  const [validationType, setValidationType] = useState<ValidationType | "All">(null);
  const [uploadType, setUploadType] = useState<ValidationTarget>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isValidating = useMemo<boolean>(
    () =>
      dataSubmission?.fileValidationStatus === "Validating" ||
      dataSubmission?.metadataValidationStatus === "Validating",
    [dataSubmission?.fileValidationStatus, dataSubmission?.metadataValidationStatus]
  );
  const prevIsValidating = useRef<boolean>(isValidating);

  const canValidateMetadata: boolean = useMemo(() => {
    const hasPermission = ValidateMap[dataSubmission?.status]
      ? ValidateMap[dataSubmission?.status](user, dataSubmission)
      : null;
    if (!user?.role || !dataSubmission?.status || hasPermission === null) {
      return false;
    }
    if (hasPermission === false) {
      return false;
    }

    return dataSubmission?.metadataValidationStatus !== null;
  }, [user, dataSubmission]);

  const canValidateFiles: boolean = useMemo(() => {
    const hasPermission = ValidateMap[dataSubmission?.status]
      ? ValidateMap[dataSubmission?.status](user, dataSubmission)
      : null;
    if (!user?.role || !dataSubmission?.status || hasPermission === null) {
      return false;
    }
    if (hasPermission === false) {
      return false;
    }
    if (dataSubmission.intention === "Delete" || dataSubmission.dataType === "Metadata Only") {
      return false;
    }

    return dataSubmission?.fileValidationStatus !== null;
  }, [user, dataSubmission]);

  const [validateSubmission] = useMutation<ValidateSubmissionResp, ValidateSubmissionInput>(
    VALIDATE_SUBMISSION,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const handleValidateFiles = async () => {
    if (isValidating || !validationType || !uploadType) {
      return;
    }
    if (!canValidateFiles && validationType === "file") {
      return;
    }
    if (!canValidateMetadata && validationType === "metadata") {
      return;
    }

    setIsLoading(true);

    const { data, errors } = await validateSubmission({
      variables: {
        _id: dataSubmission?._id,
        types: getValidationTypes(validationType),
        scope: uploadType,
      },
    }).catch((e) => ({ errors: e?.message, data: null }));

    if (errors || !data?.validateSubmission?.success) {
      enqueueSnackbar("Unable to initiate validation process.", {
        variant: "error",
      });
    } else {
      enqueueSnackbar(
        "Validation process is starting; this may take some time. Please wait before initiating another validation.",
        { variant: "success" }
      );
      handleOnValidate();
    }

    setIsLoading(false);
  };

  const handleOnValidate = () => {
    // NOTE: This forces the UI to rerender with the new statuses immediately
    const types = getValidationTypes(validationType);
    updateQuery((prev) => ({
      ...prev,
      getSubmission: {
        ...prev.getSubmission,
        fileValidationStatus: types?.includes("file")
          ? "Validating"
          : prev?.getSubmission?.fileValidationStatus,
        metadataValidationStatus: types?.includes("metadata")
          ? "Validating"
          : prev?.getSubmission?.metadataValidationStatus,
        validationStarted: new Date().toISOString(),
        validationEnded: null,
        validationType: types,
        validationScope: uploadType,
      },
    }));

    // Kick off polling to check for validation status change
    // NOTE: We're waiting 1000ms to allow the cache to update
    setTimeout(refetch, 1000);
  };

  const Actions: ReactElement = useMemo(
    () => (
      <>
        <StyledValidateButton
          variant="contained"
          color="info"
          disabled={(!canValidateFiles && !canValidateMetadata) || isValidating}
          loading={isLoading}
          onClick={handleValidateFiles}
          data-testid="validate-controls-validate-button"
        >
          {isValidating ? "Validating..." : "Validate"}
        </StyledValidateButton>
        <CrossValidationButton submission={dataSubmission} variant="contained" color="info" />
      </>
    ),
    [
      handleValidateFiles,
      dataSubmission,
      canValidateFiles,
      canValidateMetadata,
      isValidating,
      isLoading,
    ]
  );

  useEffect(() => {
    const isValidating =
      dataSubmission?.fileValidationStatus === "Validating" ||
      dataSubmission?.metadataValidationStatus === "Validating";

    // Reset the validation type and target only if the validation process finished
    if (!isValidating && prevIsValidating.current === true) {
      setValidationType(getDefaultValidationType(dataSubmission, user));
      setUploadType(getDefaultValidationTarget(dataSubmission, user));
    }

    prevIsValidating.current = isValidating;
  }, [dataSubmission?.fileValidationStatus, dataSubmission?.metadataValidationStatus]);

  useEffect(() => {
    if (typeof dataSubmission === "undefined") {
      return;
    }
    if (validationType === null) {
      setValidationType(getDefaultValidationType(dataSubmission, user));
    }
    if (uploadType === null) {
      setUploadType(getDefaultValidationTarget(dataSubmission, user));
    }
  }, [dataSubmission, user]);

  return (
    <FlowWrapper
      index={3}
      titleContainerSx={{ marginBottom: "4px", columnGap: "12px" }}
      title="Validate Data"
      titleAdornment={<ValidationStatus />}
      actions={Actions}
      last
    >
      <>
        <StyledRow direction="row" alignItems="center" sx={{ marginBottom: "-5px" }}>
          <StyledRowTitle>Validation Type:</StyledRowTitle>
          <StyledRowContent>
            <RadioGroup
              value={validationType}
              onChange={(e, val: ValidationType) => setValidationType(val)}
              data-testid="validate-controls-validation-type"
              row
            >
              <CustomTooltip
                placement="bottom"
                title={TOOLTIP_TEXT.VALIDATION_CONTROLS.VALIDATION_TYPE.VALIDATE_METADATA}
                open={undefined} // will use hoverListener to open
                disableHoverListener={false}
              >
                <StyledRadioControl
                  value="metadata"
                  control={<StyledRadioButton readOnly={false} />}
                  label="Validate Metadata"
                  disabled={!canValidateMetadata}
                />
              </CustomTooltip>
              <CustomTooltip
                placement="bottom"
                title={TOOLTIP_TEXT.VALIDATION_CONTROLS.VALIDATION_TYPE.VALIDATE_DATA_FILES}
                open={undefined} // will use hoverListener to open
                disableHoverListener={false}
              >
                <StyledRadioControl
                  value="file"
                  control={<StyledRadioButton readOnly={false} />}
                  label="Validate Data Files"
                  disabled={!canValidateFiles}
                />
              </CustomTooltip>
              <CustomTooltip
                placement="bottom"
                title={TOOLTIP_TEXT.VALIDATION_CONTROLS.VALIDATION_TYPE.VALIDATE_BOTH}
                open={undefined} // will use hoverListener to open
                disableHoverListener={false}
              >
                <StyledRadioControl
                  value="All"
                  control={<StyledRadioButton readOnly={false} />}
                  label="Both"
                  disabled={!canValidateFiles || !canValidateMetadata}
                />
              </CustomTooltip>
            </RadioGroup>
          </StyledRowContent>
        </StyledRow>
        <StyledRow direction="row" alignItems="center" sx={{ marginTop: "-5px" }}>
          <StyledRowTitle>Validation Target:</StyledRowTitle>
          <StyledRowContent>
            <RadioGroup
              value={uploadType}
              onChange={(event, val: ValidationTarget) => setUploadType(val)}
              data-testid="validate-controls-validation-target"
              row
            >
              <CustomTooltip
                placement="bottom"
                title={TOOLTIP_TEXT.VALIDATION_CONTROLS.VALIDATION_TARGET.NEW_UPLOADED_DATA}
                open={undefined} // will use hoverListener to open
                disableHoverListener={false}
              >
                <StyledRadioControl
                  value="New"
                  control={<StyledRadioButton readOnly={false} />}
                  label="New Uploaded Data"
                  disabled={
                    (!canValidateFiles && !canValidateMetadata) ||
                    // NOTE: No new data to validate if the submission is already submitted
                    dataSubmission?.status === "Submitted"
                  }
                />
              </CustomTooltip>
              <CustomTooltip
                placement="bottom"
                title={TOOLTIP_TEXT.VALIDATION_CONTROLS.VALIDATION_TARGET.ALL_UPLOADED_DATA}
                open={undefined} // will use hoverListener to open
                disableHoverListener={false}
              >
                <StyledRadioControl
                  value="All"
                  control={<StyledRadioButton readOnly={false} />}
                  label="All Uploaded Data"
                  disabled={!canValidateFiles && !canValidateMetadata}
                />
              </CustomTooltip>
            </RadioGroup>
          </StyledRowContent>
        </StyledRow>
      </>
    </FlowWrapper>
  );
};

export default React.memo(ValidationControls);
