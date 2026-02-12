import { useLazyQuery } from "@apollo/client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  IconButtonProps,
  IconButton,
  styled,
  Box,
  ClickAwayListener,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { unparse } from "papaparse";
import { memo, useRef, useState } from "react";

import CloseIconSvg from "@/assets/icons/close_icon.svg?react";
import DownloadIconSvg from "@/assets/icons/download_icon.svg?react";
import type { Column } from "@/components/GenericTable";
import {
  DOWNLOAD_ALL_RELEASED_NODES,
  DownloadAllReleasedNodesResp,
  DownloadAllReleaseNodesInput,
  LIST_RELEASED_DATA_RECORDS,
  ListReleasedDataRecordsInput,
  ListReleasedDataRecordsResponse,
} from "@/graphql";
import { downloadBlob, fetchAllData, Logger } from "@/utils";

export type DataExplorerStudyExportProps = {
  /**
   * The `_id` of the study to export data for.
   */
  studyId: string;
  /**
   * The display name of the study to export data for (e.g. "My Study").
   * Included in the filename of the exported TSV.
   */
  studyDisplayName: string;
  /**
   * The node type to export data for (e.g. "participant").
   */
  nodeType: string;
  /**
   * The display name of the data commons to filter exported data by (e.g. "GC").
   */
  dataCommonsDisplayName: string;
  /**
   * The visible columns that should be included in the export TSV.
   */
  columns: Column<ListReleasedDataRecordsResponse["listReleasedDataRecords"]["nodes"][number]>[];
} & IconButtonProps;

const StyledIconButton = styled(IconButton)({
  padding: 0,
  paddingLeft: "3px",
  marginLeft: "4px",
});

const StyledExpandMoreIcon = styled(ExpandMoreIcon)({
  ".Mui-disabled &": {
    color: "#BBBBBB",
  },
  color: "#000",
  fontSize: "18px",
  alignSelf: "flex-end",
});

const StyledDownloadIcon = styled(DownloadIconSvg)({
  ".Mui-disabled &": {
    color: "#BBBBBB",
  },
  color: "#346798",
  width: "24px",
  height: "24px",
});

const StyledPaper = styled(Paper)({
  border: "1px solid #000000",
  borderRadius: "8px",
});

const StyledMenuList = styled(MenuList)({
  paddingBottom: 0,
});

const StyledMenuHeader = styled(Stack)({
  position: "relative",
  padding: "11px 17px",
  paddingBottom: "0",
});

const StyledMenuTitle = styled(Typography)({
  fontWeight: "700",
  fontSize: "16px",
  color: "#083A50",
});

const StyledPopperCloseButton = styled(IconButton)(() => ({
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledMenuItem = styled(MenuItem)({
  height: "50px",
  borderTop: "1px solid #CCCCCC",
  color: "#0A4A6D",
  fontWeight: "500",
});

const StyledExportFormat = styled(Typography)({
  fontSize: "9px",
  color: "#0A4A6D",
  fontWeight: "400",
  marginLeft: "5px",
});

/**
 * Provides the button and supporting functionality to export the
 * released metadata for a given study.
 *
 * @returns The button to export the released metadata
 */
const DataExplorerStudyExport: React.FC<DataExplorerStudyExportProps> = ({
  studyId,
  studyDisplayName,
  nodeType,
  dataCommonsDisplayName,
  columns,
  ...buttonProps
}: DataExplorerStudyExportProps) => {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const [listReleasedDataRecords] = useLazyQuery<
    ListReleasedDataRecordsResponse,
    ListReleasedDataRecordsInput
  >(LIST_RELEASED_DATA_RECORDS, {
    context: { clientName: "backend" },
    fetchPolicy: "cache-and-network",
  });

  const [downloadAllReleasedNodes] = useLazyQuery<
    DownloadAllReleasedNodesResp,
    DownloadAllReleaseNodesInput
  >(DOWNLOAD_ALL_RELEASED_NODES, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const handleToggle = () => {
    setMenuOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return;
    }

    setMenuOpen(false);
  };

  const handleClickSelected = async () => {
    setLoading(true);
    setMenuOpen(false);

    enqueueSnackbar("Downloading the requested metadata file. This may take a moment...", {
      variant: "default",
    });

    try {
      const data = await fetchAllData<
        ListReleasedDataRecordsResponse,
        ListReleasedDataRecordsInput,
        Record<string, unknown>
      >(
        listReleasedDataRecords,
        { dataCommonsDisplayName, studyId, nodeType },
        (data) => data.listReleasedDataRecords.nodes,
        (data) => data.listReleasedDataRecords.total,
        { pageSize: 5000, total: Infinity }
      );

      if (!data?.length) {
        throw new Error("No data returned from fetch");
      }

      const filename = `${studyDisplayName}_${nodeType}_${dayjs().format("YYYYMMDDHHmmss")}.tsv`;
      const finalData = data.map((item) => {
        const newItem: Record<string, unknown> = {};
        columns.forEach((col) => {
          newItem[col.field] = item[col?.field] || "";
        });
        return newItem;
      });

      downloadBlob(unparse(finalData, { delimiter: "\t" }), filename, "text/tab-separated-values");
    } catch (err) {
      Logger.error("Error during study TSV generation", err);
      enqueueSnackbar("Failed to generate the TSV for the selected node.", {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClickFull = async () => {
    setLoading(true);
    setMenuOpen(false);

    enqueueSnackbar("Downloading the requested metadata file. This may take a moment...", {
      variant: "default",
    });

    try {
      const { data, error } = await downloadAllReleasedNodes({
        variables: { studyId, dataCommonsDisplayName },
      });

      if (error) {
        throw error;
      }
      if (!data?.downloadAllReleasedNodes) {
        throw new Error("Oops! The API did not return a download link.");
      }

      window.open(data.downloadAllReleasedNodes, "_blank", "noopener,noreferrer");
    } catch (err) {
      Logger.error("Error during study download", err);
      enqueueSnackbar(err?.message, {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <StyledIconButton
        ref={anchorRef}
        onClick={handleToggle}
        aria-label="Export study metadata"
        data-testid="export-study-metadata-toggle"
        {...buttonProps}
      >
        <Stack direction="row">
          <StyledDownloadIcon />
          <StyledExpandMoreIcon />
        </Stack>
      </StyledIconButton>
      <Popper open={menuOpen} anchorEl={anchorRef.current} placement="bottom-end">
        <StyledPaper data-testid="export-study-metadata-popper">
          <StyledMenuHeader direction="row" alignItems="center" justifyContent="space-between">
            <StyledMenuTitle variant="subtitle1">Available Downloads</StyledMenuTitle>
            <StyledPopperCloseButton
              aria-label="close"
              data-testid="menu-popper-close-button"
              onClick={handleClose}
            >
              <CloseIconSvg />
            </StyledPopperCloseButton>
          </StyledMenuHeader>
          <ClickAwayListener onClickAway={handleClose}>
            <StyledMenuList autoFocusItem={menuOpen}>
              <StyledMenuItem onClick={handleClickSelected} disabled={loading}>
                Download selected metadata
                <StyledExportFormat>(TSV)</StyledExportFormat>
              </StyledMenuItem>
              <StyledMenuItem onClick={handleClickFull} disabled={loading}>
                Download full study metadata
                <StyledExportFormat>(TSV)</StyledExportFormat>
              </StyledMenuItem>
            </StyledMenuList>
          </ClickAwayListener>
        </StyledPaper>
      </Popper>
    </Box>
  );
};

export default memo<DataExplorerStudyExportProps>(DataExplorerStudyExport);
