import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Backdrop,
  Box,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  styled,
  TextField,
} from "@mui/material";
import { isEqual } from "lodash";
import { memo, useCallback, useMemo, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import ClearButton from "../../components/ClearButton";
import { useSearchParamsContext } from "../../components/Contexts/SearchParamsContext";
import StyledAutocompleteFormComponent from "../../components/StyledFormComponents/StyledAutocomplete";
import StyledTextFieldFormComponent from "../../components/StyledFormComponents/StyledOutlinedInput";
import StyledSelectFormComponent from "../../components/StyledFormComponents/StyledSelect";
import Tooltip from "../../components/Tooltip";
import { ListApplicationsInput, ListApplicationsResp } from "../../graphql";
import { useDebouncedWatch } from "../../hooks/useDebouncedWatch";
import { isStringLengthBetween } from "../../utils";

export type FilterForm = Pick<
  ListApplicationsInput,
  "programName" | "studyName" | "statuses" | "submitterName"
>;

export type FilterProps = {
  applicationData: ListApplicationsResp["listApplications"];
  onChange?: (data: FilterForm) => void;
};

const StyledContainer = styled(Box)({
  padding: "15px 32px 15px 32px",
});

const StyledFormControl = styled(FormControl)({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: "5px",
});

const StyledInlineLabel = styled("label")({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "16px",
  textAlign: "right",
});

const StyledSelect = styled(StyledSelectFormComponent)({
  width: "298.25px",
});

const StyledTextField = styled(StyledTextFieldFormComponent)({
  width: "298.25px",
});

const StyledAutocomplete = styled(StyledAutocompleteFormComponent)({
  width: "298.25px",
});

const StyledRefreshIcon = styled(RefreshIcon)({
  transform: "scale(-1, 1)",
  color: "#346798",
  fontSize: "31px",
});

const StyledActionWrapper = styled(Box)({
  minWidth: "31px",
  width: "100%",
  height: "44px",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
});

const ActionButtonsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "100%",
  gap: "9px",
  paddingTop: "21px",
});

const StyledIconButton = styled(IconButton)({
  padding: 0,
  border: "1px solid #D0D0D0",
  borderRadius: "5px",
});

type FilterFormKey = keyof FilterForm;

type TouchedState = { [K in FilterFormKey]: boolean };

const initialTouchedFields: TouchedState = {
  programName: false,
  statuses: false,
  studyName: false,
  submitterName: false,
};

export const DEFAULT_STATUSES_SELECTED: ApplicationStatus[] = [
  "New",
  "In Progress",
  "Submitted",
  "In Review",
  "Inquired",
];

export const defaultValues: FilterForm = {
  programName: "All",
  studyName: "",
  statuses: DEFAULT_STATUSES_SELECTED,
  submitterName: "",
};

const FIELDS_TO_DEBOUNCE: (keyof FilterForm)[] = [
  "studyName",
  "submitterName",
  "programName",
  "statuses",
];

const MIN_LENGTHS: { [K in keyof FilterForm]: number } = {
  studyName: 3,
  submitterName: 3,
  programName: 0,
  statuses: 0,
};

const statusValues: ApplicationStatus[] = [
  "New",
  "In Progress",
  "Submitted",
  "In Review",
  "Inquired",
  "Approved",
  "Rejected",
  "Canceled",
  "Deleted",
];

/**
 * A component that provides filters for the Cross Validation table.
 *
 * @see {@link FilterProps} for the props
 */
const ListFilters = ({ applicationData, onChange }: FilterProps) => {
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { watch, setValue, control, register, reset, getValues } = useForm<FilterForm>({
    defaultValues,
  });

  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);
  const [isStatusesMenuOpen, setIsStatusesMenuOpen] = useState<boolean>(false);

  const handleFormChange = useCallback((form: FilterForm) => {
    if (!onChange || !form) {
      return;
    }

    const newForm: FilterForm = {
      ...form,
      studyName: form.studyName?.length >= 3 ? form.studyName : "",
      submitterName: form.submitterName?.length >= 3 ? form.submitterName : "",
    };

    onChange(newForm);
  }, []);

  useDebouncedWatch<FilterForm>({
    watch,
    fieldsToDebounce: FIELDS_TO_DEBOUNCE,
    minLengths: MIN_LENGTHS,
    defaultMinLength: 3,
    debounceMs: 500,
    onChange: handleFormChange,
  });

  const [programNameFilter, studyNameFilter, statusesFilter, submitterNameFilter] = watch([
    "programName",
    "studyName",
    "statuses",
    "submitterName",
  ]);

  useEffect(() => {
    const programName = searchParams.get("programName");
    const studyName = searchParams.get("studyName");
    const statuses = searchParams.getAll("statuses");
    const submitterName = searchParams.get("submitterName");

    if (programName && programName !== getValues("programName")) {
      setValue("programName", programName);
    }
    if (studyName && studyName !== getValues("studyName")) {
      setValue("studyName", studyName);
    }
    if (statuses.length > 0 && !isEqual(statuses, getValues("statuses"))) {
      const validStatuses = statuses.filter((status) =>
        statusValues.includes(status as ApplicationStatus)
      ) as ApplicationStatus[];
      setValue("statuses", validStatuses);
    }
    if (submitterName && submitterName !== getValues("submitterName")) {
      setValue("submitterName", submitterName);
    }
    if (Object.values(touchedFilters).every((filter) => !filter)) {
      handleFormChange(getValues());
    }
  }, [applicationData?.programs, applicationData?.studies, searchParams?.toString()]);

  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams);

    if (programNameFilter && programNameFilter !== "All") {
      newSearchParams.set("programName", programNameFilter);
    } else {
      newSearchParams.delete("programName");
    }

    if (statusesFilter && statusesFilter.length > 0) {
      newSearchParams.delete("statuses");
      if (!isEqual(statusesFilter, defaultValues.statuses)) {
        statusesFilter.forEach((status) => {
          newSearchParams.append("statuses", status);
        });
      }
    } else {
      newSearchParams.set("statuses", "");
    }

    if (studyNameFilter && studyNameFilter.length >= 3) {
      newSearchParams.set("studyName", studyNameFilter);
    } else {
      newSearchParams.delete("studyName");
    }

    if (submitterNameFilter && submitterNameFilter.length >= 3) {
      newSearchParams.set("submitterName", submitterNameFilter);
    } else {
      newSearchParams.delete("submitterName");
    }

    if (newSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [
    programNameFilter,
    studyNameFilter,
    statusesFilter,
    submitterNameFilter,
    searchParams,
    setSearchParams,
  ]);

  const programOptions = useMemo(() => {
    const programs = applicationData?.programs?.filter((p) => !!p) || [];
    return ["All", ...programs];
  }, [applicationData?.programs]);

  const handleResetFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("programName");
    newSearchParams.delete("studyName");
    newSearchParams.delete("statuses");
    newSearchParams.delete("submitterName");
    setSearchParams(newSearchParams);

    const newForm: FilterForm = { ...defaultValues };
    reset(newForm);
    handleFormChange(newForm);
  };

  const handleFilterChange = (field: FilterFormKey) => {
    setTouchedFilters((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <StyledContainer>
      <Stack direction="row" alignItems="center">
        <Grid container>
          <Grid item xs={3}>
            <StyledFormControl>
              <StyledInlineLabel htmlFor="submitter-name-filter">Submitter Name</StyledInlineLabel>
              <StyledTextField
                {...register("submitterName", {
                  setValueAs: (val) => val?.trim(),
                  onChange: () => handleFilterChange("submitterName"),
                  onBlur: (e) =>
                    isStringLengthBetween(e?.target?.value, 0, 3) && setValue("submitterName", ""),
                })}
                size="small"
                placeholder="Minimum 3 characters required"
                inputProps={{
                  id: "submitter-name-filter",
                  "data-testid": "submitter-name-input",
                }}
                required
              />
            </StyledFormControl>
          </Grid>

          <Grid item xs={3}>
            <StyledFormControl>
              <StyledInlineLabel htmlFor="programName-filter">Program</StyledInlineLabel>
              <Controller
                name="programName"
                control={control}
                render={({ field }) => (
                  <StyledAutocomplete
                    disablePortal={false}
                    {...field}
                    renderInput={({ inputProps, ...params }) => (
                      <TextField
                        {...params}
                        placeholder="Select programs"
                        inputProps={{
                          required: !programNameFilter?.length,
                          ...inputProps,
                        }}
                      />
                    )}
                    id="programName-filter"
                    onChange={(_, value) => {
                      handleFilterChange("programName");
                      field.onChange(value);
                    }}
                    options={programOptions}
                    slotProps={{
                      popper: {
                        sx: {
                          zIndex: 99999,
                        },
                      },
                    }}
                    disableCloseOnSelect
                  />
                )}
              />
            </StyledFormControl>
          </Grid>

          <Grid item xs={3}>
            <StyledFormControl>
              <StyledInlineLabel htmlFor="study-name-filter">Study</StyledInlineLabel>
              <StyledTextField
                {...register("studyName", {
                  setValueAs: (val) => val?.trim(),
                  onChange: () => handleFilterChange("studyName"),
                  onBlur: (e) =>
                    isStringLengthBetween(e?.target?.value, 0, 3) && setValue("studyName", ""),
                })}
                size="small"
                placeholder="Minimum 3 characters required"
                inputProps={{
                  id: "study-name-filter",
                  "data-testid": "study-name-input",
                }}
                required
              />
            </StyledFormControl>
          </Grid>

          <Grid item xs={3}>
            <StyledFormControl>
              <StyledInlineLabel htmlFor="status-filter">Status</StyledInlineLabel>
              <Controller
                name="statuses"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    MenuProps={{
                      disablePortal: true,
                      hideBackdrop: true,
                      sx: { zIndex: 10002, pointerEvents: "none" },
                      PaperProps: {
                        sx: { pointerEvents: "auto" },
                      },
                    }}
                    open={isStatusesMenuOpen}
                    onOpen={() => setIsStatusesMenuOpen(true)}
                    onClose={() => setIsStatusesMenuOpen(false)}
                    inputProps={{ id: "status-filter" }}
                    renderValue={(selected: string[]) =>
                      selected?.length > 1 ? `${selected.length} statuses selected` : selected
                    }
                    onChange={(e) => {
                      field.onChange(e);
                      handleFilterChange("statuses");
                    }}
                    data-testid="application-status-filter"
                    multiple
                    endAdornment={
                      field.value?.length > 0 && (
                        <InputAdornment position="end">
                          <ClearButton
                            onClick={() => {
                              field.onChange([]);
                              handleFilterChange("statuses");
                            }}
                            data-testid="status-clear-button"
                            aria-label="Clear status selection"
                          />
                        </InputAdornment>
                      )
                    }
                  >
                    {statusValues.map((status) => (
                      <MenuItem
                        key={`application_status_${status}`}
                        data-testid={`application-status-${status}`}
                        value={status}
                      >
                        {status}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
              <Backdrop
                open={isStatusesMenuOpen}
                onClick={() => setIsStatusesMenuOpen(false)}
                sx={{ zIndex: 10000, opacity: "0 !important", cursor: "text" }}
              />
            </StyledFormControl>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <ActionButtonsContainer>
          <StyledActionWrapper>
            <Tooltip
              open={undefined}
              title="Reset filters."
              placement="top"
              disableHoverListener={false}
            >
              <StyledIconButton
                onClick={handleResetFilters}
                data-testid="reset-filters-button"
                aria-label="Reset filters button"
              >
                <StyledRefreshIcon />
              </StyledIconButton>
            </Tooltip>
          </StyledActionWrapper>
        </ActionButtonsContainer>
      </Stack>
    </StyledContainer>
  );
};

export default memo(ListFilters, isEqual);
