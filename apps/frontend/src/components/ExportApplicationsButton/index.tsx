import { useLazyQuery } from "@apollo/client";
import { CloudDownload } from "@mui/icons-material";
import { IconButtonProps, IconButton, styled } from "@mui/material";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { unparse } from "papaparse";
import { FC, memo, useMemo, useState } from "react";

import { useAuthContext } from "@/components/Contexts/AuthContext";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import { hasPermission } from "@/config/AuthPermissions";
import { LIST_APPLICATIONS, ListApplicationsInput, ListApplicationsResp } from "@/graphql";
import { downloadBlob, fetchAllData, FormatDate, Logger } from "@/utils";

export type ExportApplicationsButtonProps = {
  /**
   * Provides the contextually relevant scope of the export.
   * e.g. filters and sorting applied to the list table.
   */
  scope: Partial<ListApplicationsInput> & Omit<ListApplicationsInput, "first" | "offset">;
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
 * Provides the button and supporting functionality to export the
 * list of Submission Requests.
 *
 * @returns ExportApplicationsButton component
 */
const ExportApplicationsButton: FC<ExportApplicationsButtonProps> = ({
  scope,
  disabled,
  ...buttonProps
}: ExportApplicationsButtonProps) => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);

  const tooltip = useMemo<string>(
    () =>
      disabled
        ? "No results to export. You either don't have access to any Submission Requests, or no results match your filters."
        : "Export the current list of Submission Requests to CSV.",
    [disabled]
  );

  const [listApplications] = useLazyQuery<ListApplicationsResp, ListApplicationsInput>(
    LIST_APPLICATIONS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const handleClick = async () => {
    setLoading(true);

    try {
      const data = await fetchAllData<
        ListApplicationsResp,
        ListApplicationsInput,
        ListApplicationsResp["listApplications"]["applications"][number]
      >(
        listApplications,
        scope,
        (d) => d.listApplications.applications,
        (r) => r.listApplications.total,
        { pageSize: 100 }
      );

      if (!data?.length) {
        enqueueSnackbar("Oops! No data was returned for the selected filters.", {
          variant: "error",
        });
        setLoading(false);
        return;
      }

      const filename = `crdc-submission-requests-${dayjs().format("YYYY-MM-DD-HH-mm-ss")}.csv`;
      const csvArray = data.map((application) => ({
        "Submitter Name": application.applicant?.applicantName,
        Program: application.programName || "N/A",
        Study: application.studyAbbreviation || "N/A",
        Status: application.status,
        Version: application.version,
        "Submitted Date": FormatDate(application.submittedDate, "M/D/YYYY h:mm A"),
        "Last Updated Date": FormatDate(application.updatedAt, "M/D/YYYY h:mm A"),
        "Pending Condition(s)":
          // NOTE: Prefix the dash with a space to prevent interpreting this line
          // as a mathematical formula
          application.pendingConditions?.map((pc) => ` - ${pc}`).join("\n") || "N/A",
      }));

      downloadBlob(unparse(csvArray, { quotes: true }), filename, "text/csv;charset=utf-8;");
    } catch (err) {
      Logger.error("Failed to export Submission Requests.", err);
      enqueueSnackbar("Oops! An error occurred while exporting the Submission Requests.", {
        variant: "error",
      });
    }

    setLoading(false);
  };

  if (!hasPermission(user, "submission_request", "view", null, true)) {
    return null;
  }

  return (
    <StyledTooltip title={tooltip} data-testid="export-applications-tooltip">
      <span>
        <StyledIconButton
          onClick={handleClick}
          disabled={loading || disabled}
          data-testid="export-applications-button"
          aria-label="Export submission requests button"
          {...buttonProps}
        >
          <CloudDownload />
        </StyledIconButton>
      </span>
    </StyledTooltip>
  );
};

export default memo<ExportApplicationsButtonProps>(ExportApplicationsButton);
