import { useQuery } from "@apollo/client";
import { Box, FormControl, MenuItem, Stack, styled } from "@mui/material";
import { cloneDeep, isEqual } from "lodash";
import { forwardRef, memo, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  CrossValidationResultsInput,
  LIST_BATCHES,
  ListBatchesInput,
  ListBatchesResp,
  SUBMISSION_STATS,
  SubmissionStatsInput,
  SubmissionStatsResp,
} from "../../graphql";
import { compareNodeStats, FormatDate } from "../../utils";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import StyledLabel from "../StyledFormComponents/StyledLabel";
import StyledSelect from "../StyledFormComponents/StyledSelect";

export type FilterForm = Pick<CrossValidationResultsInput, "nodeTypes" | "severities" | "batchIDs">;

export type FilterProps = {
  onChange?: (data: FilterForm) => void;
};

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

const StyledInlineLabel = styled(StyledLabel)({
  marginBottom: 0,
  paddingRight: "10px",
});

/**
 * A component that provides filters for the Cross Validation table
 *
 * @see {@link FilterProps} for the props
 */
const CrossValidationFilters = forwardRef<null, FilterProps>(({ onChange }, ref) => {
  const { data: submissionData } = useSubmissionContext();
  const { watch, getValues, control } = useForm<FilterForm>({
    defaultValues: { batchIDs: ["All"], nodeTypes: ["All"], severities: "All" },
  });

  const { data: batchData } = useQuery<ListBatchesResp<true>, ListBatchesInput>(LIST_BATCHES, {
    variables: {
      submissionID: submissionData?.getSubmission?._id,
      first: -1,
      offset: 0,
      partial: true,
      orderBy: "displayID",
      sortDirection: "asc",
    },
    context: { clientName: "backend" },
    skip: !submissionData?.getSubmission?._id,
    fetchPolicy: "cache-and-network",
  });

  const batchTypes = useMemo(
    () =>
      cloneDeep(batchData?.listBatches?.batches)?.sort((a, b) => a.displayID - b.displayID) || [],
    [batchData]
  );

  const { data: submissionStats } = useQuery<SubmissionStatsResp, SubmissionStatsInput>(
    SUBMISSION_STATS,
    {
      variables: { id: submissionData?.getSubmission?._id },
      context: { clientName: "backend" },
      skip: !submissionData?.getSubmission?._id,
      fetchPolicy: "cache-and-network",
    }
  );

  const nodeTypes = useMemo<string[]>(
    () =>
      cloneDeep(submissionStats?.submissionStats?.stats)
        ?.sort(compareNodeStats)
        ?.map((stat) => stat.nodeName)
        .filter((nodeType) => nodeType?.toLowerCase() !== "data file"),
    [submissionStats?.submissionStats?.stats]
  );

  useEffect(() => {
    const formData = getValues();
    onChange?.({
      batchIDs: !Array.isArray(formData.batchIDs) ? [formData.batchIDs] : formData.batchIDs,
      nodeTypes: !Array.isArray(formData.nodeTypes) ? [formData.nodeTypes] : formData.nodeTypes,
      severities: formData.severities,
    });
  }, [watch("batchIDs"), watch("nodeTypes"), watch("severities")]);

  return (
    <StyledContainer>
      <Stack direction="row" justifyContent="flex-start" alignItems="center">
        <StyledInlineLabel htmlFor="batchID-filter">Batch ID</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="batchIDs"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                MenuProps={{ disablePortal: true }}
                inputProps={{ id: "batchID-filter" }}
                data-testid="cross-validation-batchID-filter"
              >
                <MenuItem value="All">All</MenuItem>
                {batchTypes?.map((batch: Batch) => (
                  <MenuItem key={batch._id} value={batch._id} data-testid={batch._id}>
                    {batch.displayID}
                    {` (${FormatDate(batch.createdAt, "MM/DD/YYYY")})`}
                  </MenuItem>
                ))}
              </StyledSelect>
            )}
          />
        </StyledFormControl>
      </Stack>
      <Stack direction="row" justifyContent="flex-start" alignItems="center">
        <StyledInlineLabel htmlFor="nodeType-filter">Node Type</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="nodeTypes"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                MenuProps={{ disablePortal: true }}
                inputProps={{ id: "nodeType-filter" }}
                data-testid="cross-validation-nodeType-filter"
              >
                <MenuItem value="All">All</MenuItem>
                {nodeTypes?.map((nodeType: string) => (
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
        <StyledInlineLabel htmlFor="status-filter">Severity</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="severities"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                MenuProps={{ disablePortal: true }}
                inputProps={{ id: "status-filter" }}
                data-testid="cross-validation-status-filter"
              >
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Error">Error</MenuItem>
                <MenuItem value="Warning">Warning</MenuItem>
              </StyledSelect>
            )}
          />
        </StyledFormControl>
      </Stack>
    </StyledContainer>
  );
});

export default memo(CrossValidationFilters, isEqual);
