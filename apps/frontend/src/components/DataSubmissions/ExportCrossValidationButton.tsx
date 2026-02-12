import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButtonProps, IconButton, styled } from "@mui/material";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { unparse } from "papaparse";
import { useState } from "react";

import {
  CrossValidationResultsInput,
  CrossValidationResultsResp,
  SUBMISSION_CROSS_VALIDATION_RESULTS,
} from "../../graphql";
import { downloadBlob, filterAlphaNumeric, unpackValidationSeverities } from "../../utils";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

export type Props = {
  /**
   * The K:V pair of the fields that should be exported where
   * `key` is the column header and `value` is a function
   * that generates the exportable value
   *
   * @example { "Batch ID": (d) => d.displayID }
   */
  fields: Record<string, (row: CrossValidationResult) => string | number>;
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
 * Provides the button and supporting functionality to
 * export the cross validation results of a submission.
 *
 * @returns {React.FC} The export validation button.
 */
export const ExportCrossValidationButton: React.FC<Props> = ({
  fields,
  disabled,
  ...buttonProps
}: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { data } = useSubmissionContext();
  const [loading, setLoading] = useState<boolean>(false);

  const [getData] = useLazyQuery<CrossValidationResultsResp, CrossValidationResultsInput>(
    SUBMISSION_CROSS_VALIDATION_RESULTS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  const handleClick = async () => {
    setLoading(true);

    const { data: d, error } = await getData({
      variables: {
        submissionID: data?.getSubmission?._id,
        sortDirection: "asc",
        orderBy: "displayID",
        first: -1,
        offset: 0,
      },
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    });

    if (error || !d?.submissionCrossValidationResults?.results) {
      enqueueSnackbar("Unable to retrieve cross validation results.", {
        variant: "error",
      });
      setLoading(false);
      return;
    }

    if (!d?.submissionCrossValidationResults?.results.length) {
      enqueueSnackbar("There are no cross validation results to export.", {
        variant: "error",
      });
      setLoading(false);
      return;
    }

    try {
      const filteredName = filterAlphaNumeric(
        data?.getSubmission?.name?.trim()?.replaceAll(" ", "-"),
        "-"
      );
      const filename = `${filteredName}-cross-validation-results-${dayjs().format(
        "YYYY-MM-DD"
      )}.csv`;
      const unpacked = unpackValidationSeverities<CrossValidationResult>(
        d.submissionCrossValidationResults.results
      );
      const fieldset = Object.entries(fields);
      const csvArray = [];

      unpacked.forEach((row) => {
        const csvRow = {};

        fieldset.forEach(([field, value]) => {
          csvRow[field] = value(row) || "";
        });

        csvArray.push(csvRow);
      });

      downloadBlob(unparse(csvArray), filename, "text/csv");
    } catch (err) {
      enqueueSnackbar(`Unable to export cross validation results. Error: ${err}`, {
        variant: "error",
      });
    }

    setLoading(false);
  };

  return (
    <StyledTooltip
      title="Export all cross validation issues to a CSV file"
      placement="top"
      data-testid="export-cross-validation-tooltip"
    >
      <span>
        <StyledIconButton
          onClick={handleClick}
          disabled={loading || disabled}
          data-testid="export-cross-validation-button"
          aria-label="Export cross validation results"
          {...buttonProps}
        >
          <CloudDownload />
        </StyledIconButton>
      </span>
    </StyledTooltip>
  );
};
