import { useLazyQuery } from "@apollo/client";
import { Alert, Container, Stack, styled, TableCell, TableHead, Box } from "@mui/material";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import React, { FC, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import DataSubmissionListExport from "@/components/ExportSubmissionsButton";

import bannerSvg from "../../assets/banner/submission_banner.png";
import { useAuthContext, Status as AuthStatus } from "../../components/Contexts/AuthContext";
import CreateDataSubmissionDialog from "../../components/DataSubmissions/CreateDataSubmissionDialog";
import DataSubmissionListFilters, {
  defaultValues,
  FilterForm,
} from "../../components/DataSubmissions/DataSubmissionListFilters";
import NavigatorLink from "../../components/DataSubmissions/NavigatorLink";
import GenericTable, { Column } from "../../components/GenericTable";
import PageBanner from "../../components/PageBanner";
import StyledTooltip from "../../components/StyledFormComponents/StyledTooltip";
import TruncatedText from "../../components/TruncatedText";
import { LIST_SUBMISSIONS, ListSubmissionsInput, ListSubmissionsResp } from "../../graphql";
import { useColumnVisibility } from "../../hooks/useColumnVisibility";
import usePageTitle from "../../hooks/usePageTitle";
import { FormatDate, Logger } from "../../utils";

type T = ListSubmissionsResp["listSubmissions"]["submissions"][number];

const StyledBannerBody = styled(Stack)({
  marginTop: "-20px",
});

const StyledContainer = styled(Container)({
  marginTop: "-62px",
});

const StyledTableHead = styled(TableHead)({
  background: "#083A50",
  borderTop: "1px solid #6B7294",
  borderBottom: "1px solid #6B7294",
});

const StyledHeaderCell = styled(TableCell)({
  fontWeight: 700,
  fontSize: "14px",
  lineHeight: "16px",
  color: "#fff !important",
  "&.MuiTableCell-root": {
    padding: "15px 4px 17px",
    color: "#fff !important",
    // whiteSpace: "nowrap",
  },
  "& .MuiSvgIcon-root, & .MuiButtonBase-root": {
    color: "#fff !important",
  },
  "& .MuiSvgIcon-root": {
    marginRight: 0,
  },
  "&:last-of-type": {
    paddingRight: "4px",
  },
});

const StyledTableCell = styled(TableCell)({
  fontSize: "14px",
  color: "#083A50 !important",
  "&.MuiTableCell-root": {
    padding: "14px 4px 12px",
    overflowWrap: "anywhere",
    whiteSpace: "nowrap",
  },
  "&:last-of-type": {
    paddingRight: "4px",
  },
});

const StyledFilterTableWrapper = styled(Box)({
  borderRadius: "8px",
  background: "#FFF",
  border: "1px solid #6CACDA",
  marginBottom: "25px",
});

const StyledDisabledText = styled(Box)(({ theme }) => ({
  color: theme.palette.text.disabled,
}));

const StyledDateTooltip = styled(StyledTooltip)(() => ({
  cursor: "pointer",
}));

const columns: Column<T>[] = [
  {
    label: "Submission Name",
    renderValue: (a) =>
      a.status === "Deleted" || a.archived === true ? (
        <StyledDisabledText>
          <TruncatedText text={a.name} />
        </StyledDisabledText>
      ) : (
        <Link to={`/data-submission/${a._id}/upload-activity`}>
          <TruncatedText text={a.name} underline={false} />
        </Link>
      ),
    field: "name",
    hideable: false,
    exportValue: (a) => ({ label: "Submission Name", value: a.name }),
    sx: {
      width: "139px",
    },
  },
  {
    label: "Submitter",
    renderValue: (a) => <TruncatedText text={a.submitterName} />,
    field: "submitterName",
    hideable: true,
    exportValue: (a) => ({ label: "Submitter", value: a.submitterName }),
    sx: {
      width: "102px",
    },
  },
  {
    label: "Data Commons",
    renderValue: (a) => a.dataCommonsDisplayName,
    field: "dataCommonsDisplayName",
    hideable: true,
    exportValue: (a) => ({ label: "Data Commons", value: a.dataCommonsDisplayName }),
    sx: {
      width: "94px",
    },
  },
  {
    label: "Type",
    renderValue: (a) => a.intention,
    field: "intention",
    hideable: true,
    exportValue: (a) => ({ label: "Type", value: a.intention }),
    sx: {
      width: "96px",
    },
  },
  {
    label: "Model Version",
    renderValue: (a) => <NavigatorLink submission={a} />,
    field: "modelVersion",
    hideable: true,
    exportValue: (a) => ({ label: "Model Version", value: a.modelVersion }),
    sx: {
      width: "79px",
    },
  },
  {
    label: "Program",
    renderValue: (a) => <TruncatedText text={a.organization?.name ?? "NA"} />,
    fieldKey: "organization.name",
    exportValue: (a) => ({ label: "Program", value: a.organization?.name ?? "NA" }),
  },
  {
    label: "Study",
    renderValue: (a) => <TruncatedText text={a.studyAbbreviation} />,
    field: "studyAbbreviation",
    hideable: false,
    exportValue: (a) => ({ label: "Study", value: a.studyAbbreviation }),
  },

  {
    label: "dbGaP ID",
    renderValue: (a) => <TruncatedText text={a.dbGaPID} maxCharacters={15} />,
    field: "dbGaPID",
    hideable: true,
    exportValue: (a) => ({ label: "dbGaP ID", value: a.dbGaPID }),
  },

  {
    label: "Status",
    renderValue: (a) =>
      a.status === "Released" && a.dataCommonsDisplayName ? (
        <StyledTooltip title={`Released to ${a.dataCommonsDisplayName}`} placement="top" arrow>
          <span>{a.status}</span>
        </StyledTooltip>
      ) : (
        a.status
      ),
    field: "status",
    hideable: false,
    exportValue: (a) => ({ label: "Status", value: a.status }),
    sx: {
      width: "87px",
    },
  },
  {
    label: "Data Concierge",
    renderValue: (a) => <TruncatedText text={a.conciergeName} />,
    field: "conciergeName",
    hideable: true,
    exportValue: (a) => ({ label: "Data Concierge", value: a.conciergeName }),
  },
  {
    label: "Record Count",
    renderValue: (a) =>
      Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a.nodeCount || 0),
    field: "nodeCount",
    exportValue: (a) => ({
      label: "Record Count",
      value: Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a.nodeCount || 0),
    }),
  },
  {
    label: "Data File Size",
    renderValue: (a) => a.dataFileSize.formatted || 0,
    hideable: true,
    defaultHidden: true,
    fieldKey: "dataFileSize.size",
    exportValue: (a) => ({ label: "Data File Size", value: a.dataFileSize.formatted || 0 }),
    sx: {
      minWidth: "90px",
      width: "90px",
    },
  },
  {
    label: "Created Date",
    renderValue: (a) =>
      a.createdAt ? (
        <StyledDateTooltip title={FormatDate(a.createdAt, "M/D/YYYY h:mm A")} placement="top">
          <span>{FormatDate(a.createdAt, "M/D/YYYY")}</span>
        </StyledDateTooltip>
      ) : (
        ""
      ),
    field: "createdAt",
    hideable: true,
    exportValue: (a) => ({
      label: "Created Date",
      value: a.createdAt ? FormatDate(a.createdAt, "M/D/YYYY h:mm A") : "",
    }),
    sx: {
      width: "92px",
    },
  },
  {
    label: "Last Updated",
    renderValue: (a) =>
      a.updatedAt ? (
        <StyledDateTooltip title={FormatDate(a.updatedAt, "M/D/YYYY h:mm A")} placement="top">
          <span>{FormatDate(a.updatedAt, "M/D/YYYY")}</span>
        </StyledDateTooltip>
      ) : (
        ""
      ),
    field: "updatedAt",
    hideable: true,
    default: true,
    exportValue: (a) => ({
      label: "Last Updated",
      value: a.updatedAt ? FormatDate(a.updatedAt, "M/D/YYYY h:mm A") : "",
    }),
    sx: {
      width: "108px",
    },
  },
];

/**
 * View for List of Data Submissions
 *
 * @returns {JSX.Element}
 */
const ListingView: FC = () => {
  usePageTitle("Data Submissions");

  const { state } = useLocation();
  const { status: authStatus } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();

  const { columnVisibilityModel, setColumnVisibilityModel, visibleColumns } = useColumnVisibility<
    Column<T>
  >({
    columns,
    getColumnKey: (c) => c.fieldKey ?? c.field,
    localStorageKey: "dataSubmissionListColumns",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [data, setData] = useState<T[]>([]);
  const [organizations, setOrganizations] = useState<Pick<Organization, "_id" | "name">[]>([]);
  const [submitterNames, setSubmitterNames] = useState<string[]>([]);
  const [dataCommons, setDataCommons] = useState<string[]>([]);
  const [dataCommonsDisplayNames, setDataCommonsDisplayNames] = useState<string[]>([]);
  const [totalData, setTotalData] = useState<number>(0);
  const tableRef = useRef<TableMethods>(null);
  const filtersRef = useRef<FilterForm>({ ...defaultValues });

  const [listSubmissions, { refetch }] = useLazyQuery<ListSubmissionsResp, ListSubmissionsInput>(
    LIST_SUBMISSIONS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  const handleFetchData = async (fetchListing: FetchListing<T>, force: boolean) => {
    const { first, offset, sortDirection, orderBy } = fetchListing || {};
    try {
      setLoading(true);

      if (!filtersRef.current) {
        return;
      }

      const {
        organization,
        status,
        submitterName,
        name,
        dbGaPID,
        dataCommons: dc,
      } = filtersRef.current;

      const { data: d, error } = await listSubmissions({
        variables: {
          organization: organization ?? "All",
          status,
          dataCommons: dc ?? "All",
          submitterName: submitterName ?? "All",
          name: name || undefined,
          dbGaPID: dbGaPID || undefined,
          first,
          offset,
          sortDirection,
          orderBy,
        },
        context: { clientName: "backend" },
        fetchPolicy: "no-cache",
      });
      if (error || !d?.listSubmissions) {
        throw new Error("Unable to retrieve Data Submission results.");
      }

      setData(d.listSubmissions.submissions);
      setOrganizations(
        d.listSubmissions.organizations
          ?.filter((org) => !!org?.name?.trim())
          ?.sort((a, b) => a.name?.localeCompare(b?.name))
      );
      setSubmitterNames(d.listSubmissions.submitterNames?.filter((sn) => !!sn.trim()));
      setDataCommons(d.listSubmissions.dataCommons?.filter((dc) => !!dc.trim()));
      setDataCommonsDisplayNames(
        d.listSubmissions.dataCommonsDisplayNames?.filter((dc) => !!dc.trim())
      );
      setTotalData(d.listSubmissions.total);
    } catch (err) {
      Logger.error("Error while fetching Data Submissions", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const setTablePage = (page: number) => {
    tableRef.current?.setPage(page, true);
  };

  const handleOnCreateSubmission = async () => {
    try {
      setLoading(true);

      const { data: d } = await refetch();
      if (error || !d?.listSubmissions) {
        throw new Error("Unable to retrieve Data Submission results.");
      }
      setData(d.listSubmissions.submissions);
      setOrganizations(
        d.listSubmissions.organizations
          ?.filter((org) => !!org?.name?.trim())
          ?.sort((a, b) => a.name?.localeCompare(b?.name))
      );
      setSubmitterNames(d.listSubmissions.submitterNames?.filter((sn) => !!sn.trim()));
      setDataCommons(d.listSubmissions.dataCommons?.filter((dc) => !!dc.trim()));
      setDataCommonsDisplayNames(
        d.listSubmissions.dataCommonsDisplayNames?.filter((dc) => !!dc.trim())
      );
      setTotalData(d.listSubmissions.total);
    } catch (err) {
      Logger.error("Error updating the Data Submissions", err);
      setError(true);
    } finally {
      setLoading(false);
    }

    enqueueSnackbar("Data Submission Created Successfully", {
      variant: "success",
    });
  };

  const handleOnFiltersChange = (data: FilterForm) => {
    if (isEqual(data, filtersRef.current)) {
      return;
    }

    filtersRef.current = { ...data };
    setTablePage(0);
  };
  const Actions = useMemo<React.ReactNode>(() => {
    const scope = {
      ...filtersRef.current,
      ...tableRef.current?.tableParams,
    };

    return (
      <DataSubmissionListExport
        scope={scope}
        hasData={totalData > 0}
        visibleColumns={visibleColumns}
      />
    );
  }, [filtersRef.current, tableRef.current?.tableParams, totalData, visibleColumns]);

  return (
    <>
      <PageBanner
        title="Data Submissions"
        subTitle="Below is a list of data submissions that are associated with your account. Please click on any of the data submissions to review or continue work."
        padding="57px 0 0 25px"
        body={
          <StyledBannerBody direction="row" alignItems="center" justifyContent="flex-end">
            <CreateDataSubmissionDialog onCreate={handleOnCreateSubmission} />
          </StyledBannerBody>
        }
        bannerSrc={bannerSvg}
      />
      <StyledContainer maxWidth="xl">
        {(state?.error || error) && (
          <Alert sx={{ mb: 3, p: 2 }} severity="error">
            {state?.error || "An error occurred while loading the data."}
          </Alert>
        )}
        <StyledFilterTableWrapper>
          <DataSubmissionListFilters
            columns={columns}
            organizations={organizations}
            submitterNames={submitterNames}
            dataCommons={dataCommons}
            dataCommonsDisplayNames={dataCommonsDisplayNames}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            onChange={handleOnFiltersChange}
          />

          <GenericTable
            ref={tableRef}
            columns={visibleColumns}
            data={data || []}
            total={totalData || 0}
            loading={loading || authStatus === AuthStatus.LOADING}
            defaultRowsPerPage={20}
            defaultOrder="desc"
            disableUrlParams={false}
            position="both"
            noContentText="You either do not have the appropriate permissions to view data submissions, or there are no data submissions associated with your account."
            onFetchData={handleFetchData}
            containerProps={{
              sx: {
                marginBottom: "8px",
                border: 0,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                borderTop: "1px solid #6CACDA",
              },
            }}
            AdditionalActions={{
              top: { after: Actions },
              bottom: { after: Actions },
            }}
            CustomTableHead={StyledTableHead}
            CustomTableHeaderCell={StyledHeaderCell}
            CustomTableBodyCell={StyledTableCell}
          />
        </StyledFilterTableWrapper>
      </StyledContainer>
    </>
  );
};

export default ListingView;
