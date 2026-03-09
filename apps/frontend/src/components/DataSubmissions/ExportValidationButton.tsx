import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButtonProps, IconButton, styled } from "@mui/material";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { unparse } from "papaparse";
import { useState } from "react";

import {
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsResp,
} from "../../graphql";
import { downloadBlob, filterAlphaNumeric, Logger, unpackValidationSeverities } from "../../utils";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

export type Props = {
  /**
   * The full Data Submission object to export validation results for
   */
  submission: Submission;
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
export const ExportValidationButton: React.FC<Props> = ({
  submission,
  fields,
  isAggregated = false,
  disabled,
  ...buttonProps
}: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);

  const [getSubmissionQCResults] = useLazyQuery<SubmissionQCResultsResp>(SUBMISSION_QC_RESULTS, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

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
  const createCSVAndDownload = (
    rows: (QCResult | AggregatedQCResult)[],
    filename: string,
    isAggregated: boolean
  ): void => {
    try {
      let finalRows = rows;

      if (!isAggregated) {
        finalRows = unpackValidationSeverities<QCResult>(rows as QCResult[]);
      }

      const fieldEntries = Object.entries(fields);
      const csvArray = finalRows.map((row) => {
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
  const createFileName = (): string => {
    const filteredName = filterAlphaNumeric(submission.name?.trim()?.replaceAll(" ", "-"), "-");
    return `${filteredName}-${dayjs().format("YYYY-MM-DDTHHmmss")}.csv`;
  };

  /**
   *  Will retrieve all of the aggregated submission QC results to
   * construct and download a CSV file
   *
   *
   * @returns {Promise<void>}
   */
  const handleAggregatedExportSetup = async (): Promise<void> => {
    setLoading(true);

    try {
      const { data, error } = await getAggregatedSubmissionQCResults({
        variables: {
          submissionID: submission?._id,
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

      createCSVAndDownload(data.aggregatedSubmissionQCResults.results, createFileName(), true);
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
   *  Will retrieve all of the expanded submission QC results to
   * construct and download a CSV file
   *
   *
   * @returns {Promise<void>}
   */
  const handleExpandedExportSetup = async () => {
    setLoading(true);

    try {
      const { data, error } = await getSubmissionQCResults({
        variables: {
          id: submission?._id,
          sortDirection: "asc",
          orderBy: "displayID",
          first: -1,
          offset: 0,
          severities: "All",
        },
      });

      if (error || !data?.submissionQCResults?.results) {
        enqueueSnackbar("Unable to retrieve submission quality control results.", {
          variant: "error",
        });
        return;
      }

      if (!data.submissionQCResults.results.length) {
        enqueueSnackbar("There are no validation results to export.", { variant: "error" });
        return;
      }

      createCSVAndDownload(data.submissionQCResults.results, createFileName(), false);
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
  const handleClick = async () => {
    if (isAggregated) {
      handleAggregatedExportSetup();
      return;
    }

    handleExpandedExportSetup();
  };

  return (
    <StyledTooltip
      title={
        <span>
          Export all validation issues for this data <br />
          submission to a CSV file
        </span>
      }
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
