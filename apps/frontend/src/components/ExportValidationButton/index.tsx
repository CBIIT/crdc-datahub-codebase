import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButtonProps, IconButton, styled } from "@mui/material";
import dayjs from "dayjs";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { unparse } from "papaparse";
import { memo, MutableRefObject, useMemo, useState } from "react";

import { useSubmissionContext } from "@/components/Contexts/SubmissionContext";
import type { QualityControlFilterForm } from "@/content/dataSubmissions/QualityControl";
import {
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsInput,
  SubmissionQCResultsResp,
} from "@/graphql";
import { downloadBlob, fetchAllData, filterAlphaNumeric, Logger } from "@/utils";

import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

export type Props = {
  /**
   * The K:V pair of the fields that should be exported where
   * `key` is the column header and `value` is a function
   * that generates the exportable value
   *
   * @example { "Batch ID": (d) => d.displayID }
   */
  fields: Record<string, (row: QCResult | AggregatedQCResult) => string | number>;
  /**
   * Tells the component whether to export the "aggregated" or the "expanded" data.
   * @default false
   */
  isAggregated?: boolean;
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
 * @returns {React.FC} The export validation button.
 */
const ExportValidationButton: React.FC<Props> = ({
  fields,
  isAggregated = false,
  filtersRef,
  disabled,
  ...buttonProps
}: Props) => {
  const { data } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);

  const { _id, name } = data?.getSubmission ?? {};

  const tooltip = useMemo<JSX.Element>(() => {
    if (isAggregated) {
      return (
        <span>
          Export all validation issues for this data <br />
          submission to a CSV file
        </span>
      );
    }

    return <span>Export filtered validation issues to Excel</span>;
  }, [isAggregated]);

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

  /**
   * Helper to generate CSV and trigger download.
   * This function:
   *  1) Optionally unpacks severities if not aggregated
   *  2) Uses the given `fields` to generate CSV rows
   *  3) Calls `downloadBlob` to save the CSV file
   *
   * @returns {void}
   */
  const createCSVAndDownload = (rows: AggregatedQCResult[], filename: string): void => {
    try {
      const fieldEntries = Object.entries(fields);
      const csvArray = rows.map((row) => {
        const csvRow: Record<string, string | number> = {};
        fieldEntries.forEach(([header, fn]) => {
          csvRow[header] = fn(row) ?? "";
        });
        return csvRow;
      });

      downloadBlob(unparse(csvArray), filename, "text/csv");
    } catch (err) {
      enqueueSnackbar(`Unable to export validation results. Error: ${err}`, { variant: "error" });
    }
  };

  /**
   *  Creates a file name by using the submission name, filtering by alpha-numeric characters,
   * then adding the date and time
   *
   * @returns {string} A formatted file name for the exported file
   */
  const createFileName = (extension: "csv" | "xlsx" = "csv"): string => {
    const filteredName = filterAlphaNumeric(name?.trim()?.replaceAll(" ", "-"), "-");
    return `${filteredName}-${dayjs().format("YYYY-MM-DDTHHmmss")}.${extension}`;
  };

  /**
   * Will retrieve all of the aggregated submission QC results to
   * construct and download a CSV file
   *
   * @returns {Promise<void>}
   */
  const handleAggregatedExportSetup = async (): Promise<void> => {
    setLoading(true);

    try {
      const { data, error } = await getAggregatedSubmissionQCResults({
        variables: {
          submissionID: _id,
          partial: false,
          first: -1,
          orderBy: "title",
          sortDirection: "asc",
        },
      });

      if (error || !data?.aggregatedSubmissionQCResults?.results) {
        enqueueSnackbar("Unable to retrieve submission aggregated quality control results.", {
          variant: "error",
        });
        return;
      }

      if (!data.aggregatedSubmissionQCResults.results.length) {
        enqueueSnackbar("There are no aggregated validation results to export.", {
          variant: "error",
        });
        return;
      }

      createCSVAndDownload(data.aggregatedSubmissionQCResults.results, createFileName());
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
   * construct and download a Excel file
   */
  const handleExpandedExportSetup = async (): Promise<void> => {
    setLoading(true);

    try {
      enqueueSnackbar("Generating the validation results file. This may take a moment...", {
        variant: "default",
      });

      const { ValidationResultsExcelBuilder } = await import(
        "@/classes/ValidationResultsExcelBuilder"
      );

      const exportRows = await fetchAllData<
        SubmissionQCResultsResp,
        SubmissionQCResultsInput,
        QCResult
      >(
        getSubmissionQCResults,
        {
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
        },
        (resp) => resp?.submissionQCResults?.results ?? [],
        (resp) => resp?.submissionQCResults?.total ?? 0,
        { pageSize: 5_000 }
      );

      if (!exportRows.length) {
        enqueueSnackbar("There are no validation results to export.", { variant: "error" });
        return;
      }

      // TODO: Retrieve this from the backend
      const updatedTabData = [
        {
          submittedID: "mock-id-abc1",
          nodeType: "mock-node-1",
          existing: { program_name: "mock-node-1", program_desc: "original desc" },
          incoming: { program_name: "mock-node-1", program_desc: "some new value" },
        },
      ];

      const builder = new ValidationResultsExcelBuilder(exportRows, updatedTabData);
      const workbook = await builder.serialize();

      downloadBlob(
        workbook,
        createFileName("xlsx"),
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

  /**
   * Click handler that triggers the setup
   * for aggregated or expanded CSV file exporting
   */
  const handleClick = () => {
    if (isAggregated) {
      handleAggregatedExportSetup();
      return;
    }

    handleExpandedExportSetup();
  };

  return (
    <StyledTooltip title={tooltip} placement="top" data-testid="export-validation-tooltip">
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
