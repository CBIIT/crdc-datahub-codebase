import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButton, IconButtonProps, Stack, styled } from "@mui/material";
import dayjs from "dayjs";
import { unparse } from "papaparse";
import { memo, useMemo, useState } from "react";

import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import { hasPermission } from "@/config/AuthPermissions";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "@/graphql";
import { downloadBlob, fetchAllData, FormatDate, Logger } from "@/utils";

import { useAuthContext } from "../Contexts/AuthContext";

const StyledIconButton = styled(IconButton)({
  color: "#606060",
});

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

export type Props = {
  /**
   * Provides the contextually relevant scope of the export.
   */
  scope: Partial<ListSubmissionsInput> & Omit<ListSubmissionsInput, "first" | "offset">;
  /**
   * Whether there is data available to export.
   */
  hasData: boolean;
} & IconButtonProps;

/**
 * Provides the button and supporting functionality to export the data submissions list to CSV.
 */
const ExportSubmissionsButton: React.FC<Props> = ({ scope, hasData, ...buttonProps }: Props) => {
  const { user } = useAuthContext();

  const [loading, setLoading] = useState<boolean>(false);

  const tooltip = useMemo<string>(
    () =>
      !hasData ? "No results to export." : "Export the current list of Data Submissions to CSV.",
    [hasData]
  );

  const [listSubmissions] = useLazyQuery<ListSubmissionsResp, ListSubmissionsInput>(
    LIST_SUBMISSIONS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const handleExport = async () => {
    setLoading(true);

    try {
      const data = await fetchAllData<
        ListSubmissionsResp,
        ListSubmissionsInput,
        ListSubmissionsResp["listSubmissions"]["submissions"][number]
      >(
        listSubmissions,
        scope,
        (data) => data.listSubmissions.submissions,
        (data) => data.listSubmissions.total,
        { pageSize: 1000, total: Infinity }
      );

      if (!data?.length) {
        throw new Error("No data returned from fetch");
      }

      const filename = `crdc-data-submissions-${dayjs().format("YYYY-MM-DD-HH-mm-ss")}.csv`;

      const csvArray = data.map((submission) => ({
        "Submission Name": submission.name,
        Submitter: submission.submitterName,
        "Data Commons": submission.dataCommonsDisplayName,
        Type: submission.intention,
        "Model Version": submission.modelVersion,
        Program: submission.organization?.name ?? "NA",
        Study: submission.studyAbbreviation,
        "dbGaP ID": submission.dbGaPID,
        Status: submission.status,
        "Data Concierge": submission.conciergeName,
        "Record Count": Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
          submission.nodeCount || 0
        ),
        "Data File Size": submission.dataFileSize.formatted || 0,
        "Created Date": submission.createdAt
          ? FormatDate(submission.createdAt, "M/D/YYYY h:mm A")
          : "",
        "Last Updated": submission.updatedAt
          ? FormatDate(submission.updatedAt, "M/D/YYYY h:mm A")
          : "",
      }));

      downloadBlob(unparse(csvArray, { quotes: true }), filename, "text/csv;charset=utf-8;");
    } catch (err) {
      Logger.error("Error during data submissions CSV generation", err);
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission(user, "data_submission", "view", null, true)) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap="8px" marginRight="37px">
      <StyledTooltip title={tooltip} data-testid="export-data-submissions-tooltip">
        <span>
          <StyledIconButton
            onClick={handleExport}
            disabled={!hasData || loading}
            aria-label="Export data submissions button"
            data-testid="export-data-submissions-button"
            {...buttonProps}
          >
            <CloudDownload />
          </StyledIconButton>
        </span>
      </StyledTooltip>
    </Stack>
  );
};

export default memo<Props>(ExportSubmissionsButton);
