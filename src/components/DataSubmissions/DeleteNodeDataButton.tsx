import { useMutation } from "@apollo/client";
import { IconButton, IconButtonProps, styled } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { memo, useMemo, useState } from "react";

import DeleteAllFilesIcon from "../../assets/icons/delete_all_files_icon.svg?react";
import { hasPermission } from "../../config/AuthPermissions";
import { DELETE_DATA_RECORDS, DeleteDataRecordsInput, DeleteDataRecordsResp } from "../../graphql";
import { titleCase } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";
import DeleteDialog from "../DeleteDialog";
import StyledFormTooltip from "../StyledFormComponents/StyledTooltip";

const StyledIconButton = styled(IconButton)(({ disabled }) => ({
  opacity: disabled ? 0.26 : 1,
}));

const StyledTooltip = styled(StyledFormTooltip)({
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

/**
 * An array of submission statuses that should disable the delete button
 */
const DisabledStatuses: SubmissionStatus[] = [
  "Submitted",
  "Released",
  "Completed",
  "Canceled",
  "Deleted",
];

/**
 * Maximum number of IDs that can be sent in a single request
 */
const MAX_IDS_LIMIT = 2000;

type Props = {
  /**
   * The name of the node type currently selected
   */
  nodeType: string;
  /**
   * An array of the selected node IDs.
   * When selectAllActive is true, these are the EXCLUDED IDs.
   * When selectAllActive is false, these are the INCLUDED IDs.
   */
  selectedItems: string[];
  /**
   * Indicates if "select all" (inverse selection) mode is active.
   * When true, selectedItems contains exclusions instead of inclusions.
   */
  selectAllActive?: boolean;
  /**
   * Total number of items matching the current filters (used for count display in deleteAll mode)
   */
  totalData?: number;
  /**
   * Optional callback function for when successful deletion occurs
   */
  onDelete?: (message: string) => void;
} & Omit<IconButtonProps, "onClick">;

const DeleteNodeDataButton = ({
  nodeType,
  selectedItems,
  selectAllActive = false,
  totalData = 0,
  disabled,
  onDelete,
  ...rest
}: Props) => {
  const { enqueueSnackbar } = useSnackbar();
  const { data } = useSubmissionContext();
  const { user } = useAuthContext();
  const { _id, status, deletingData } = data?.getSubmission || {};

  const collaborator = data?.getSubmission?.collaborators?.find(
    (c) => c.collaboratorID === user?._id
  );

  const tooltipText = useMemo<string>(() => {
    if (deletingData === true) {
      return "Delete action unavailable while another delete operation is in progress";
    }

    if (nodeType?.toLowerCase() === "data file") {
      return "Delete all the selected data files from this data submission";
    }

    return "Delete all the selected records from this data submission";
  }, [deletingData, nodeType]);

  // Calculate the effective count of items to be deleted
  const effectiveItemCount = useMemo<number>(() => {
    if (selectAllActive) {
      // When selectAllActive, we're deleting all EXCEPT selectedItems
      return totalData - selectedItems.length;
    }
    return selectedItems.length;
  }, [selectAllActive, totalData, selectedItems]);

  const content = useMemo(() => {
    const nodeTerm: string = effectiveItemCount > 1 ? "nodes" : "node";
    const isDataFile: boolean = nodeType.toLowerCase() === "data file";
    const isMultiple: boolean = effectiveItemCount !== 1;

    return {
      snackbarError: "An error occurred while deleting the selected rows.",
      snackbarSuccess: isDataFile
        ? `${effectiveItemCount} ${nodeType}${
            isMultiple ? "s" : ""
          } have been deleted from this data submission`
        : `${effectiveItemCount} ${nodeType} ${nodeTerm} and their associated child nodes have been deleted from this data submission`,
      dialogTitle: isDataFile
        ? `Delete Data File${isMultiple ? "s" : ""}`
        : `Delete ${titleCase(nodeType)} ${titleCase(nodeTerm)}`,
      dialogBody: isDataFile
        ? `You have selected to delete ${effectiveItemCount} ${nodeType}${
            isMultiple ? "s" : ""
          } from this data submission. This action is irreversible. Are you sure you want to continue?`
        : `You have selected to delete ${effectiveItemCount} ${nodeType} ${nodeTerm}. This action is irreversible. Are you sure you want to delete them and their associated children from this data submission?`,
    };
  }, [nodeType, effectiveItemCount]);

  const [loading, setLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const [deleteDataRecords] = useMutation<DeleteDataRecordsResp, DeleteDataRecordsInput>(
    DELETE_DATA_RECORDS,
    {
      context: { clientName: "backend" },
    }
  );

  const onClickIcon = async () => {
    // When selectAllActive, check if exclusiveIDs exceeds the limit
    if (selectAllActive && selectedItems.length > MAX_IDS_LIMIT) {
      enqueueSnackbar(
        `Cannot delete with more than ${MAX_IDS_LIMIT} exclusions. Please adjust your selection.`,
        { variant: "error" }
      );
      return;
    }

    // When not selectAllActive, check if nodeIds exceeds the limit
    if (!selectAllActive && selectedItems.length > MAX_IDS_LIMIT) {
      enqueueSnackbar(
        `Cannot delete more than ${MAX_IDS_LIMIT} items at once. Please use "Select All" or reduce your selection.`,
        { variant: "error" }
      );
      return;
    }

    setConfirmOpen(true);
  };

  const onCloseDialog = async () => {
    setConfirmOpen(false);
  };

  const onConfirmDialog = async () => {
    try {
      setLoading(true);

      const variables: DeleteDataRecordsInput = {
        _id,
        nodeType,
      };

      if (selectAllActive) {
        // Use deleteAll with optional exclusiveIDs
        variables.deleteAll = true;
        if (selectedItems.length > 0) {
          variables.exclusiveIDs = selectedItems;
        }
      } else {
        // Use traditional nodeIds selection
        variables.nodeIds = selectedItems;
      }

      const { data: d, errors } = await deleteDataRecords({ variables });

      if (errors || !d?.deleteDataRecords?.success) {
        throw new Error("Unable to delete selected rows.");
      }

      setConfirmOpen(false);
      onDelete?.(content.snackbarSuccess);
    } catch (err) {
      enqueueSnackbar(content.snackbarError, {
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission(user, "data_submission", "create", data?.getSubmission)) {
    return null;
  }

  // Determine if button should be disabled based on effective selection
  const hasNoSelection = selectAllActive ? effectiveItemCount === 0 : selectedItems.length === 0;

  return (
    <>
      <StyledTooltip
        title={tooltipText}
        placement="top"
        aria-label="Delete node data tooltip"
        data-testid="delete-node-data-tooltip"
      >
        <span>
          <StyledIconButton
            onClick={onClickIcon}
            disabled={
              loading ||
              disabled ||
              deletingData === true ||
              hasNoSelection ||
              DisabledStatuses.includes(status) ||
              (collaborator && collaborator.permission !== "Can Edit")
            }
            aria-label="Delete nodes icon"
            data-testid="delete-node-data-button"
            {...rest}
          >
            <DeleteAllFilesIcon />
          </StyledIconButton>
        </span>
      </StyledTooltip>
      <DeleteDialog
        open={confirmOpen}
        header={content.dialogTitle}
        description={content.dialogBody}
        confirmText="Confirm"
        closeText="Cancel"
        onConfirm={onConfirmDialog}
        onClose={onCloseDialog}
      />
    </>
  );
};

export default memo<Props>(DeleteNodeDataButton, isEqual);
