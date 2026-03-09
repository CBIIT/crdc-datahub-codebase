import { useLazyQuery, useQuery } from "@apollo/client";
import { Box, styled } from "@mui/material";
import { cloneDeep } from "lodash";
import React, { FC, memo, useCallback, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import bannerPng from "../../assets/banner/submission_banner.png";
import { useSearchParamsContext } from "../../components/Contexts/SearchParamsContext";
import DataExplorerFilters, { FilterForm } from "../../components/DataExplorerFilters";
import DataExplorerStudyExport from "../../components/DataExplorerStudyExport";
import GenericTable, { Column } from "../../components/GenericTable";
import ColumnVisibilityButton from "../../components/GenericTable/ColumnVisibilityButton";
import { ColumnVisibilityPopperGroup } from "../../components/GenericTable/ColumnVisibilityPopper";
import NavigationBreadcrumbs, { BreadcrumbEntry } from "../../components/NavigationBreadcrumbs";
import PageContainer from "../../components/PageContainer";
import SuspenseLoader from "../../components/SuspenseLoader";
import TruncatedText from "../../components/TruncatedText";
import {
  GET_APPROVED_STUDY,
  GET_RELEASED_NODE_TYPES,
  GetApprovedStudyInput,
  GetApprovedStudyResp,
  GetReleasedNodeTypesInput,
  GetReleasedNodeTypesResp,
  LIST_RELEASED_DATA_RECORDS,
  ListReleasedDataRecordsInput,
  ListReleasedDataRecordsResponse,
  RETRIEVE_PROPS_FOR_NODE_TYPE,
  RetrievePropsForNodeTypeInput,
  RetrievePropsForNodeTypeResp,
} from "../../graphql";
import { useColumnVisibility } from "../../hooks/useColumnVisibility";
import usePageTitle from "../../hooks/usePageTitle";
import { coerceToString, Logger } from "../../utils";

const StyledBreadcrumbsBox = styled(Box)({
  height: "50px",
  display: "flex",
  alignItems: "center",
  padding: "0 54px",
});

const StyledFilterTableWrapper = styled(Box)({
  borderRadius: "8px",
  background: "#FFF",
  border: "1px solid #6CACDA",
  marginBottom: "25px",
});

type T = ListReleasedDataRecordsResponse["listReleasedDataRecords"]["nodes"][number];

type StudyViewProps = {
  _id: string;
};

const StudyView: FC<StudyViewProps> = ({ _id: studyId }) => {
  usePageTitle(`Data Explorer - ${studyId}`);

  const navigate = useNavigate();
  const { searchParams, lastSearchParams } = useSearchParamsContext();

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<T[]>([]);
  const [totalData, setTotalData] = useState<number>(0);

  const tableRef = useRef<TableMethods>(null);
  const filtersRef = useRef<FilterForm>();
  const prevFiltersRef = useRef<FilterForm>(null);

  const dataCommonsDisplayName = searchParams.get("dataCommonsDisplayName");
  const returnUrl = `/data-explorer${lastSearchParams?.["/data-explorer"] ?? ""}`;

  const { data: studyData, loading: studyLoading } = useQuery<
    GetApprovedStudyResp<true>,
    GetApprovedStudyInput
  >(GET_APPROVED_STUDY, {
    variables: { _id: studyId, partial: true },
    skip: !studyId || !dataCommonsDisplayName,
    fetchPolicy: "cache-first",
    context: { clientName: "backend" },
    onError: (error) => {
      Logger.error("Error fetching study data:", error);
    },
  });

  const { data: nodesData, loading: nodesLoading } = useQuery<
    GetReleasedNodeTypesResp,
    GetReleasedNodeTypesInput
  >(GET_RELEASED_NODE_TYPES, {
    variables: { studyId, dataCommonsDisplayName },
    skip: !studyId || !dataCommonsDisplayName,
    fetchPolicy: "cache-first",
    context: { clientName: "backend" },
    onError: (error) => {
      Logger.error("Error fetching node list:", error);
    },
  });

  const { data: nodeProps, loading: nodePropsLoading } = useQuery<
    RetrievePropsForNodeTypeResp,
    RetrievePropsForNodeTypeInput
  >(RETRIEVE_PROPS_FOR_NODE_TYPE, {
    variables: { studyId, dataCommonsDisplayName, nodeType: filtersRef.current?.nodeType },
    skip: !studyId || !dataCommonsDisplayName || !filtersRef.current?.nodeType,
    fetchPolicy: "cache-first",
    context: { clientName: "backend" },
    onError: (error) => {
      Logger.error("Error fetching node properties:", error);
      navigate("/data-explorer", {
        state: {
          alert: true,
          error: "Oops! Unable to display metadata for the selected study or data commons.",
        },
      });
    },
  });

  const [listReleasedDataRecords] = useLazyQuery<
    ListReleasedDataRecordsResponse,
    ListReleasedDataRecordsInput
  >(LIST_RELEASED_DATA_RECORDS, {
    context: { clientName: "backend" },
    fetchPolicy: "cache-and-network",
  });

  const columnVisibilityKey = useMemo<string>(
    () =>
      `dataExplorerColumns:${studyId}:${dataCommonsDisplayName}:${filtersRef.current?.nodeType}`,
    [studyId, dataCommonsDisplayName, filtersRef.current?.nodeType]
  );

  const selectedNodeType = useMemo<
    GetReleasedNodeTypesResp["getReleaseNodeTypes"]["nodes"][number] | null
  >(
    () =>
      nodesData?.getReleaseNodeTypes?.nodes?.find(
        (node) => node.name === filtersRef.current?.nodeType
      ) || null,
    [nodesData, filtersRef.current?.nodeType]
  );

  const nodeTypeOptions = useMemo<string[]>(() => {
    if (!nodesData || !nodesData?.getReleaseNodeTypes?.nodes.length) {
      return [];
    }

    const clonedData = cloneDeep(nodesData.getReleaseNodeTypes.nodes).sort((a, b) => {
      if (a.count === b.count) {
        return a.name.localeCompare(b.name);
      }

      return a.count - b.count;
    });

    return clonedData.map((node) => node.name);
  }, [nodesData]);

  const defaultValues = useMemo<FilterForm>(
    () => ({
      nodeType: nodeTypeOptions?.[0] || "",
    }),
    [nodeTypeOptions]
  );

  const studyDisplayName = useMemo<string>(
    () =>
      studyData?.getApprovedStudy?.studyAbbreviation ||
      studyData?.getApprovedStudy?.studyName ||
      "",
    [studyData]
  );

  const breadcrumbs = useMemo<BreadcrumbEntry[]>(
    () => [
      {
        label: "Data Explorer",
        to: returnUrl,
      },
      {
        label: studyDisplayName,
      },
    ],
    [studyDisplayName]
  );

  const columns = useMemo<Column<T>[]>(
    () =>
      nodeProps?.retrievePropsForNodeType?.map((prop) => ({
        label: prop.name,
        renderValue: (d: T) => (
          <TruncatedText
            text={coerceToString(d[prop.name])}
            maxCharacters={20}
            disableInteractiveTooltip={false}
            arrow
            ellipsis
            underline
          />
        ),
        field: prop.name,
        default: prop.name === selectedNodeType?.IDPropName ? true : undefined,
        hideable: prop.name !== selectedNodeType?.IDPropName,
        defaultHidden: prop.required !== true,
      })) || [],
    [selectedNodeType?.IDPropName, nodeProps?.retrievePropsForNodeType]
  );

  const { visibleColumns, columnVisibilityModel, setColumnVisibilityModel } = useColumnVisibility<
    Column<T>
  >({
    columns,
    getColumnKey: (c) => c.field,
    localStorageKey: columnVisibilityKey,
  });

  const handleFetchData = useCallback(
    async (params: FetchListing<T>, force: boolean) => {
      const { offset, first } = params;

      // NOTE: This is a workaround to stabilize the number of API calls when switching between node types
      // It will override the previous orderBy if the node type changes
      if (prevFiltersRef.current?.nodeType !== filtersRef.current?.nodeType) {
        params.orderBy = nodesData?.getReleaseNodeTypes?.nodes?.find(
          (node) => node.name === filtersRef.current?.nodeType
        )?.IDPropName;
        params.sortDirection = "asc";
      }

      setLoading(true);
      const { data, error } = await listReleasedDataRecords({
        variables: {
          studyId,
          dataCommonsDisplayName,
          nodeType: filtersRef.current?.nodeType,
          orderBy: params.orderBy,
          sortDirection: params.sortDirection,
          offset,
          first,
        },
      });

      if (error) {
        Logger.error(
          "Error occurred while fetching released records for node",
          filtersRef?.current?.nodeType,
          error
        );
        setLoading(false);
        return;
      }

      setData(data?.listReleasedDataRecords?.nodes || []);
      setTotalData(data?.listReleasedDataRecords?.total || 0);
      prevFiltersRef.current = cloneDeep(filtersRef.current);
      setLoading(false);
    },
    [
      studyId,
      nodesData?.getReleaseNodeTypes?.nodes,
      dataCommonsDisplayName,
      filtersRef.current,
      prevFiltersRef.current,
      listReleasedDataRecords,
    ]
  );

  const handleFilterChange = useCallback(
    (data: FilterForm) => {
      filtersRef.current = data;
      tableRef.current?.setPage(0, true);
    },
    [filtersRef.current, tableRef.current]
  );

  const handleSetItemKey = useCallback(
    (d: T, idx: number) => `data-${d?.[selectedNodeType?.IDPropName] || idx}`,
    [columns, selectedNodeType?.IDPropName]
  );

  const handleGetColumnGroup = useCallback(
    (column: Column<T>) => {
      const prop = nodeProps?.retrievePropsForNodeType.find((p) => p.name === column.field);
      switch (prop?.group) {
        case "not_defined":
          return "Others";
        case "internal":
          return "Internal";
        case "model_defined":
        default:
          return "Data Model Defined";
      }
    },
    [nodeProps?.retrievePropsForNodeType]
  );

  const handleGetColumnKey = useCallback((column: Column<T>) => column.field, []);

  const handleGetColumnLabel = useCallback((column: Column<T>) => column.label?.toString(), []);

  const columnGroups = useMemo<ColumnVisibilityPopperGroup[]>(
    () => [
      {
        name: "Data Model Defined",
        description: "Fields defined in the data model and submitted by users.",
      },
      {
        name: "Others",
        description: "Additional fields not included in the data model and submitted by users.",
      },
      {
        name: "Internal",
        description: "Fields automatically created by the system.",
      },
    ],
    []
  );

  const filterActions = useMemo<React.ReactNode[]>(
    () => [
      <ColumnVisibilityButton
        key="column-visibility-action"
        columns={columns}
        groups={columnGroups}
        getColumnKey={handleGetColumnKey}
        getColumnLabel={handleGetColumnLabel}
        getColumnGroup={handleGetColumnGroup}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        data-testid="column-visibility-button"
      />,
      <DataExplorerStudyExport
        key="export-data-action"
        studyId={studyId}
        studyDisplayName={studyDisplayName}
        nodeType={filtersRef.current?.nodeType || ""}
        dataCommonsDisplayName={dataCommonsDisplayName || ""}
        columns={visibleColumns}
      />,
    ],
    [
      studyId,
      columns,
      columnGroups,
      columnVisibilityModel,
      filtersRef?.current?.nodeType,
      dataCommonsDisplayName,
      setColumnVisibilityModel,
      handleGetColumnGroup,
      handleGetColumnKey,
      handleGetColumnLabel,
    ]
  );

  if (studyLoading || nodesLoading) {
    return <SuspenseLoader fullscreen data-testid="study-view-loader" />;
  }

  if (!dataCommonsDisplayName || !studyData?.getApprovedStudy?._id || !nodeTypeOptions?.length) {
    return (
      <Navigate
        to="/data-explorer"
        state={{
          alert: true,
          error: "Oops! Unable to display metadata for the selected study or data commons.",
        }}
      />
    );
  }

  return (
    <Box data-testid="study-view-container">
      {/* Page Breadcrumbs */}
      <StyledBreadcrumbsBox>
        <NavigationBreadcrumbs entries={breadcrumbs} />
      </StyledBreadcrumbsBox>

      {/* Page Header, Filters, & Table */}
      <PageContainer
        background={bannerPng}
        title="Data Explorer for Study - "
        titleSuffix={studyDisplayName}
        description="Select a node type to view metadata associated with the selected study. The table below displays all available metadata for the chosen node type."
      >
        <StyledFilterTableWrapper>
          <DataExplorerFilters
            nodeTypes={nodeTypeOptions}
            defaultValues={defaultValues}
            onChange={handleFilterChange}
            actions={filterActions}
          />

          <GenericTable
            ref={tableRef}
            columns={visibleColumns}
            data={data}
            total={totalData}
            loading={loading || nodePropsLoading}
            delayedLoadingTimeMs={0}
            defaultRowsPerPage={20}
            defaultOrder="asc"
            disableUrlParams
            position="bottom"
            onFetchData={handleFetchData}
            setItemKey={handleSetItemKey}
            containerProps={{
              sx: {
                minHeight: "175px",
                marginBottom: "8px",
                border: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              },
            }}
          />
        </StyledFilterTableWrapper>
      </PageContainer>
    </Box>
  );
};

export default memo<StudyViewProps>(StudyView);
