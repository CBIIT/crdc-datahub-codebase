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

import { useAuthContext } from "../../components/Contexts/AuthContext";
import { useSubmissionContext } from "../../components/Contexts/SubmissionContext";
import DataViewDetailsDialog from "../../components/DataSubmissions/DataViewDetailsDialog";
import DeleteNodeDataButton from "../../components/DataSubmissions/DeleteNodeDataButton";
import { ExportNodeDataButton } from "../../components/DataSubmissions/ExportNodeDataButton";
import SubmittedDataFilters, {
  FilterForm,
  FilterMethods,
} from "../../components/DataSubmissions/SubmittedDataFilters";
import GenericTable, { Column } from "../../components/GenericTable";
import TruncatedText from "../../components/TruncatedText";
import {
  GET_SUBMISSION_NODES,
  GetSubmissionNodesInput,
  GetSubmissionNodesResp,
} from "../../graphql";
import { coerceToString, rearrangeKeys, safeParse } from "../../utils";

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
    {({
      selectedItems,
      totalData,
      isFetchingAllData,
      selectAllActive,
      handleToggleAll,
      handleToggleRow,
    }) => {
      // When selectAllActive is true, selectedItems contains exclusions
      // isChecked = all selected = selectAllActive AND no exclusions
      // isIntermediate = some selected = (selectAllActive AND some exclusions) OR (not selectAllActive AND some selections)
      const isChecked = selectAllActive && selectedItems.length === 0;
      const hasPartialSelection = selectAllActive
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
  const [selectAllActive, setSelectAllActive] = useState<boolean>(false);
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
          {({ selectedItems, selectAllActive, handleToggleRow }) => {
            // When selectAllActive, row is checked if NOT in selectedItems (exclusions)
            // When not selectAllActive, row is checked if IN selectedItems (selections)
            const isChecked = selectAllActive
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
      setSelectAllActive(false);
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
        return Array.from(newSelected);
      });
    },
    [setSelectedItems]
  );

  const handleToggleAll = useCallback(() => {
    // Toggle selectAllActive - when turning ON, clear selectedItems (no exclusions)
    // When turning OFF, clear selectedItems (no selections)
    setSelectAllActive((prev) => !prev);
    setSelectedItems([]);
    isFetchingAllData.current = false;
  }, [isFetchingAllData, setSelectedItems, setSelectAllActive]);

  const handleOnDelete = (successMessage: string) => {
    setDeleteSuccessMessage(successMessage);
    setSelectedItems([]);
    setSelectAllActive(false);

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
          selectAllActive={selectAllActive}
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
      selectAllActive,
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
      selectAllActive,
    }),
    [handleToggleRow, handleToggleAll, selectedItems, totalData, isFetchingAllData, selectAllActive]
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
