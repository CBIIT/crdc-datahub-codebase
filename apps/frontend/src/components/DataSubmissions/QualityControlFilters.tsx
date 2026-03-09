import { useQuery } from "@apollo/client";
import { Box, FormControl, MenuItem, Stack, styled } from "@mui/material";
import { cloneDeep } from "lodash";
import { memo, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  LIST_BATCHES,
  ListBatchesInput,
  ListBatchesResp,
  AGGREGATED_SUBMISSION_QC_RESULTS,
  SUBMISSION_STATS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  SubmissionStatsInput,
  SubmissionStatsResp,
} from "../../graphql";
import { compareNodeStats, FormatDate } from "../../utils";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import StyledFormSelect from "../StyledFormComponents/StyledSelect";

const StyledFilterContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "21px",
  paddingLeft: "17px",
  paddingRight: "17px",
  gap: "20px",
});

const StyledInlineLabel = styled("label")({
  color: "#083A50",
  fontWeight: 700,
  fontSize: "16px",
  fontStyle: "normal",
  lineHeight: "19.6px",
  paddingRight: "8px",
});

const StyledFormControl = styled(FormControl)({
  minWidth: "200px",
});

const StyledSelect = styled(StyledFormSelect)(() => ({
  width: "200px",
}));

const defaultValues: FilterForm = {
  issueType: "All",
  batchID: "All",
  nodeType: "All",
  severity: "All",
};

type FilterForm = {
  issueType: string;
  /**
   * The node type to filter by.
   *
   * @default "All"
   */
  nodeType: string;
  batchID: number | "All";
  severity: QCResult["severity"] | "All";
};

type Props = {
  issueType: string | null;
  isAggregated: boolean;
  onChange: (filters: FilterForm) => void;
};

const QualityControlFilters = ({ issueType, isAggregated, onChange }: Props) => {
  const { data: submissionData } = useSubmissionContext();
  const { _id: submissionID } = submissionData?.getSubmission || {};
  const { watch, control, getValues, setValue, reset } = useForm<FilterForm>({ defaultValues });
  const [issueTypeFilter, nodeTypeFilter, batchIDFilter, severityFilter] = watch([
    "issueType",
    "nodeType",
    "batchID",
    "severity",
  ]);

  const { data: issueTypes } = useQuery<
    AggregatedSubmissionQCResultsResp,
    AggregatedSubmissionQCResultsInput
  >(AGGREGATED_SUBMISSION_QC_RESULTS, {
    variables: {
      submissionID,
      partial: true,
      first: -1,
      orderBy: "title",
      sortDirection: "asc",
    },
    context: { clientName: "backend" },
    skip: !submissionID || isAggregated,
    fetchPolicy: "cache-and-network",
  });

  const { data: batchData } = useQuery<ListBatchesResp<true>, ListBatchesInput>(LIST_BATCHES, {
    variables: {
      submissionID,
      first: -1,
      offset: 0,
      partial: true,
      orderBy: "displayID",
      sortDirection: "asc",
    },
    context: { clientName: "backend" },
    skip: !submissionID || isAggregated,
    fetchPolicy: "cache-and-network",
  });

  const { data: submissionStats } = useQuery<SubmissionStatsResp, SubmissionStatsInput>(
    SUBMISSION_STATS,
    {
      variables: { id: submissionID },
      context: { clientName: "backend" },
      skip: !submissionID || isAggregated,
      fetchPolicy: "cache-and-network",
    }
  );

  useEffect(() => {
    reset({ ...defaultValues });
  }, [isAggregated]);

  useEffect(() => {
    if (!issueTypes || !issueType || issueType === issueTypeFilter) {
      return;
    }

    setValue("issueType", issueType);
  }, [issueType, issueTypes]);

  useEffect(() => {
    onChange(getValues());
  }, [issueTypeFilter, nodeTypeFilter, batchIDFilter, severityFilter, isAggregated]);

  const nodeTypes = useMemo<string[]>(
    () =>
      cloneDeep(submissionStats?.submissionStats?.stats)
        ?.filter((stat) => stat.error > 0 || stat.warning > 0)
        ?.sort(compareNodeStats)
        ?.map((stat) => stat.nodeName),
    [submissionStats?.submissionStats?.stats]
  );

  const dedupedIssueTypes = useMemo(() => {
    const types = issueTypes?.aggregatedSubmissionQCResults?.results;
    const seen = new Set<string>();

    return types?.filter((item) => {
      if (seen.has(item.code)) {
        return false;
      }

      seen.add(item.code);
      return true;
    });
  }, [issueTypes?.aggregatedSubmissionQCResults?.results]);

  return (
    <StyledFilterContainer data-testid="quality-control-filters">
      {!isAggregated ? (
        <>
          <Stack
            direction="row"
            justifyContent="flex-start"
            alignItems="center"
            data-testid="issueType-filter-container"
          >
            <StyledInlineLabel htmlFor="issueType-filter">Issue Type</StyledInlineLabel>
            <StyledFormControl>
              <Controller
                name="issueType"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    inputProps={{ id: "issueType-filter", "data-testid": "issueType-filter" }}
                    data-testid="quality-control-issueType-filter"
                    MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
                  >
                    <MenuItem value="All" data-testid="issueType-all">
                      All
                    </MenuItem>
                    {dedupedIssueTypes?.map((issue, idx) => (
                      <MenuItem
                        // eslint-disable-next-line react/no-array-index-key
                        key={`issue_${idx}_${issue.code}`}
                        value={issue.code}
                        data-testid={`issueType-${issue.code}`}
                      >
                        {issue.title}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </StyledFormControl>
          </Stack>

          <Stack
            direction="row"
            justifyContent="flex-start"
            alignItems="center"
            data-testid="batchID-filter-container"
          >
            <StyledInlineLabel htmlFor="batchID-filter">Batch ID</StyledInlineLabel>
            <StyledFormControl>
              <Controller
                name="batchID"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    inputProps={{ id: "batchID-filter" }}
                    data-testid="quality-control-batchID-filter"
                    MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
                  >
                    <MenuItem value="All" data-testid="batchID-all">
                      All
                    </MenuItem>
                    {batchData?.listBatches?.batches?.map((batch) => (
                      <MenuItem
                        key={`batch_${batch._id}`}
                        value={batch._id}
                        data-testid={`batchID-${batch._id}`}
                      >
                        {batch.displayID}
                        {` (${FormatDate(batch.createdAt, "MM/DD/YYYY")})`}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </StyledFormControl>
          </Stack>

          <Stack
            direction="row"
            justifyContent="flex-start"
            alignItems="center"
            data-testid="nodeType-filter-container"
          >
            <StyledInlineLabel htmlFor="nodeType-filter">Node Type</StyledInlineLabel>
            <StyledFormControl>
              <Controller
                name="nodeType"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    {...field}
                    inputProps={{ id: "nodeType-filter" }}
                    data-testid="quality-control-nodeType-filter"
                    MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
                  >
                    <MenuItem value="All" data-testid="nodeType-all">
                      All
                    </MenuItem>
                    {nodeTypes?.map((nodeType) => (
                      <MenuItem
                        key={`nodeType_${nodeType}`}
                        value={nodeType}
                        data-testid={`nodeType-${nodeType}`}
                      >
                        {nodeType.toLowerCase()}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </StyledFormControl>
          </Stack>
        </>
      ) : null}
      <Stack
        direction="row"
        justifyContent="flex-start"
        alignItems="center"
        data-testid="severity-filter-container"
      >
        <StyledInlineLabel htmlFor="severity-filter">Severity</StyledInlineLabel>
        <StyledFormControl>
          <Controller
            name="severity"
            control={control}
            render={({ field }) => (
              <StyledSelect
                {...field}
                inputProps={{ id: "severity-filter" }}
                data-testid="quality-control-severity-filter"
                MenuProps={{ disablePortal: true, sx: { zIndex: 700 } }}
              >
                <MenuItem value="All" data-testid="severity-all">
                  All
                </MenuItem>
                <MenuItem value="Error" data-testid="severity-error">
                  Error
                </MenuItem>
                <MenuItem value="Warning" data-testid="severity-warning">
                  Warning
                </MenuItem>
              </StyledSelect>
            )}
          />
        </StyledFormControl>
      </Stack>
    </StyledFilterContainer>
  );
};

export default memo(QualityControlFilters);
