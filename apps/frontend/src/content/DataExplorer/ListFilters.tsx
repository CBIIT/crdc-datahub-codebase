import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, FormControl, IconButton, MenuItem, Stack, styled } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useSearchParamsContext } from "../../components/Contexts/SearchParamsContext";
import StyledTextFieldFormComponent from "../../components/StyledFormComponents/StyledOutlinedInput";
import StyledSelectFormComponent from "../../components/StyledFormComponents/StyledSelect";
import StyledTooltip from "../../components/StyledFormComponents/StyledTooltip";
import { ListReleasedStudiesInput } from "../../graphql";
import { useDebouncedWatch } from "../../hooks/useDebouncedWatch";
import { isStringLengthBetween } from "../../utils";

const StyledFilters = styled("div")({
  paddingTop: "13px",
  paddingBottom: "15px",
  paddingLeft: "33px",
  paddingRight: "26px",
});

const StyledFormControl = styled(FormControl)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
});

const StyledInlineLabel = styled("label")({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "16px",
  textAlign: "right",
});

const StyledSelect = styled(StyledSelectFormComponent)({
  width: "280px",
});

const StyledTextField = styled(StyledTextFieldFormComponent)({
  width: "280px",
});

const ActionButtonsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  height: "100%",
  gap: "9px",
});

const StyledActionWrapper = styled(Box)({
  minWidth: "44px",
  width: "100%",
  height: "44px",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
});

const StyledRefreshIcon = styled(RefreshIcon)({
  transform: "scale(-1, 1)",
  color: "#346798",
  fontSize: "31px",
});

const StyledIconButton = styled(IconButton)({
  padding: 0,
  border: "1px solid #D0D0D0",
  borderRadius: "5px",
});

const initialTouchedFields: TouchedState = {
  name: false,
  dbGaPID: false,
  dataCommonsDisplayNames: false,
};

export const defaultValues: FilterForm = {
  name: "",
  dbGaPID: "",
  dataCommonsDisplayNames: "All",
};

const FIELDS_TO_DEBOUNCE: (keyof FilterForm)[] = ["name", "dbGaPID", "dataCommonsDisplayNames"];
const MIN_LENGTHS: { [K in keyof FilterForm]: number } = {
  name: 3,
  dbGaPID: 3,
  dataCommonsDisplayNames: 0,
};

type TouchedState = { [K in keyof FilterForm]: boolean };

export type FilterForm = Pick<ListReleasedStudiesInput, "name" | "dbGaPID"> & {
  dataCommonsDisplayNames: string;
};

type Props = {
  dataCommonsDisplayNames: string[];
  onChange?: (data: FilterForm) => void;
};

const ListFilters = ({ dataCommonsDisplayNames, onChange }: Props) => {
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { control, register, watch, reset, setValue, getValues } = useForm<FilterForm>({
    defaultValues,
  });
  const [nameFilter, dbGaPIDFilter, dataCommonsDisplayNamesFilter] = watch([
    "name",
    "dbGaPID",
    "dataCommonsDisplayNames",
  ]);
  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);

  const handleFormChange = useCallback((form: FilterForm) => {
    if (!onChange || !form) {
      return;
    }

    const newForm: FilterForm = { ...form };

    onChange(newForm);
  }, []);

  useDebouncedWatch<FilterForm>({
    watch,
    fieldsToDebounce: FIELDS_TO_DEBOUNCE,
    minLengths: MIN_LENGTHS,
    defaultMinLength: 0,
    debounceMs: 500,
    onChange: handleFormChange,
  });

  useEffect(() => {
    const name = searchParams.get("name");
    const dbGaPID = searchParams.get("dbGaPID");
    const dataCommonsDisplayNames = searchParams.get("dataCommonsDisplayNames");

    if (name && name !== getValues("name")) {
      setValue("name", name);
    }
    if (dbGaPID && dbGaPID !== getValues("dbGaPID")) {
      setValue("dbGaPID", dbGaPID);
    }
    if (
      dataCommonsDisplayNames &&
      dataCommonsDisplayNames !== getValues("dataCommonsDisplayNames")
    ) {
      setValue("dataCommonsDisplayNames", dataCommonsDisplayNames);
    }
    if (Object.values(touchedFilters).every((filter) => !filter)) {
      handleFormChange(getValues());
    }
  }, [
    searchParams?.get("name"),
    searchParams?.get("dbGaPID"),
    searchParams?.get("dataCommonsDisplayNames"),
  ]);

  useEffect(() => {
    if (Object.values(touchedFilters).every((filter) => !filter)) {
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);

    if (dataCommonsDisplayNamesFilter && dataCommonsDisplayNamesFilter !== "All") {
      newSearchParams.set("dataCommonsDisplayNames", dataCommonsDisplayNamesFilter);
    } else {
      newSearchParams.delete("dataCommonsDisplayNames");
    }

    if (nameFilter && nameFilter.length >= 3) {
      newSearchParams.set("name", nameFilter);
    } else {
      newSearchParams.delete("name");
    }

    if (dbGaPIDFilter && dbGaPIDFilter.length >= 3) {
      newSearchParams.set("dbGaPID", dbGaPIDFilter);
    } else {
      newSearchParams.delete("dbGaPID");
    }

    if (newSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [nameFilter, dbGaPIDFilter, dataCommonsDisplayNamesFilter, touchedFilters]);

  const handleResetFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("name");
    newSearchParams.delete("dbGaPID");
    newSearchParams.delete("dataCommonsDisplayNames");
    setSearchParams(newSearchParams);

    reset({ ...defaultValues });
    setTouchedFilters(initialTouchedFields);
  };

  const handleFilterChange = (field: keyof FilterForm) => {
    setTouchedFilters((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <StyledFilters data-testid="data-explorer-filters">
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" gap="35px">
          <StyledFormControl>
            <StyledInlineLabel htmlFor="name-filter">Study</StyledInlineLabel>
            <StyledTextField
              {...register("name", {
                setValueAs: (val) => val?.trim(),
                onChange: () => handleFilterChange("name"),
                onBlur: (e) =>
                  isStringLengthBetween(e?.target?.value, 0, 3) && setValue("name", ""),
              })}
              id="name-filter"
              size="small"
              placeholder="Minimum 3 characters required"
              inputProps={{
                "aria-labelledby": "name-filter",
                "data-testid": "name-input",
              }}
              required
            />
          </StyledFormControl>

          <StyledFormControl>
            <StyledInlineLabel htmlFor="dbGaPID-filter">dbGaP ID</StyledInlineLabel>
            <StyledTextField
              {...register("dbGaPID", {
                setValueAs: (val) => val?.trim(),
                onChange: () => handleFilterChange("dbGaPID"),
                onBlur: (e) =>
                  isStringLengthBetween(e?.target?.value, 0, 3) && setValue("dbGaPID", ""),
              })}
              id="dbGaPID-filter"
              size="small"
              placeholder="Minimum 3 characters required"
              inputProps={{
                "aria-labelledby": "dbGaPID-filter",
                "data-testid": "dbGaPID-input",
              }}
              required
            />
          </StyledFormControl>

          <StyledFormControl>
            <StyledInlineLabel htmlFor="data-commons-display-names-filter">
              Data
              <br />
              Commons
            </StyledInlineLabel>
            <Controller
              name="dataCommonsDisplayNames"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  value={field.value}
                  MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
                  inputProps={{
                    id: "data-commons-display-names-filter",
                    "data-testid": "data-commons-display-names-select-input",
                  }}
                  data-testid="data-commons-display-names-select"
                  onChange={(e) => {
                    field.onChange(e);
                    handleFilterChange("dataCommonsDisplayNames");
                  }}
                >
                  <MenuItem value="All" data-testid="data-commons-display-names-option-All">
                    All
                  </MenuItem>
                  {dataCommonsDisplayNames?.map((dc) => (
                    <MenuItem
                      key={dc}
                      value={dc}
                      data-testid={`data-commons-display-names-option-${dc}`}
                    >
                      {dc}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
          </StyledFormControl>
        </Stack>

        <ActionButtonsContainer>
          <StyledActionWrapper>
            <StyledTooltip
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
            </StyledTooltip>
          </StyledActionWrapper>
        </ActionButtonsContainer>
      </Stack>
    </StyledFilters>
  );
};

export default ListFilters;
