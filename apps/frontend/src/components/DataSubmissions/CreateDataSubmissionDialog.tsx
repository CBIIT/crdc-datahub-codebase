import { useMutation, useQuery } from "@apollo/client";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import { FC, useEffect, useMemo, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import BellIcon from "../../assets/icons/filled_bell_icon.svg?react";
import { hasPermission } from "../../config/AuthPermissions";
import { RequiresStudiesAssigned } from "../../config/AuthRoles";
import { DataCommons } from "../../config/DataCommons";
import {
  CREATE_SUBMISSION,
  CreateSubmissionResp,
  CreateSubmissionInput,
  ListApprovedStudiesResp,
  ListApprovedStudiesInput,
  LIST_APPROVED_STUDIES,
} from "../../graphql";
import { Logger, formatFullStudyName, validateEmoji } from "../../utils";
import { Status as AuthStatus, useAuthContext } from "../Contexts/AuthContext";
import StyledAsterisk from "../StyledFormComponents/StyledAsterisk";
import BaseStyledHelperText from "../StyledFormComponents/StyledHelperText";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../StyledFormComponents/StyledSelect";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";
import TooltipList from "../SummaryList/TooltipList";
import Tooltip from "../Tooltip";

import RadioInput, { RadioOption } from "./RadioInput";

const CreateSubmissionDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    width: "725px",
    height: "fit-content",
    borderRadius: "8px",
    border: "2px solid #5ab8ff",
    background: "#f2f6fa",
    maxWidth: "none",
    maxHeight: "none",
    overflow: "hidden",
  },
});

const StyledDialogTitle = styled(DialogTitle)({
  paddingTop: "39px",
  paddingLeft: "74px",
});

const StyledHeader = styled(Typography)({
  fontFamily: "'Nunito Sans'",
  fontSize: "45px",
  fontWeight: 800,
  lineHeight: "40px",
  letterSpacing: "-1.5px",
  textAlign: "left",
  color: "#1873bd",
  minHeight: "79px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
});

const StyledSubHeader = styled(Typography)({
  fontFamily: "'Inter', 'Rubik', sans-serif",
  fontSize: "16px",
  fontWeight: 400,
  lineHeight: "22px",
  letterSpacing: 0,
  textAlign: "left",
});

const StyledDialogContent = styled(DialogContent)({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  paddingBottom: "1px",
});

const StyledButton = styled(Button)({
  height: "51px",
  width: "261px",
  padding: "14px 20px",
  fontWeight: 700,
  fontSize: "16px",
  letterSpacing: "2%",
  lineHeight: "20.14px",
  borderRadius: "8px",
  color: "#fff",
  textTransform: "none",
  borderColor: "#005EA2 !important",
  background: "#005EA2 !important",
  marginRight: "25px",

  "&.Mui-disabled": {
    cursor: "not-allowed",
    pointerEvents: "all",
  },
});

const StyledDialogActions = styled(DialogActions)({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  paddingBottom: "65px",
});

const StyledDialogError = styled(Typography)({
  color: "#c93f08",
  textAlign: "center",
  marginTop: "25px",
});

const StyledDialogButton = styled(Button)({
  display: "flex",
  width: "128px",
  height: "50.59px",
  padding: "12px 36.5px 14.59px 36.5px",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "8px",
  border: "1px solid #000",
  textDecoration: "none",
  color: "rgba(0, 0, 0, 0.87)",
  alignSelf: "center",
  cursor: "pointer",
  textTransform: "none",
  letterSpacing: "2%",
  fontWeight: 700,
  fontSize: "16px",
});

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute !important" as "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledFormStack = styled(Stack)<{ component: React.ElementType }>({
  width: "485px",
  marginTop: "24px",
});

const StyledRadioInput = styled(RadioInput)(() => ({
  marginLeft: "2px",
  marginTop: "5px",
  "& .MuiRadio-root": {
    padding: "4px 7px 4px 4px",
  },
  "& .MuiFormControlLabel-root": {
    marginRight: "0 !important",
    paddingRight: "10px !important",
  },
}));

const StyledField = styled("div")({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  flexDirection: "column",
  position: "relative",
});

const StyledHelperText = styled(BaseStyledHelperText)({
  marginTop: "5px",
});

const StyledOutlinedInputMultiline = styled(StyledOutlinedInput)({
  height: "96px",
  alignItems: "flex-start",
});

const StyledTooltipWrapper = styled(Stack)({
  position: "relative",
  bottom: "30px",
  right: "50px",
});

const StyledBellIcon = styled(BellIcon)({
  width: "18px",
  position: "absolute",
  right: "-28px",
  color: "#C94313",
});

const TOOLTIPS = {
  pendingModelChange:
    "The CRDC team is reviewing the data requirements of this study for potential data model changes. Data submissions cannot be created until any required model updates are released.",
  pendingGPA: "Data submissions cannot be created until the required GPA updates are provided.",
};

type Props = {
  onCreate: () => void;
};

const CreateDataSubmissionDialog: FC<Props> = ({ onCreate }) => {
  const { user, status: authStatus } = useAuthContext();
  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { isSubmitting, errors },
    setValue,
    reset,
  } = useForm<CreateSubmissionInput>({
    defaultValues: {
      dataCommons: "CDS",
      studyID: "",
      intention: "New/Update",
      dataType: "Metadata and Data Files",
      name: "",
    },
  });

  const [creatingSubmission, setCreatingSubmission] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [isDbGapRequired, setIsDbGapRequired] = useState<boolean>(false);
  const [dbGaPID, setDbGaPID] = useState<string>("");
  const [selectMinWidth, setSelectMinWidth] = useState<number | null>(null);
  const [intention, studyID] = watch(["intention", "studyID"]);

  const shouldFetchAllStudies = useMemo<boolean>(
    () =>
      creatingSubmission &&
      (!RequiresStudiesAssigned.includes(user?.role) ||
        (user?.studies || [])?.findIndex((s) => s?._id === "All") !== -1),
    [creatingSubmission, user?.role, user?.studies]
  );

  const [createDataSubmission] = useMutation<CreateSubmissionResp, CreateSubmissionInput>(
    CREATE_SUBMISSION,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const { data: allStudies } = useQuery<ListApprovedStudiesResp, ListApprovedStudiesInput>(
    LIST_APPROVED_STUDIES,
    {
      variables: { first: -1, orderBy: "studyAbbreviation", sortDirection: "asc" },
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
      skip: !shouldFetchAllStudies,
    }
  );

  const studies = useMemo<User["studies"]>(() => {
    if (shouldFetchAllStudies) {
      return allStudies?.listApprovedStudies?.studies || [];
    }

    return (
      user?.studies?.sort((a, b) => a?.studyAbbreviation?.localeCompare(b?.studyAbbreviation)) || []
    );
  }, [shouldFetchAllStudies, allStudies, user?.studies]);

  const studyPendingConditions = useMemo<string[]>(() => {
    if (!studyID) {
      return [];
    }

    const mappedStudy = studies?.find((s) => s?._id === studyID);

    const conditions = [];
    if (mappedStudy?.pendingModelChange) {
      conditions.push(TOOLTIPS.pendingModelChange);
    }
    if (mappedStudy?.isPendingGPA) {
      conditions.push(TOOLTIPS.pendingGPA);
    }
    return conditions;
  }, [studyID, studies]);

  const submissionTypeOptions: RadioOption[] = [
    {
      label: "New/Update",
      value: "New/Update",
      disabled: false,
      tooltipContent:
        "Select this option to add new data or update existing data in the destination data commons.",
    },
    {
      label: "Delete",
      value: "Delete",
      disabled: false,
      optionSx: {
        marginLeft: "74.5px",
      },
      tooltipContent:
        "Select this option if you want to delete existing data from the destination data commons.",
    },
  ];

  const submissionDataTypeOptions: RadioOption[] = [
    {
      label: "Metadata and Data Files",
      value: "Metadata and Data Files",
      disabled: intention === "Delete",
      optionSx: {
        marginLeft: "38.2px",
      },
      tooltipContent:
        "Select this option to create a submission that includes both metadata and data files.",
    },
    {
      label: "Metadata Only",
      value: "Metadata Only",
      disabled: false,
      tooltipContent:
        "Select this option to create a metadata-only submission. In this case, uploading data files is not permitted.",
    },
  ];

  const handleOpenDialog = () => {
    reset();
    setCreatingSubmission(true);
  };

  const onSubmit: SubmitHandler<CreateSubmissionInput> = async (input) => {
    if (studyPendingConditions?.length > 0) {
      return;
    }

    const { data, errors } = await createDataSubmission({
      variables: { ...input },
    }).catch((e) => {
      setError(true);
      Logger.error("Error creating submission", e);
      return { data: null, errors: e };
    });

    if (errors || !data?.createSubmission) {
      setError(true);
      return;
    }

    reset();
    setCreatingSubmission(false);
    setError(false);
    onCreate();
  };

  const validateEmpty = (value: string): string | null =>
    !value?.trim() ? "This field is required" : null;

  useEffect(() => {
    if (intention === "New/Update") {
      setValue("dataType", "Metadata and Data Files");
    }
    if (intention === "Delete") {
      setValue("dataType", "Metadata Only");
    }
  }, [intention]);

  useEffect(() => {
    const studyID = watch("studyID");
    const mappedStudy = studies?.find((s) => s?._id === studyID);

    if (!studyID || !mappedStudy) {
      setDbGaPID("");
      setIsDbGapRequired(false);
      return;
    }

    setDbGaPID(mappedStudy.dbGaPID || "");
    setIsDbGapRequired(mappedStudy.controlledAccess);
  }, [watch("studyID"), studies]);

  return (
    <>
      <CreateSubmissionDialog
        open={creatingSubmission}
        scroll="body"
        data-testid="create-submission-dialog"
      >
        <StyledDialogTitle>
          <StyledCloseDialogButton
            aria-label="close"
            data-testid="create-submission-dialog-close-button"
            onClick={() => setCreatingSubmission(false)}
          >
            <CloseIconSvg />
          </StyledCloseDialogButton>
          <Stack direction="column" justifyContent="center" alignItems="flex-start">
            <StyledHeader variant="h3" id="create-a-submission-title">
              Create a Data Submission
            </StyledHeader>
            <StyledSubHeader>
              Please fill out the form below to start your data submission
            </StyledSubHeader>
          </Stack>
        </StyledDialogTitle>
        <StyledDialogContent>
          <StyledFormStack
            direction="column"
            component="form"
            id="create-submission-dialog-form"
            onSubmit={handleSubmit(onSubmit)}
          >
            <StyledField sx={{ marginRight: "-80px" }}>
              <Controller
                name="intention"
                control={control}
                rules={{ required: "This field is required" }}
                render={({ field }) => (
                  <StyledRadioInput
                    {...field}
                    id="create-data-submission-dialog-submission-type"
                    label="Submission Type"
                    value={field.value}
                    options={submissionTypeOptions}
                    data-testid="create-data-submission-dialog-submission-type-input"
                    inline
                    required
                    row
                  />
                )}
              />
            </StyledField>
            <StyledField sx={{ marginRight: "-80px" }}>
              <Controller
                name="dataType"
                control={control}
                rules={{ required: "This field is required" }}
                render={({ field }) => (
                  <StyledRadioInput
                    {...field}
                    id="create-data-submission-dialog-data-type"
                    label="Data Type"
                    value={field.value}
                    options={submissionDataTypeOptions}
                    aria-describedby="submission-data-type-helper-text"
                    data-testid="create-data-submission-dialog-data-type-input"
                    inline
                    required
                    row
                  />
                )}
              />
              <StyledHelperText id="submission-data-type-helper-text">
                {errors?.intention?.message}
              </StyledHelperText>
            </StyledField>
            <StyledField>
              <StyledLabel id="dataCommons">
                Data Commons
                <StyledAsterisk />
              </StyledLabel>
              <Controller
                name="dataCommons"
                control={control}
                rules={{ required: "This field is required" }}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    value={field.value}
                    MenuProps={{ disablePortal: true }}
                    aria-describedby="submission-data-commons-helper-text"
                    inputProps={{ "aria-labelledby": "dataCommons" }}
                    data-testid="create-data-submission-dialog-data-commons-input"
                  >
                    {DataCommons.map((dc) => (
                      <MenuItem key={dc.name} value={dc.name}>
                        {dc.displayName}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
              <StyledHelperText id="submission-data-commons-helper-text">
                {errors?.dataCommons?.message}
              </StyledHelperText>
            </StyledField>
            <StyledField>
              <StyledLabel id="study">
                Study
                <StyledAsterisk />
              </StyledLabel>
              <Controller
                name="studyID"
                control={control}
                rules={{ required: "This field is required" }}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    value={field.value || ""}
                    onOpen={(event) =>
                      setSelectMinWidth((event.currentTarget as HTMLElement)?.offsetWidth || null)
                    }
                    MenuProps={{
                      disablePortal: true,
                      sx: { width: selectMinWidth ? `${selectMinWidth}px` : "auto" },
                    }}
                    aria-describedby="submission-study-abbreviation-helper-text"
                    inputProps={{ "aria-labelledby": "study" }}
                    data-testid="create-data-submission-dialog-study-id-input"
                  >
                    {studies.map((study) => (
                      <MenuItem
                        key={study._id}
                        value={study._id}
                        data-testid={`study-option-${study._id}`}
                      >
                        {formatFullStudyName(study.studyName, study.studyAbbreviation)}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
              <StyledHelperText id="submission-study-abbreviation-helper-text">
                {errors?.studyID?.message}
              </StyledHelperText>
            </StyledField>
            <StyledField sx={{ display: isDbGapRequired ? "flex" : "none" }}>
              <StyledLabel id="dbGaPID" data-testid="dbGaP-id-label">
                dbGaP ID
                <StyledAsterisk />
              </StyledLabel>
              <Tooltip
                title="dbGaPID is required for controlled-access studies."
                open={undefined}
                disableHoverListener={false}
                placement="top"
                disableInteractive
                arrow
              >
                <StyledOutlinedInput
                  value={dbGaPID}
                  inputProps={{ "aria-labelledby": "dbGaPID" }}
                  placeholder="<Not Provided>"
                  data-testid="create-data-submission-dialog-dbgap-id-input"
                  readOnly
                />
              </Tooltip>
              {!dbGaPID && (
                <Tooltip
                  title={
                    <span>
                      Please contact{" "}
                      <a href="mailto:NCICRDC@mail.nih.gov" target="_blank" rel="noreferrer">
                        NCICRDC@mail.nih.gov
                      </a>{" "}
                      to submit your dbGaP ID once you have registered your study on dbGap.
                    </span>
                  }
                  open={undefined}
                  disableHoverListener={false}
                  placement="top"
                  arrow
                >
                  <StyledBellIcon data-testid="pending-conditions-icon" />
                </Tooltip>
              )}
              <StyledHelperText />
            </StyledField>
            <StyledField>
              <StyledLabel id="submissionName">
                Submission Name
                <StyledAsterisk />
              </StyledLabel>
              <StyledOutlinedInputMultiline
                {...register("name", {
                  maxLength: 25,
                  validate: {
                    empty: validateEmpty,
                    emoji: validateEmoji,
                  },
                })}
                rows={3}
                placeholder="25 characters allowed"
                inputProps={{ maxLength: 25, "aria-labelledby": "submissionName" }}
                aria-describedby="submission-name-helper-text"
                data-testid="create-data-submission-dialog-submission-name-input"
              />
              <StyledHelperText id="submission-name-helper-text">
                {errors?.name?.message}
              </StyledHelperText>
            </StyledField>
          </StyledFormStack>
        </StyledDialogContent>
        <StyledDialogActions>
          <StyledTooltip
            title={<TooltipList data={studyPendingConditions} />}
            placement="top"
            open={undefined}
            disableHoverListener={!studyPendingConditions?.length}
            arrow
          >
            <span>
              <StyledDialogButton
                type="submit"
                tabIndex={0}
                data-testid="create-data-submission-dialog-create-button"
                form="create-submission-dialog-form"
                disabled={
                  (isDbGapRequired && !dbGaPID) ||
                  studyPendingConditions?.length > 0 ||
                  isSubmitting
                }
              >
                Create
              </StyledDialogButton>
            </span>
          </StyledTooltip>
          {error && (
            <StyledDialogError variant="body1">
              Unable to create this data submission. If the problem persists please contact
              <br />
              <a href="mailto:ncicrdchelpdesk@mail.nih.gov">ncicrdchelpdesk@mail.nih.gov</a>
            </StyledDialogError>
          )}
        </StyledDialogActions>
      </CreateSubmissionDialog>

      {hasPermission(user, "data_submission", "create", null, true) && (
        <StyledTooltipWrapper alignItems="center" justifyContent="flex-end">
          <StyledButton
            type="button"
            variant="contained"
            onClick={handleOpenDialog}
            disabled={authStatus === AuthStatus.LOADING}
          >
            Create a Data Submission
          </StyledButton>
        </StyledTooltipWrapper>
      )}
    </>
  );
};

export default CreateDataSubmissionDialog;
