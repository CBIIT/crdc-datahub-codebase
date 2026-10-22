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
import {
  LIST_APPROVED_STUDIES,
  ListApprovedStudiesInput,
  ListApprovedStudiesResp,
} from "@/graphql";
import { downloadBlob, fetchAllData, FormatDate, Logger } from "@/utils";
import { formatAccessTypes } from "@/utils/studyUtils";

export type ExportStudiesButtonProps = {
  /**
   * Provides the contextually relevant scope of the export.
   * e.g. filters and sorting applied to the list table.
   */
  scope: Partial<ListApprovedStudiesInput> & Omit<ListApprovedStudiesInput, "first" | "offset">;
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
 * list of Approved Studies.
 *
 * @returns ExportStudiesButton component
 */
const ExportStudiesButton: FC<ExportStudiesButtonProps> = ({
  scope,
  disabled,
  ...buttonProps
}: ExportStudiesButtonProps) => {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);

  const tooltip = useMemo<string>(
    () =>
      disabled
        ? "No results to export. No studies match your filters."
        : "Export the current list of Studies to CSV.",
    [disabled]
  );

  const [listApprovedStudies] = useLazyQuery<ListApprovedStudiesResp, ListApprovedStudiesInput>(
    LIST_APPROVED_STUDIES,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const handleClick = async () => {
    setLoading(true);

    try {
      const data = await fetchAllData<
        ListApprovedStudiesResp,
        ListApprovedStudiesInput,
        ListApprovedStudiesResp["listApprovedStudies"]["studies"][number]
      >(
        listApprovedStudies,
        scope,
        (d) => d.listApprovedStudies.studies,
        (r) => r.listApprovedStudies.total,
        { pageSize: 200 }
      );

      if (!data?.length) {
        enqueueSnackbar("Oops! No data was returned for the selected filters.", {
          variant: "error",
        });
        setLoading(false);
        return;
      }

      const filename = `crdc-manage-studies-${dayjs().format("YYYY-MM-DD-HH-mm-ss")}.csv`;
      const csvArray = data.map((study) => ({
        Name: study.studyName,
        Acronym: study.studyAbbreviation,
        dbGaPID: study.dbGaPID,
        "Access Type": formatAccessTypes(study.controlledAccess, study.openAccess),
        "Principal Investigator": study.PI,
        ORCID: study.ORCID,
        Program: study.program?.name,
        "Data Concierge": study.primaryContact
          ? `${study.primaryContact?.firstName || ""} ${
              study.primaryContact?.lastName || ""
            }`.trim()
          : "",
        Status: study.status,
        "Created Date": FormatDate(study.createdAt, "M/D/YYYY h:mm A"),
      }));

      downloadBlob(unparse(csvArray, { quotes: true }), filename, "text/csv;charset=utf-8;");
    } catch (err) {
      Logger.error("Failed to export Studies.", err);
      enqueueSnackbar("Oops! An error occurred while exporting the Studies.", {
        variant: "error",
      });
    }

    setLoading(false);
  };

  if (!hasPermission(user, "study", "manage")) {
    return null;
  }

  return (
    <StyledTooltip title={tooltip} data-testid="export-studies-tooltip">
      <span>
        <StyledIconButton
          onClick={handleClick}
          disabled={loading || disabled}
          data-testid="export-studies-button"
          aria-label="Export studies button"
          {...buttonProps}
        >
          <CloudDownload />
        </StyledIconButton>
      </span>
    </StyledTooltip>
  );
};

export default memo<ExportStudiesButtonProps>(ExportStudiesButton);
