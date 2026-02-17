import { Box, FormControl, MenuItem, styled } from "@mui/material";
import { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { useDebouncedWatch } from "../../hooks/useDebouncedWatch";
import { useSearchParamsContext } from "../Contexts/SearchParamsContext";
import StyledOutlinedInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../StyledFormComponents/StyledSelect";

const StyledFilterContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingBottom: "10px",
});

const StyledInlineLabel = styled("label")({
  padding: "0 10px",
  fontWeight: "700",
});

const StyledFormControl = styled(FormControl)({
  margin: "10px",
  marginRight: "15px",
  minWidth: "250px",
});

const FIELDS_TO_DEBOUNCE: (keyof FilterForm)[] = ["name", "status"];
const MIN_LENGTHS: { [K in keyof FilterForm]: number } = {
  name: 0,
  status: 0,
};
const initialTouchedFields: TouchedState = {
  name: false,
  status: false,
};

export type FilterForm = {
  name: Institution["name"];
  status: Institution["status"] | "All";
};

type FilterFormKey = keyof FilterForm;
type TouchedState = { [K in FilterFormKey]: boolean };

type Props = {
  onChange?: (data: FilterForm) => void;
};

const InstitutionListFilters = ({ onChange }: Props) => {
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { watch, register, control, setValue, getValues } = useForm<FilterForm>({
    defaultValues: {
      name: "",
      status: "All",
    },
  });

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

  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);
  const [nameFilter, statusFilter] = watch(["name", "status"]);

  useEffect(() => {
    const name = searchParams.get("name");
    const status = searchParams.get("status");

    if (name && name !== getValues("name")) {
      setValue("name", name);
    }
    if (status && status !== getValues("status")) {
      setValue("status", status as Institution["status"]);
    }

    if (Object.values(touchedFilters).every((filter) => !filter)) {
      handleFormChange(getValues());
    }
  }, [searchParams?.get("name"), searchParams?.get("status")]);

  useEffect(() => {
    if (!touchedFilters.name && !touchedFilters.status) {
      return;
    }
    const newSearchParams = new URLSearchParams(searchParams);

    if (statusFilter && statusFilter !== "All") {
      newSearchParams.set("status", statusFilter);
    } else {
      newSearchParams.delete("status");
    }

    if (nameFilter) {
      newSearchParams.set("name", nameFilter);
    } else {
      newSearchParams.delete("name");
    }

    if (newSearchParams?.toString() !== searchParams?.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [nameFilter, statusFilter, touchedFilters]);

  const handleFilterChange = (field: keyof FilterForm) => {
    setTouchedFilters((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <StyledFilterContainer data-testid="institution-filters">
      <StyledInlineLabel htmlFor="name-filter">Name</StyledInlineLabel>
      <StyledFormControl>
        <StyledOutlinedInput
          {...register("name", {
            onChange: (e) => handleFilterChange("name"),
            setValueAs: (val) => val?.trim(),
          })}
          placeholder="Enter a Name"
          id="name-filter"
          required
          inputProps={{
            "data-testid": "name-input",
          }}
        />
      </StyledFormControl>

      <StyledInlineLabel htmlFor="status-filter">Status</StyledInlineLabel>
      <StyledFormControl>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <StyledSelect
              {...field}
              value={field.value}
              MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
              inputProps={{ id: "status-filter", "data-testid": "status-select-input" }}
              data-testid="status-select"
              onChange={(e) => {
                field.onChange(e);
                handleFilterChange("status");
              }}
            >
              <MenuItem value="All" data-testid="status-option-All">
                All
              </MenuItem>
              <MenuItem value="Active" data-testid="status-option-Active">
                Active
              </MenuItem>
              <MenuItem value="Inactive" data-testid="status-option-Inactive">
                Inactive
              </MenuItem>
            </StyledSelect>
          )}
        />
      </StyledFormControl>
    </StyledFilterContainer>
  );
};

export default memo(InstitutionListFilters);
