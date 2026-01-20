import { useLazyQuery } from "@apollo/client";
import {
  Alert,
  Checkbox,
  FormControlLabel,
  Button,
  Stack,
  styled,
  CheckboxProps,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useAuthContext } from "../../components/Contexts/AuthContext";
import { useSubmissionContext } from "../../components/Contexts/SubmissionContext";
import DataViewDetailsDialog from "../../components/DataSubmissions/DataViewDetailsDialog";
import DeleteNodeDataButton from "../../components/DataSubmissions/DeleteNodeDataButton";
import { ExportNodeDataButton } from "../../components/DataSubmissions/ExportNodeDataButton";
import SubmittedDataFilters, {
  FilterForm,
  FilterMethods,
  hasFiltersApplied,
} from "../../components/DataSubmissions/SubmittedDataFilters";
import GenericTable, { Column } from "../../components/GenericTable";
import TruncatedText from "../../components/TruncatedText";
import {
  GET_SUBMISSION_NODES,
  GetSubmissionNodesInput,
  GetSubmissionNodesResp,
} from "../../graphql";
import { coerceToString, Logger, rearrangeKeys, safeParse } from "../../utils";

import DataViewContext from "./Contexts/DataViewContext";

const StyledCheckbox = styled(Checkbox)({
  padding: 0,
  marginLeft: "10px",
  marginTop: "-2px",
});

const StyledAlert = styled(Alert, { shouldForwardProp: (p) => p !== "visible" })<{
  visible: boolean;
}>(({ visible }) => ({
  marginBottom: "22px",
  display: visible ? "flex" : "none",
}));

type HeaderCheckboxProps = CheckboxProps;

const HeaderCheckbox = (props: HeaderCheckboxProps) => (
  <DataViewContext.Consumer>
    {({ selectedItems, totalData, isFetchingAllData, selectType, handleToggleAll }) => {
      // When selectType is "exclusion", selectedItems contains exclusions
      // When selectType is "explicit", selectedItems contains selections
      // isChecked = (selectType is "exclusion" AND no exclusions) OR (selectType is "explicit" AND all items selected)
      const isChecked =
        selectType === "exclusion"
          ? selectedItems.length === 0
          : selectedItems.length === totalData;
      const hasPartialSelection =
        selectType === "exclusion"
          ? selectedItems.length > 0
          : selectedItems.length > 0 && selectedItems.length < totalData;

      const handleOnChange = () => {
        // Not checked and not intermediate -> toggle select all ON
        if (!isChecked && !hasPartialSelection) {
          isFetchingAllData.current = true;
          handleToggleAll();
          return;
        }

        // Fully or partially checked -> turn off select all (reset)
        handleToggleAll();
      };

      return (
        <Stack direction="row" spacing={0}>
          <FormControlLabel
            control={
              <StyledCheckbox
                {...props}
                onChange={handleOnChange}
                checked={isChecked || isFetchingAllData.current}
                indeterminate={hasPartialSelection && !isFetchingAllData.current}
              />
            }
            label={<span style={visuallyHidden}>Select All</span>}
            sx={{ margin: 0 }}
          />
        </Stack>
      );
    }}
  </DataViewContext.Consumer>
);

const StyledFirstColumnButton = styled(Button)(() => ({
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "25px",
  color: "#0B6CB1",
  padding: 0,
  margin: 0,
  textDecoration: "underline",
  justifyContent: "flex-start",
  "&:hover": {
    backgroundColor: "transparent",
    textDecoration: "underline",
  },
}));

type T = Pick<SubmissionNode, "nodeType" | "nodeID" | "status"> & {
  props: Record<string, unknown>;
};

const SubmittedData: FC = () => {
  const { user } = useAuthContext();
  const { data: dataSubmission, refetch: refetchSubmission, updateQuery } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();
  const { _id, name, deletingData } = dataSubmission?.getSubmission || {};

  const tableRef = useRef<TableMethods>(null);
  const filterMethodRef = useRef<FilterMethods>(null);
  const filterRef = useRef<FilterForm>({ nodeType: "", status: "All", submittedID: "" });
  const prevFilterRef = useRef<FilterForm>({ nodeType: "", status: "All", submittedID: "" });
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const isFetchingAllData = useRef<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [columns, setColumns] = useState<Column<T>[]>([]);
  const [data, setData] = useState<T[]>([]);
  const [prevListing, setPrevListing] = useState<FetchListing<T>>(null);
  const [totalData, setTotalData] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectType, setSelectType] = useState<"explicit" | "exclusion">(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<T>(null);

  const collaborator = dataSubmission?.getSubmission?.collaborators?.find(
    (c) => c.collaboratorID === user?._id
  );

  const [getSubmissionNodes] = useLazyQuery<GetSubmissionNodesResp, GetSubmissionNodesInput>(
    GET_SUBMISSION_NODES,
    {
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  const renderFirstColumnValue = (d: T, prop: string): React.ReactNode => (
    <StyledFirstColumnButton variant="text" onClick={() => onClickFirstColumn(d)} disableRipple>
      <TruncatedText
        text={coerceToString(d?.props?.[prop])}
        maxCharacters={10}
        ellipsis
        underline={false}
        disableInteractiveTooltip={false}
      />
    </StyledFirstColumnButton>
  );

  const onClickFirstColumn = (data: T) => {
    setSelectedNode(data);
  };

  const handleCloseDialog = () => {
    setSelectedNode(null);
  };

  const handleSetupColumns = (rawColumns: string[], keyColumn: string) => {
    if (!rawColumns?.length || !filterRef.current?.nodeType) {
      setLoading(false);
    }

    const dataFileColumnOrder = [keyColumn, "Status", "Orphaned"];
    const metadataFileColumnOrder = [keyColumn, "Status"];
    const columnOrder =
      filterRef.current.nodeType === "data file" ? dataFileColumnOrder : metadataFileColumnOrder;
    const orderedColumns = rearrangeKeys([...rawColumns, "Status"], columnOrder);

    const cols: Column<T>[] = orderedColumns?.map((prop: string, idx: number) => {
      if (prop === "Status") {
        return {
          label: "Status",
          renderValue: (d) => d?.status || "",
          field: "status",
          sx: {
            width: "137px",
          },
        } as Column<T>;
      }

      if (prop === "Orphaned") {
        return {
          label: "Orphaned",
          renderValue: (d) => d?.props?.[prop] || "",
          fieldKey: "Orphaned",
          sx: {
            width: "159px",
          },
        } as Column<T>;
      }

      return {
        label: prop,
        renderValue: (d) =>
          idx === 0 && d.nodeType !== "data file" ? (
            renderFirstColumnValue(d, prop)
          ) : (
            <TruncatedText
              text={coerceToString(d?.props?.[prop])}
              maxCharacters={10}
              disableInteractiveTooltip={false}
              ellipsis
              underline
            />
          ),
        fieldKey: prop,
        default: idx === 0 ? true : undefined,
      };
    });

    cols.unshift({
      label: (
        <HeaderCheckbox
          disabled={collaborator && collaborator.permission !== "Can Edit"}
          data-testid="header-checkbox"
        />
      ),
      renderValue: (d) => (
        <DataViewContext.Consumer>
          {({ selectedItems, selectType, handleToggleRow }) => {
            // When selectType is "exclusion", row is checked if NOT in selectedItems (exclusions)
            // When selectType is "explicit", row is checked if IN selectedItems (selections)
            const isChecked =
              selectType === "exclusion"
                ? !selectedItems?.includes(d.nodeID)
                : selectedItems?.includes(d.nodeID);

            return (
              <Stack direction="row" spacing={1}>
                <FormControlLabel
                  control={
                    <StyledCheckbox
                      checked={isChecked}
                      onChange={() => handleToggleRow([d.nodeID])}
                      disabled={collaborator && collaborator.permission !== "Can Edit"}
                      data-testid="row-checkbox"
                    />
                  }
                  label={<span style={visuallyHidden}>Select Row</span>}
                  sx={{ margin: 0 }}
                />
              </Stack>
            );
          }}
        </DataViewContext.Consumer>
      ),
      sortDisabled: true,
      fieldKey: "checkbox",
    });

    if (isEqual(cols, columns)) {
      return;
    }

    setColumns(cols || []);
  };

  // TODO: Need to fix the double fetch due to orderBy change
  const handleFetchData = async (fetchListing: FetchListing<T>, force: boolean) => {
    const { first, offset, sortDirection, orderBy } = fetchListing || {};
    if (!_id) {
      return;
    }
    if (!force && data?.length > 0 && isEqual(fetchListing, prevListing)) {
      return;
    }
    if (!filterRef.current.nodeType) {
      setData([]);
      setTotalData(0);
      return;
    }
    if (abortControllerRef.current && prevListing) {
      abortControllerRef.current.abort();
    }

    setPrevListing(fetchListing);
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const { data: d, error } = await getSubmissionNodes({
      variables: {
        _id,
        first,
        offset,
        sortDirection,
        orderBy,
        partial: false,
        ...filterRef.current,
      },
      context: { fetchOptions: { signal: abortController.signal } },
    });

    if (abortController.signal.aborted) {
      return;
    }

    if (error || !d?.getSubmissionNodes || !("properties" in d.getSubmissionNodes)) {
      enqueueSnackbar("Unable to retrieve node data.", { variant: "error" });
      setLoading(false);
      return;
    }

    if (!d?.getSubmissionNodes?.total || !d?.getSubmissionNodes?.properties?.length) {
      setData([]);
      setTotalData(0);
      setLoading(false);
      setColumns([]);
      return;
    }

    // Only update columns if the nodeType has changed or if there are no previous columns
    if (prevFilterRef.current.nodeType !== filterRef.current.nodeType || !columns.length) {
      handleSetupColumns(d.getSubmissionNodes.properties, d.getSubmissionNodes.IDPropName);
    }

    prevFilterRef.current = filterRef.current;
    setTotalData(d.getSubmissionNodes.total);
    setData(
      d.getSubmissionNodes.nodes.map((node) => ({
        nodeType: node.nodeType,
        nodeID: node.nodeID,
        props: safeParse(node.props),
        status: node.status,
      }))
    );
    setLoading(false);
  };

  const handleFilterChange = useCallback(
    (filters: FilterForm) => {
      setSelectedItems([]);
      setSelectType(null);
      filterRef.current = filters;
      tableRef.current?.setPage(0, true);
    },
    [setSelectedItems, filterRef.current, tableRef.current]
  );

  const handleToggleRow = useCallback(
    (nodeIds: string[]) => {
      setSelectedItems((prev) => {
        const newSelected = new Set(prev);
        nodeIds.forEach((id) => {
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
        });

        const next = Array.from(newSelected);
        if (selectType !== "exclusion") {
          setSelectType(next.length > 0 ? "explicit" : null);
        }

        return next;
      });
    },
    [selectType, setSelectedItems, setSelectType]
  );

  const handleToggleAll = useCallback(async () => {
    // Selection is already active. Clear selection
    if (selectType) {
      setSelectedItems([]);
      setSelectType(null);
      return;
    }

    if (hasFiltersApplied(filterRef.current)) {
      // NOTE: Force immediate update of selectedItems for the current page
      flushSync(() => {
        setSelectedItems(data?.map((node) => node.nodeID) || []);
        setSelectType("explicit");
      });

      // If all rows are already visible, no need to fetch data
      if (data?.length === totalData) {
        isFetchingAllData.current = false;
        return;
      }

      const { data: d, error } = await getSubmissionNodes({
        variables: {
          _id,
          first: -1,
          partial: true,
          ...filterRef.current,
        },
      }).catch((e) => ({ error: e, data: null }));

      if (error || !d?.getSubmissionNodes) {
        Logger.error("SubmittedData: Error fetching all node IDs for select all.", { error });
        enqueueSnackbar("Cannot select all rows. Unable to retrieve list of nodes.", {
          variant: "error",
        });
        setSelectedItems([]);
        isFetchingAllData.current = false;
        return;
      }

      Logger.info("SubmittedData: Selected all rows using explicit ID approach.", {
        ids: d.getSubmissionNodes.nodes.map((node) => node.nodeID),
        filters: filterRef.current,
      });
      setSelectedItems(d.getSubmissionNodes.nodes.map((node) => node.nodeID));
      isFetchingAllData.current = false;
      return;
    }

    Logger.info("SubmittedData: Selecting all rows using excluded ID approach.");
    setSelectType("exclusion");
    setSelectedItems([]);
    isFetchingAllData.current = false;
  }, [
    _id,
    data,
    totalData,
    selectType,
    isFetchingAllData,
    filterRef.current,
    setSelectedItems,
    setSelectType,
  ]);

  const handleOnDelete = (successMessage: string) => {
    setDeleteSuccessMessage(successMessage);
    setSelectedItems([]);
    setSelectType(null);

    updateQuery((prev) => ({
      ...prev,
      getSubmission: {
        ...prev.getSubmission,
        deletingData: true,
      },
    }));

    // Kick off polling to check for deletion status change
    // NOTE: We're waiting 1000ms to allow the cache to update
    setTimeout(refetchSubmission, 1000);
  };

  const Actions = useMemo<React.ReactNode>(
    () => (
      <Stack direction="row" alignItems="center" gap="8px" marginRight="37px">
        <ExportNodeDataButton
          submission={{ _id, name }}
          nodeType={filterRef.current.nodeType}
          disabled={loading || !data?.length}
        />
        <DeleteNodeDataButton
          selectedItems={selectedItems}
          selectType={selectType}
          totalData={totalData}
          nodeType={filterRef.current.nodeType}
          disabled={loading}
          onDelete={handleOnDelete}
        />
      </Stack>
    ),
    [
      handleOnDelete,
      _id,
      name,
      filterRef.current?.nodeType,
      selectedItems,
      selectType,
      totalData,
      loading,
      data.length,
    ]
  );

  const providerValue = useMemo(
    () => ({
      handleToggleRow,
      handleToggleAll,
      selectedItems,
      totalData,
      isFetchingAllData,
      selectType,
    }),
    [handleToggleRow, handleToggleAll, selectedItems, totalData, isFetchingAllData, selectType]
  );

  useEffect(() => {
    if (deletingData === true || !deleteSuccessMessage) {
      return;
    }

    enqueueSnackbar(deleteSuccessMessage, { variant: "success" });
    setDeleteSuccessMessage(null);

    tableRef.current?.setPage(0, true);
    filterMethodRef.current?.refetch();
  }, [deletingData]);

  return (
    <>
      <StyledAlert
        severity="warning"
        visible={deletingData === true}
        data-testid="submitted-data-deletion-alert"
      >
        All selected nodes are currently being deleted. Please wait...
      </StyledAlert>
      <SubmittedDataFilters
        submissionId={_id}
        onChange={handleFilterChange}
        ref={filterMethodRef}
      />
      <DataViewContext.Provider value={providerValue}>
        <GenericTable
          ref={tableRef}
          columns={columns}
          data={data || []}
          total={totalData || 0}
          loading={loading}
          defaultRowsPerPage={20}
          defaultOrder="desc"
          position="both"
          AdditionalActions={{
            top: { after: Actions },
            bottom: { after: Actions },
          }}
          setItemKey={(item, idx) => `${idx}_${item.nodeID}`}
          onFetchData={handleFetchData}
          containerProps={{ sx: { marginBottom: "8px" } }}
          tableProps={{ sx: { whiteSpace: "nowrap" } }}
        />
      </DataViewContext.Provider>
      <DataViewDetailsDialog
        submissionID={_id}
        nodeType={selectedNode?.nodeType}
        nodeID={selectedNode?.nodeID}
        open={!!selectedNode}
        onClose={handleCloseDialog}
      />
    </>
  );
};

export default React.memo(SubmittedData);
