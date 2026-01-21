import { useQuery } from "@apollo/client";
import { Box, FormControl, MenuItem, Stack, styled } from "@mui/material";
import { cloneDeep, debounce, isEqual } from "lodash";
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  GetSubmissionNodesInput,
  SUBMISSION_STATS,
  SubmissionStatsInput,
  SubmissionStatsResp,
} from "../../graphql";
import { compareNodeStats } from "../../utils";
import StyledInput from "../StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../StyledFormComponents/StyledSelect";

export type FilterProps = {
  /**
   * The `_id` of the Data Submission
   *
   * @note The filters will not be fetched if this is not valid
   */
  submissionId: string;
  onChange?: (data: FilterForm) => void;
};

export type FilterMethods = {
  /**
   * A reference to the refetch function of the Apollo Query
   */
  refetch: ReturnType<typeof useQuery<SubmissionStatsResp>>["refetch"];
};

export type FilterForm = Pick<GetSubmissionNodesInput, "nodeType" | "status" | "submittedID">;

export const DEFAULT_VALUES: FilterForm = { nodeType: "", status: "All", submittedID: "" };

const StyledContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "21px",
  paddingLeft: "26px",
  paddingRight: "35px",
});

const StyledFormControl = styled(FormControl)({
  minWidth: "231px",
});

const StyledInlineLabel = styled("label")({
  color: "#083A50",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontWeight: 700,
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "19.6px",
  paddingRight: "10px",
});

/**
 * A utility function to determine if any filters are applied, ignoring `nodeType` filter
 *
 * @param filters The current filter form values
 * @returns True if any filters other than `nodeType` are applied, false otherwise
 */
export const hasFiltersApplied = (filters: FilterForm) =>
  filters.status !== DEFAULT_VALUES.status || filters.submittedID !== DEFAULT_VALUES.submittedID;

/**
 * A component that provides filters for the Submitted Data table
 *
 * @see {@link FilterProps} for the props
 * @see {@link FilterMethods} for the methods available through a ref
 */
const SubmittedDataFilters = forwardRef<FilterMethods, FilterProps>(
  ({ submissionId, onChange }, ref) => {
    const { watch, setValue, getValues, control } = useForm<FilterForm>({
      defaultValues: DEFAULT_VALUES,
    });

    const debouncedOnChangeRef = useRef(
      debounce((form: FilterForm) => onChange?.(form), 500)
    ).current;

    const { data, refetch } = useQuery<SubmissionStatsResp, SubmissionStatsInput>(
      SUBMISSION_STATS,
      {
        variables: { id: submissionId },
        context: { clientName: "backend" },
        skip: !submissionId,
        fetchPolicy: "cache-and-network",
      }
    );

    const nodeTypes = useMemo(
      () =>
        cloneDeep(data?.submissionStats?.stats)
          ?.sort(compareNodeStats)
          ?.map((stat) => stat.nodeName),
      [data?.submissionStats?.stats]
    );

    useEffect(() => {
      if (!!watch("nodeType") || !nodeTypes?.length) {
        return;
      }

      setValue("nodeType", nodeTypes[0]);
      onChange?.({ ...getValues(), nodeType: nodeTypes[0] });
    }, [nodeTypes]);

    useEffect(() => {
      const subscription = watch((formValue: FilterForm, { name }) => {
        if (name === "submittedID") {
          // Debounce if the submittedID has at least 3 characters
          if (formValue.submittedID.length >= 3) {
            debouncedOnChangeRef(formValue);
            // If the submittedID is empty, call the onChange immediately
          } else if (formValue.submittedID.length === 0) {
            onChange?.(formValue);
          }

          // If the submittedID has less than 3 characters, do nothing
          return;
        }

        // Immediately call the onChange if the change is not in the submittedID field
        onChange?.(formValue);
      });

      return () => subscription.unsubscribe();
    }, [watch, debouncedOnChangeRef]);

    useImperativeHandle(ref, () => ({ refetch }), [refetch]);

    return (
      <StyledContainer>
        <Stack direction="row" justifyContent="flex-start" alignItems="center">
          <StyledInlineLabel htmlFor="nodeType-filter">Node Type</StyledInlineLabel>
          <StyledFormControl>
            <Controller
              name="nodeType"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  defaultValue={nodeTypes?.[0] || ""}
                  value={field.value}
                  MenuProps={{ disablePortal: true }}
                  placeholderText=""
                  inputProps={{ id: "nodeType-filter" }}
                  data-testid="data-content-node-filter"
                >
                  {nodeTypes?.map((nodeType) => (
                    <MenuItem key={nodeType} value={nodeType} data-testid={`nodeType-${nodeType}`}>
                      {nodeType.toLowerCase()}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
          </StyledFormControl>
        </Stack>
        <Stack direction="row" justifyContent="flex-start" alignItems="center">
          <StyledInlineLabel htmlFor="status-filter">Status</StyledInlineLabel>
          <StyledFormControl>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  value={field.value}
                  MenuProps={{ disablePortal: true }}
                  placeholderText=""
                  inputProps={{ id: "status-filter" }}
                  data-testid="data-content-status-filter"
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="Error">Error</MenuItem>
                  <MenuItem value="Passed">Passed</MenuItem>
                  <MenuItem value="Warning">Warning</MenuItem>
                </StyledSelect>
              )}
            />
          </StyledFormControl>
        </Stack>
        <Stack direction="row" justifyContent="flex-start" alignItems="center">
          <StyledInlineLabel htmlFor="submittedID-filter">Submitted ID</StyledInlineLabel>
          <StyledFormControl>
            <Controller
              name="submittedID"
              control={control}
              rules={{ minLength: 3 }}
              render={({ field }) => (
                <StyledInput
                  {...field}
                  value={field.value}
                  inputProps={{ id: "submittedID-filter" }}
                  data-testid="data-content-submitted-id-filter"
                />
              )}
            />
          </StyledFormControl>
        </Stack>
      </StyledContainer>
    );
  }
);

export default memo(SubmittedDataFilters, isEqual);
