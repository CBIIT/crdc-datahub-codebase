import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButtonProps, IconButton, styled } from "@mui/material";
import dayjs from "dayjs";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, MutableRefObject, useState } from "react";

import { useSubmissionContext } from "@/components/Contexts/SubmissionContext";
import type { QualityControlFilterForm } from "@/content/dataSubmissions/QualityControl";
import {
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  RETRIEVE_SUBMISSION_QC_COMPARISONS,
  RetrieveSubmissionQCComparisonsInput,
  RetrieveSubmissionQCComparisonsResp,
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsInput,
  SubmissionQCResultsResp,
} from "@/graphql";
import {
  downloadBlob,
  fetchAllData,
  filterAlphaNumeric,
  filterValidationResults,
  Logger,
  safeParse,
  unpackValidationSeverities,
} from "@/utils";

import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

export type Props = {
  /**
   * Tells the component whether to export the "aggregated" or the "expanded" data.
   * @default false
   */
  isAggregated?: boolean;
  /**
   * A Ref object that holds the current filter values applied to the quality control results table.
   */
  filtersRef: MutableRefObject<QualityControlFilterForm>;
} & IconButtonProps;

const StyledIconButton = styled(IconButton)({
  color: "#606060",
});

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

/**
 * Provides the button and supporting functionality to export the validation results of a submission.
 *
 * @returns The export validation button.
 */
const ExportValidationButton: React.FC<Props> = ({
  isAggregated = false,
  filtersRef,
  disabled,
  ...buttonProps
}: Props) => {
  const { data } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);

  const { _id, name } = data?.getSubmission ?? {};

  const [getSubmissionQCResults] = useLazyQuery<SubmissionQCResultsResp, SubmissionQCResultsInput>(
    SUBMISSION_QC_RESULTS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const [getAggregatedSubmissionQCResults] = useLazyQuery<
    AggregatedSubmissionQCResultsResp,
    AggregatedSubmissionQCResultsInput
  >(AGGREGATED_SUBMISSION_QC_RESULTS, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [getSubmissionQCComparisons] = useLazyQuery<
    RetrieveSubmissionQCComparisonsResp,
    RetrieveSubmissionQCComparisonsInput
  >(RETRIEVE_SUBMISSION_QC_COMPARISONS, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  /**
   * Creates a file name by using the submission name, filtering by alpha-numeric characters,
   * then adding the date and time
   *
   * @returns {string} A formatted file name for the exported file
   */
  const createFileName = (): string => {
    const filteredName = filterAlphaNumeric(name?.trim()?.replaceAll(" ", "-"), "-");
    return `${filteredName}-${dayjs().format("YYYY-MM-DDTHHmmss")}.xlsx`;
  };

  /**
   * Will retrieve all of the aggregated submission QC results to
   * construct and download an Excel file
   */
  const handleAggregatedExportSetup = async (): Promise<void> => {
    setLoading(true);

    try {
      const { AggregatedValidationResultsExcelBuilder } = await import(
        "@/classes/AggregatedValidationResultsExcelBuilder"
      );

      const exportRows = await fetchAllData<
        AggregatedSubmissionQCResultsResp,
        AggregatedSubmissionQCResultsInput,
        AggregatedQCResult
      >(
        getAggregatedSubmissionQCResults,
        {
          submissionID: _id,
          severity: filtersRef.current.severity?.toLowerCase() || "all",
          orderBy: "count",
          sortDirection: "desc",
        },
        (resp) => resp?.aggregatedSubmissionQCResults?.results ?? [],
        (resp) => resp?.aggregatedSubmissionQCResults?.total ?? 0,
        { pageSize: 10_000 }
      );

      if (!exportRows.length) {
        enqueueSnackbar("There are no aggregated validation results to export.", {
          variant: "error",
        });
        return;
      }

      const builder = new AggregatedValidationResultsExcelBuilder(exportRows);
      const workbook = await builder.serialize();

      downloadBlob(
        workbook,
        createFileName(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      enqueueSnackbar(`Unable to export aggregated validation results. Error: ${err}`, {
        variant: "error",
      });
      Logger.error(
        `ExportValidationButton: Unable to export aggregated validation results. Error: ${err}`
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Will retrieve all of the expanded submission QC results to
   * construct and download an Excel file
   */
  const handleExpandedExportSetup = async (): Promise<void> => {
    setLoading(true);

    try {
      const { ValidationResultsExcelBuilder } = await import(
        "@/classes/ValidationResultsExcelBuilder"
      );

      const variables: SubmissionQCResultsInput & RetrieveSubmissionQCComparisonsInput = {
        id: _id,
        sortDirection: "asc",
        orderBy: "displayID",
        issueCode:
          !filtersRef.current.issueType || filtersRef.current.issueType === "All"
            ? undefined
            : filtersRef.current.issueType,
        nodeTypes:
          !filtersRef.current.nodeType || filtersRef.current.nodeType === "All"
            ? undefined
            : [filtersRef.current.nodeType],
        batchIDs:
          !filtersRef.current.batchID || filtersRef.current.batchID === "All"
            ? undefined
            : [filtersRef.current.batchID],
        severities: filtersRef.current.severity || "All",
      };

      const [exportRows, comparisonResponse] = await Promise.allSettled([
        fetchAllData<SubmissionQCResultsResp, SubmissionQCResultsInput, QCResult>(
          getSubmissionQCResults,
          variables,
          (resp) => resp?.submissionQCResults?.results ?? [],
          (resp) => resp?.submissionQCResults?.total ?? 0,
          { pageSize: 5_000 }
        ),
        getSubmissionQCComparisons({ variables }),
      ]).then(
        (results) =>
          [
            results[0].status === "fulfilled" ? results[0].value : null,
            results[1].status === "fulfilled" ? results[1].value : null,
          ] as const
      );

      // NOTE: This performs additional issueType and severity filtering because the backend
      // filtering is not comprehensive, and still includes irrelevant results.
      const unpackedResults = filterValidationResults(
        unpackValidationSeverities(exportRows),
        filtersRef.current.severity,
        filtersRef.current.issueType
      );

      if (!unpackedResults.length) {
        enqueueSnackbar("There are no validation results matching the selected filters.", {
          variant: "error",
        });
        return;
      }

      const comparisonRows =
        comparisonResponse?.data?.retrieveSubmissionQCComparisons?.comparisons?.map((item) => ({
          submittedID: item.submittedID,
          nodeType: item.nodeType,
          existing: safeParse<Record<string, unknown>>(item.existingProps),
          incoming: safeParse<Record<string, unknown>>(item.incomingProps),
        })) ?? [];

      const builder = new ValidationResultsExcelBuilder(unpackedResults, comparisonRows);
      const workbook = await builder.serialize();

      downloadBlob(
        workbook,
        createFileName(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      enqueueSnackbar(`Unable to export expanded validation results. Error: ${err}`, {
        variant: "error",
      });
      Logger.error(
        `ExportValidationButton: Unable to export expanded validation results. Error: ${err}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    enqueueSnackbar("Generating the validation results file. This may take a moment...", {
      variant: "default",
    });

    if (isAggregated) {
      handleAggregatedExportSetup();
      return;
    }

    handleExpandedExportSetup();
  };

  return (
    <StyledTooltip
      title={<span>Export filtered validation issues to Excel</span>}
      placement="top"
      data-testid="export-validation-tooltip"
    >
      <span>
        <StyledIconButton
          onClick={handleClick}
          disabled={loading || disabled}
          data-testid="export-validation-button"
          aria-label="Export validation results"
          {...buttonProps}
        >
          <CloudDownload />
        </StyledIconButton>
      </span>
    </StyledTooltip>
  );
};

export default memo<Props>(ExportValidationButton, isEqual);
