import RefreshIcon from "@mui/icons-material/Refresh";
import { FormControl, IconButton, MenuItem, Grid, Box, styled, Stack } from "@mui/material";
import { isEqual } from "lodash";
import { memo, useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ListReleasedDataRecordsInput } from "../../graphql";
import { useSearchParamsContext } from "../Contexts/SearchParamsContext";
import StyledSelectFormComponent from "../StyledFormComponents/StyledSelect";
import Tooltip from "../Tooltip";

const StyledFilters = styled("div")({
  paddingTop: "19px",
  paddingBottom: "15px",
  paddingLeft: "26px",
  paddingRight: "26px",
});

const StyledFormControl = styled(FormControl)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "15px",
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

const StyledActionWrapper = styled(Box)({
  minWidth: "44px",
  width: "100%",
  height: "44px",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
});

const ActionButtonsContainer = styled(Stack)({});

const initialTouchedFields: TouchedState = {
  nodeType: false,
};

export type FilterForm = Pick<ListReleasedDataRecordsInput, "nodeType">;

type FilterFormKey = keyof FilterForm;

type TouchedState = { [K in FilterFormKey]: boolean };

export type DataExplorerFilterProps = {
  nodeTypes: string[];
  defaultValues: FilterForm;
  actions?: React.ReactNode[];
  onChange: (data: FilterForm) => void;
};

const DataExplorerFilters = ({
  nodeTypes,
  defaultValues,
  actions,
  onChange,
}: DataExplorerFilterProps) => {
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { control, watch, reset, setValue, getValues } = useForm<FilterForm>({ defaultValues });
  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);
  const [selectMinWidth, setSelectMinWidth] = useState<number | null>(null);

  const [nodeTypeFilter] = watch(["nodeType"]);

  const handleFormChange = useCallback(
    (form: FilterForm) => {
      onChange?.(form);
    },
    [onChange]
  );

  const handleFilterChange = useCallback(
    (field: FilterFormKey) => {
      setTouchedFilters((prev) => ({ ...prev, [field]: true }));
    },
    [setTouchedFilters]
  );

  const handleResetFilters = useCallback(() => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("nodeType");

    setSearchParams(newSearchParams);
    reset({ ...defaultValues });
  }, [defaultValues, searchParams, reset]);

  useEffect(() => {
    const nodeTypeParam = searchParams.get("nodeType");

    if (nodeTypeParam && nodeTypeParam !== nodeTypeFilter && nodeTypes.includes(nodeTypeParam)) {
      setValue("nodeType", nodeTypeParam);
    }

    if (Object.values(touchedFilters).every((filter) => !filter)) {
      handleFormChange(getValues());
    }
  }, [nodeTypes, searchParams?.toString()]);

  useEffect(() => {
    if (Object.values(touchedFilters).every((filter) => !filter)) {
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);

    if (nodeTypeFilter && nodeTypeFilter !== defaultValues.nodeType) {
      newSearchParams.set("nodeType", nodeTypeFilter);
    } else {
      newSearchParams.delete("nodeType");
    }

    if (newSearchParams?.toString() !== searchParams?.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [nodeTypeFilter, touchedFilters]);

  useEffect(() => {
    const subscription = watch((formValue: FilterForm) => handleFormChange(formValue));

    return () => {
      subscription.unsubscribe();
    };
  }, [watch]);

  return (
    <StyledFilters data-testid="data-submission-list-filters">
      <Stack direction="row" alignItems="center" gap="12px">
        <Grid container spacing={2} rowSpacing="9px">
          <Grid item xs={4}>
            <StyledFormControl>
              <StyledInlineLabel htmlFor="nodeType-filter">Node Type</StyledInlineLabel>
              <Controller
                name="nodeType"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    onOpen={(event) =>
                      setSelectMinWidth((event.currentTarget as HTMLElement)?.offsetWidth || null)
                    }
                    MenuProps={{
                      disablePortal: true,
                      sx: { zIndex: 700, width: selectMinWidth ? `${selectMinWidth}px` : "auto" },
                    }}
                    inputProps={{
                      id: "nodeType-filter",
                      "data-testid": "node-type-select-input",
                    }}
                    data-testid="node-type-select"
                    onChange={(e) => {
                      field.onChange(e);
                      handleFilterChange("nodeType");
                    }}
                  >
                    {nodeTypes.map((nodeType) => (
                      <MenuItem
                        key={`node-type-${nodeType}`}
                        value={nodeType}
                        data-testid={`node-type-option-${nodeType}`}
                      >
                        {nodeType}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </StyledFormControl>
          </Grid>
        </Grid>
        <ActionButtonsContainer direction="row" alignItems="center">
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
          {actions?.map((action, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <StyledActionWrapper key={`action-${index}`}>{action}</StyledActionWrapper>
          ))}
        </ActionButtonsContainer>
      </Stack>
    </StyledFilters>
  );
};

export default memo<DataExplorerFilterProps>(DataExplorerFilters, isEqual);
