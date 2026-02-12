import { useLazyQuery } from "@apollo/client";
import { Box, Button, Stack, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useSubmissionContext } from "../../components/Contexts/SubmissionContext";
import CrossValidationFilters, {
  FilterForm,
} from "../../components/DataSubmissions/CrossValidationFilters";
import { ExportCrossValidationButton } from "../../components/DataSubmissions/ExportCrossValidationButton";
import ErrorDetailsDialog from "../../components/ErrorDetailsDialog/v1";
import GenericTable, { Column } from "../../components/GenericTable";
import StyledFormTooltip from "../../components/StyledFormComponents/StyledTooltip";
import {
  CrossValidationResultsInput,
  CrossValidationResultsResp,
  SUBMISSION_CROSS_VALIDATION_RESULTS,
} from "../../graphql";
import { FormatDate, titleCase } from "../../utils";

import QCResultsContext from "./Contexts/QCResultsContext";

const StyledErrorDetailsButton = styled(Button)({
  display: "inline",
  color: "#0B6CB1",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "19px",
  padding: 0,
  textDecorationLine: "underline",
  textTransform: "none",
  "&:hover": {
    background: "transparent",
    textDecorationLine: "underline",
  },
});

const StyledNodeType = styled(Box)({
  display: "flex",
  alignItems: "center",
  textTransform: "capitalize",
});

const StyledSeverity = styled(Box)({
  minHeight: 76.5,
  display: "flex",
  alignItems: "center",
});

const StyledBreakAll = styled(Box)({
  wordBreak: "break-all",
});

const StyledIssuesTextWrapper = styled(Box)({
  whiteSpace: "nowrap",
  wordBreak: "break-word",
});

const columns: Column<CrossValidationResult>[] = [
  {
    label: "Batch ID",
    renderValue: (data) => <StyledBreakAll>{data?.displayID}</StyledBreakAll>,
    field: "displayID",
    default: true,
  },
  {
    label: "Node Type",
    renderValue: (data) => <StyledNodeType>{data?.type}</StyledNodeType>,
    field: "type",
  },
  {
    label: "Submitted Identifier",
    renderValue: (data) => <StyledBreakAll>{data?.submittedID}</StyledBreakAll>,
    field: "submittedID",
    sx: {
      width: "20%",
    },
  },
  {
    label: "Conflicting Submission",
    renderValue: ({ conflictingSubmission: _id }) => (
      <span key={_id} data-testid={`conflicting-submission-${_id}`}>
        <StyledFormTooltip title={_id} dynamic>
          <Link
            to={`/data-submission/${_id}`}
            target="_blank"
            data-testid={`conflicting-link-${_id}`}
          >
            ...
            {_id?.slice(-5)}
          </Link>
        </StyledFormTooltip>
      </span>
    ),
    field: "conflictingSubmission",
  },
  {
    label: "Severity",
    renderValue: (data) => (
      <StyledSeverity color={data?.severity === "Error" ? "#B54717" : "#8D5809"}>
        {data?.severity}
      </StyledSeverity>
    ),
    field: "severity",
  },
  {
    label: "Validated Date",
    renderValue: (data) =>
      data?.validatedDate ? `${FormatDate(data?.validatedDate, "MM-DD-YYYY [at] hh:mm A")}` : "",
    field: "validatedDate",
  },
  {
    label: "Issues",
    renderValue: (data) =>
      (data?.errors?.length > 0 || data?.warnings?.length > 0) && (
        <QCResultsContext.Consumer>
          {({ handleOpenErrorDialog }) => (
            <Stack direction="row">
              <StyledIssuesTextWrapper>
                <span>
                  {data.errors?.length > 0 ? data.errors[0].title : data.warnings[0]?.title}.
                </span>{" "}
                <StyledErrorDetailsButton
                  onClick={() => handleOpenErrorDialog && handleOpenErrorDialog(data)}
                  variant="text"
                  disableRipple
                  disableTouchRipple
                  disableFocusRipple
                >
                  See details.
                </StyledErrorDetailsButton>
              </StyledIssuesTextWrapper>
            </Stack>
          )}
        </QCResultsContext.Consumer>
      ),
    sortDisabled: true,
    sx: {
      width: "38%",
    },
  },
];

// CSV columns used for exporting table data
export const csvColumns: Record<string, (CrossValidationResult) => string | number> = {
  "Batch ID": (d: CrossValidationResult) => d.displayID,
  "Node Type": (d: CrossValidationResult) => d.type,
  "Submitted Identifier": (d: CrossValidationResult) => d.submittedID,
  "Conflicting Submission": (d: CrossValidationResult) => d.conflictingSubmission,
  Severity: (d: CrossValidationResult) => d.severity,
  "Validated Date": (d: CrossValidationResult) =>
    FormatDate(d?.validatedDate, "MM-DD-YYYY [at] hh:mm A", ""),
  Issues: (d: CrossValidationResult) => {
    const value = d.errors[0]?.description ?? d.warnings[0]?.description;

    // NOTE: The ErrorMessage descriptions contain non-standard double quotes
    // that don't render correctly in Excel. This replaces them with standard double quotes.
    return value.replaceAll(/[“”‟〞＂]/g, `"`);
  },
};

const CrossValidation: FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { data: submission } = useSubmissionContext();
  const { _id: submissionId, crossSubmissionStatus } = submission?.getSubmission || {};

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<CrossValidationResult[]>([]);
  const [prevData, setPrevData] = useState<FetchListing<CrossValidationResult>>(null);
  const [totalData, setTotalData] = useState<number>(0);
  const [openErrorDialog, setOpenErrorDialog] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<CrossValidationResult | null>(null);

  const tableRef = useRef<TableMethods>(null);
  const filterRef = useRef<FilterForm>({});

  const errorDescriptions =
    selectedRow?.errors?.map((error) => `(Error) ${error.description}`) ?? [];
  const warningDescriptions =
    selectedRow?.warnings?.map((warning) => `(Warning) ${warning.description}`) ?? [];
  const allDescriptions = [...errorDescriptions, ...warningDescriptions];

  const [crossValidationResults] = useLazyQuery<
    CrossValidationResultsResp,
    CrossValidationResultsInput
  >(SUBMISSION_CROSS_VALIDATION_RESULTS, {
    onCompleted: (data) => {
      if (!data?.submissionCrossValidationResults) {
        return;
      }

      setData(data.submissionCrossValidationResults.results);
      setTotalData(data.submissionCrossValidationResults.total);
    },
    context: { clientName: "backend" },
    fetchPolicy: "cache-and-network",
  });

  const handleFetchData = async (
    fetchListing: FetchListing<CrossValidationResult>,
    force: boolean
  ) => {
    const { first, offset, sortDirection, orderBy } = fetchListing || {};
    if (!submissionId) {
      return;
    }
    if (!force && data?.length > 0 && isEqual(fetchListing, prevData)) {
      return;
    }

    setPrevData(fetchListing);

    try {
      setLoading(true);

      const nodeTypeFilter = filterRef.current?.nodeTypes;
      const batchIDFilter = filterRef.current?.batchIDs;

      const { data: d, error } = await crossValidationResults({
        variables: {
          submissionID: submissionId,
          first,
          offset,
          sortDirection,
          orderBy: orderBy as keyof CrossValidationResult,
          nodeTypes: nodeTypeFilter?.[0] === "All" ? undefined : nodeTypeFilter,
          batchIDs: batchIDFilter?.[0] === "All" ? undefined : batchIDFilter,
          severities: filterRef.current?.severities,
        },
        context: { clientName: "backend" },
        fetchPolicy: "no-cache",
      });

      if (error || !d?.submissionCrossValidationResults) {
        throw new Error("Unable to retrieve submission cross validation results.");
      }
    } catch (err) {
      enqueueSnackbar(err?.toString(), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenErrorDialog = (data: CrossValidationResult) => {
    setOpenErrorDialog(true);
    setSelectedRow(data);
  };

  const handleFilterChange = useCallback(
    (data: FilterForm) => {
      filterRef.current = data;
      tableRef.current?.setPage(0, true);
    },
    [tableRef, filterRef]
  );

  const providerValue = useMemo(
    () => ({
      handleOpenErrorDialog,
    }),
    [handleOpenErrorDialog]
  );

  const Actions = useMemo<React.ReactNode>(
    () => (
      <Stack direction="row" alignItems="center" gap="8px" marginRight="37px">
        <ExportCrossValidationButton fields={csvColumns} disabled={totalData <= 0} />
      </Stack>
    ),
    [totalData]
  );

  useEffect(() => {
    tableRef.current?.refresh();
  }, [crossSubmissionStatus]);

  return (
    <>
      <CrossValidationFilters onChange={handleFilterChange} />
      <QCResultsContext.Provider value={providerValue}>
        <GenericTable
          ref={tableRef}
          columns={columns}
          data={data || []}
          total={totalData || 0}
          loading={loading}
          defaultRowsPerPage={20}
          defaultOrder="desc"
          position="both"
          noContentText="No cross-validation issues found"
          AdditionalActions={{
            top: { after: Actions },
            bottom: { after: Actions },
          }}
          setItemKey={(item, idx) => `${idx}_${item.batchID}_${item.submittedID}`}
          onFetchData={handleFetchData}
          containerProps={{ sx: { marginBottom: "8px" } }}
        />
      </QCResultsContext.Provider>
      <ErrorDetailsDialog
        open={openErrorDialog}
        onClose={() => setOpenErrorDialog(false)}
        title="Cross Validation Issues"
        nodeInfo={`For ${titleCase(selectedRow?.type)}${
          selectedRow?.type?.toLocaleLowerCase() !== "data file" ? " Node" : ""
        } ID ${selectedRow?.submittedID}`}
        errors={allDescriptions}
        errorCount={`${allDescriptions?.length || 0} ${
          allDescriptions?.length === 1 ? "ISSUE" : "ISSUES"
        }`}
      />
    </>
  );
};

export default React.memo(CrossValidation);
