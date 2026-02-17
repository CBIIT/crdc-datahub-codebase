import { useLazyQuery } from "@apollo/client";
import { Box, Button, Container, Stack, styled, TableCell, TableHead } from "@mui/material";
import { isEqual } from "lodash";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import FormAlert from "../../components/FormAlert";
import GenericTable, { Column } from "../../components/GenericTable";
import InstitutionListFilters, { FilterForm } from "../../components/InstitutionListFilters";
import PageBanner from "../../components/PageBanner";
import PageBannerBody from "../../components/PageBanner/PageBannerBody";
import TruncatedText from "../../components/TruncatedText";
import { LIST_INSTITUTIONS, ListInstitutionsInput, ListInstitutionsResp } from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";

const StyledContainer = styled(Container)({
  marginTop: "-180px",
  paddingBottom: "90px",
});

const StyledTableHead = styled(TableHead)({
  background: "#083A50",
});

const StyledHeaderCell = styled(TableCell)({
  fontWeight: 700,
  fontSize: "14px",
  color: "#fff !important",
  "&.MuiTableCell-root": {
    padding: "8px 16px",
    color: "#fff !important",
  },
  "& .MuiSvgIcon-root,  & .MuiButtonBase-root": {
    color: "#fff !important",
  },
});

const StyledTableCell = styled(TableCell)({
  fontSize: "14px",
  color: "#083A50 !important",
  textAlign: "left",
  "&.MuiTableCell-root": {
    padding: "8px 16px",
  },
});

const StyledLink = styled(Link)({
  textDecoration: "none",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  width: "100px",
});

const StyledActionButton = styled(Button)(
  ({ bg, text, border }: { bg: string; text: string; border: string }) => ({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: `${bg} !important`,
    borderRadius: "8px",
    border: `2px solid ${border}`,
    color: `${text} !important`,
    width: "100px",
    height: "30px",
    textTransform: "none",
    fontWeight: 700,
    fontSize: "16px",
  })
);

const columns: Column<Institution>[] = [
  {
    label: "Name",
    renderValue: (a) => <TruncatedText text={a.name} maxCharacters={60} />,
    field: "name",
    default: true,
  },
  {
    label: "Submitter Count",
    renderValue: (a) =>
      Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(a.submitterCount || 0),
    field: "submitterCount",
  },
  {
    label: "Status",
    renderValue: (a) => <TruncatedText text={a.status} />,
    field: "status",
    sx: {
      width: "100px",
    },
  },
  {
    label: (
      <Stack direction="row" justifyContent="center" alignItems="center">
        Action
      </Stack>
    ),
    renderValue: (a) => (
      <StyledLink to={`/institution/${a?._id}`}>
        <StyledActionButton bg="#C5EAF2" text="#156071" border="#84B4BE">
          Edit
        </StyledActionButton>
      </StyledLink>
    ),
    sortDisabled: true,
    sx: {
      width: "100px",
    },
  },
];

const ListView = () => {
  usePageTitle("Manage Institutions");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [data, setData] = useState<Institution[]>([]);
  const [count, setCount] = useState<number>(0);

  const filtersRef = useRef<FilterForm>({
    status: "All",
    name: "",
  });
  const tableRef = useRef<TableMethods>(null);

  const [listInstitutions] = useLazyQuery<ListInstitutionsResp, ListInstitutionsInput>(
    LIST_INSTITUTIONS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  const handleFetchData = async (fetchListing: FetchListing<Institution>, force: boolean) => {
    const { first, offset, sortDirection, orderBy } = fetchListing || {};

    if (!filtersRef.current) {
      return;
    }

    try {
      setLoading(true);

      const { data: d, error } = await listInstitutions({
        variables: {
          first,
          offset,
          sortDirection,
          orderBy,
          status: filtersRef.current.status,
          name: filtersRef.current.name,
        },
        context: { clientName: "backend" },
        fetchPolicy: "no-cache",
      });
      if (error || !d?.listInstitutions) {
        throw new Error("Unable to retrieve List Institutions results.");
      }

      setData(d.listInstitutions.institutions);
      setCount(d.listInstitutions.total);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOnFiltersChange = (data: FilterForm) => {
    if (isEqual(data, filtersRef.current)) {
      return;
    }

    filtersRef.current = data;
    setTablePage(0);
  };

  const setTablePage = (page: number) => {
    tableRef.current?.setPage(page, true);
  };

  return (
    <Box data-testid="list-institutions-container">
      <FormAlert error={error ? "An error occurred while loading the data." : null} />

      <PageBanner
        title="Manage Institutions"
        subTitle=""
        padding="38px 0 0 25px"
        body={<PageBannerBody label="Add Institution" to="/institution/new" />}
      />

      <StyledContainer maxWidth="xl">
        <InstitutionListFilters onChange={handleOnFiltersChange} />

        <GenericTable
          ref={tableRef}
          columns={columns}
          data={data || []}
          total={count || 0}
          loading={loading}
          disableUrlParams={false}
          defaultRowsPerPage={20}
          defaultOrder="asc"
          setItemKey={(item, idx) => `${idx}_${item._id}`}
          onFetchData={handleFetchData}
          containerProps={{ sx: { marginBottom: "8px", borderColor: "#083A50" } }}
          CustomTableHead={StyledTableHead}
          CustomTableHeaderCell={StyledHeaderCell}
          CustomTableBodyCell={StyledTableCell}
        />
      </StyledContainer>
    </Box>
  );
};

export default ListView;
