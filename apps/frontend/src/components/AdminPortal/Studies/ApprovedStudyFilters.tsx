import { Box, FormControl, MenuItem, Stack, styled } from "@mui/material";
import { debounce, sortBy } from "lodash";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Status, useOrganizationListContext } from "../../Contexts/OrganizationListContext";
import { useSearchParamsContext } from "../../Contexts/SearchParamsContext";
import StyledOutlinedInput from "../../StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../../StyledFormComponents/StyledSelect";
import SuspenseLoader from "../../SuspenseLoader";

const StyledFilterContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingBottom: "10px",
});

const StyledInlineLabel = styled("label")({
  padding: "0",
  fontWeight: "700",
});

const StyledFormControl = styled(FormControl)({
  margin: "10px",
  marginRight: 0,
  minWidth: "250px",
  maxWidth: "250px",
});

const initialTouchedFields: TouchedState = {
  study: false,
  dbGaPID: false,
  accessType: false,
  programID: false,
};

export type FilterForm = {
  study: string;
  dbGaPID: string;
  accessType: AccessType;
  programID: string;
};

type TouchedState = { [K in keyof FilterForm]: boolean };

type Props = {
  onChange?: (data: FilterForm) => void;
};

const ApprovedStudyFilters = ({ onChange }: Props) => {
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { activeOrganizations: activePrograms, status: OrgStatus } = useOrganizationListContext();
  const { watch, register, control, setValue, getValues } = useForm<FilterForm>({
    defaultValues: {
      study: "",
      programID: "All",
      dbGaPID: "",
      accessType: "All",
    },
  });
  const [studyFilter, programIDFilter, dbGaPIDFilter, accessTypeFilter] = watch([
    "study",
    "programID",
    "dbGaPID",
    "accessType",
  ]);
  const [selectMinWidth, setSelectMinWidth] = useState<number | null>(null);
  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);
  const debouncedOnChangeRef = useRef(
    debounce((form: FilterForm) => onChange?.(form), 500)
  ).current;

  const isAccessTypeFilterOption = (accessType: string): accessType is FilterForm["accessType"] =>
    ["All", "Controlled", "Open"].includes(accessType);

  const handleAccessTypeChange = (accessType: string) => {
    if (accessType === accessTypeFilter) {
      return;
    }

    if (isAccessTypeFilterOption(accessType)) {
      setValue("accessType", accessType);
    }
  };

  useEffect(() => {
    const dbGaPID = searchParams.get("dbGaPID") || "";
    const study = searchParams.get("study") || "";
    const accessType = searchParams.get("accessType") || "All";
    const programID = searchParams.get("programID") || "All";

    if (programID !== programIDFilter) {
      setValue("programID", programID);
    }
    if (dbGaPID !== dbGaPIDFilter) {
      setValue("dbGaPID", dbGaPID);
    }
    if (study !== studyFilter) {
      setValue("study", study);
    }
    handleAccessTypeChange(accessType);

    if (Object.values(touchedFilters).every((filter) => !filter)) {
      onChange?.(getValues());
    }
  }, [
    searchParams.get("dbGaPID"),
    searchParams.get("study"),
    searchParams.get("accessType"),
    searchParams.get("programID"),
  ]);

  useEffect(() => {
    if (Object.values(touchedFilters).every((filter) => !filter)) {
      return;
    }
    const newSearchParams = new URLSearchParams(searchParams);

    if (programIDFilter && programIDFilter !== "All") {
      newSearchParams.set("programID", programIDFilter);
    } else {
      newSearchParams.delete("programID");
    }
    if (dbGaPIDFilter) {
      newSearchParams.set("dbGaPID", dbGaPIDFilter);
    } else {
      newSearchParams.delete("dbGaPID");
    }
    if (studyFilter) {
      newSearchParams.set("study", studyFilter);
    } else {
      newSearchParams.delete("study");
    }
    if (accessTypeFilter && accessTypeFilter !== "All") {
      newSearchParams.set("accessType", accessTypeFilter);
    } else if (accessTypeFilter === "All") {
      newSearchParams.delete("accessType");
    }

    if (newSearchParams?.toString() !== searchParams?.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [dbGaPIDFilter, studyFilter, accessTypeFilter, programIDFilter, touchedFilters]);

  useEffect(() => {
    const subscription = watch((formValue: FilterForm, { name }) => {
      // Add debounce for input fields
      if (name === "study" || name === "dbGaPID") {
        debouncedOnChangeRef(formValue);
        return;
      }

      // Immediately call the onChange if the change is not an input field
      onChange?.(formValue);
    });

    return () => subscription.unsubscribe();
  }, [watch, debouncedOnChangeRef]);

  const handleFilterChange = (field: keyof FilterForm) => {
    setTouchedFilters((prev) => ({ ...prev, [field]: true }));
  };

  // Move 'NA' program to the front
  const sortedActivePrograms = useMemo(
    () => sortBy(activePrograms, ({ name }) => (name === "NA" ? 0 : 1)),
    [activePrograms]
  );

  if (OrgStatus === Status.LOADING) {
    return <SuspenseLoader data-testid="approved-study-filters-suspense-loader" />;
  }

  return (
    <StyledFilterContainer data-testid="approved-study-filters">
      <Stack direction="row" alignItems="center">
        <StyledInlineLabel htmlFor="study-filter">Study</StyledInlineLabel>
        <StyledFormControl>
          <StyledOutlinedInput
            {...register("study", {
              onChange: (e) => handleFilterChange("study"),
              setValueAs: (val) => val?.trim(),
            })}
            placeholder="Enter a Study"
            id="study-filter"
            required
            inputProps={{
              "data-testid": "study-input",
            }}
          />
        </StyledFormControl>
      </Stack>

      <Stack direction="row" alignItems="center">
        <StyledInlineLabel htmlFor="dbGaPID-filter">dbGaPID</StyledInlineLabel>
        <StyledFormControl>
          <StyledOutlinedInput
            {...register("dbGaPID", {
              onChange: (e) => handleFilterChange("dbGaPID"),
              setValueAs: (val) => val?.trim(),
            })}
            placeholder="Enter a dbGaPID"
            id="dbGaPID-filter"
            required
            inputProps={{
              "data-testid": "dbGaPID-input",
            }}
          />
        </StyledFormControl>
      </Stack>

      <Stack direction="row" alignItems="center">
        <StyledInlineLabel htmlFor="programID-filter">Program</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="programID"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                value={field.value}
                onOpen={(event) =>
                  setSelectMinWidth((event.currentTarget as HTMLElement)?.offsetWidth || null)
                }
                MenuProps={{
                  disablePortal: true,
                  sx: { zIndex: 700, width: selectMinWidth ? `${selectMinWidth}px` : "auto" },
                }}
                inputProps={{ id: "programID-filter" }}
                data-testid="programID-select"
                onChange={(e) => {
                  field.onChange(e);
                  handleFilterChange("programID");
                }}
              >
                <MenuItem value="All" data-testid="programID-option-All">
                  All
                </MenuItem>
                {sortedActivePrograms?.map((p) => (
                  <MenuItem key={p._id} value={p._id} data-testid={`programID-option-${p._id}`}>
                    {p.name}
                  </MenuItem>
                ))}
              </StyledSelect>
            )}
          />
        </StyledFormControl>
      </Stack>

      <Stack direction="row" alignItems="center">
        <StyledInlineLabel htmlFor="accessType-filter">Access Type</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="accessType"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                value={field.value}
                MenuProps={{
                  disablePortal: true,
                  PaperProps: { sx: { maxWidth: "300px" } },
                  sx: { zIndex: 700 },
                }}
                inputProps={{ id: "accessType-filter" }}
                data-testid="accessType-select"
                onChange={(e) => {
                  field.onChange(e);
                  handleFilterChange("accessType");
                }}
              >
                <MenuItem value="All" data-testid="accessType-option-All">
                  All
                </MenuItem>
                <MenuItem value="Controlled" data-testid="accessType-option-Controlled">
                  Controlled
                </MenuItem>
                <MenuItem value="Open" data-testid="accessType-option-Open">
                  Open
                </MenuItem>
              </StyledSelect>
            )}
          />
        </StyledFormControl>
      </Stack>
    </StyledFilterContainer>
  );
};

export default ApprovedStudyFilters;
