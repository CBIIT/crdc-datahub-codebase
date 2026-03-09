import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  MenuItem,
  Stack,
  TableCell,
  TableHead,
  styled,
} from "@mui/material";
import { ElementType, FC, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, LinkProps, useLocation } from "react-router-dom";

import {
  useOrganizationListContext,
  Status as OrgStatus,
} from "../../components/Contexts/OrganizationListContext";
import { useSearchParamsContext } from "../../components/Contexts/SearchParamsContext";
import GenericTable, { Column } from "../../components/GenericTable";
import PageBanner from "../../components/PageBanner";
import StudyList from "../../components/StudyList";
import StyledTextField from "../../components/StyledFormComponents/StyledOutlinedInput";
import StyledSelect from "../../components/StyledFormComponents/StyledSelect";
import TruncatedText from "../../components/TruncatedText";
import type { ListOrgsResp } from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";
import { sortData } from "../../utils";

type T = ListOrgsResp["listPrograms"]["programs"][number];

type FilterForm = {
  organization: string;
  study: string;
  status: Organization["status"] | "All";
};

const StyledContainer = styled(Container)({
  marginTop: "-180px",
  paddingBottom: "90px",
});

const StyledButton = styled(Button)<{ component: ElementType } & LinkProps>({
  padding: "14px 20px",
  fontWeight: 700,
  fontSize: "16px",
  letterSpacing: "2%",
  lineHeight: "20.14px",
  borderRadius: "8px",
  color: "#fff",
  textTransform: "none",
  borderColor: "#26B893 !important",
  background: "#1B8369 !important",
  marginRight: "25px",
});

const StyledBannerBody = styled(Stack)({
  marginTop: "-53px",
});

const StyledFilterContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingBottom: "10px",
});

const StyledTableHead = styled(TableHead)({
  background: "#083A50",
});

const StyledFormControl = styled(FormControl)({
  margin: "10px",
  marginRight: "15px",
  minWidth: "250px",
});

const StyledInlineLabel = styled("label")({
  padding: "0 10px",
  fontWeight: "700",
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
  "&:last-of-type": {
    textAlign: "center",
  },
});

const StyledTableCell = styled(TableCell)({
  fontSize: "14px",
  color: "#083A50 !important",
  "&.MuiTableCell-root": {
    padding: "8px 16px",
  },
  "&:last-of-type": {
    textAlign: "center",
  },
});

const StyledActionButton = styled(Button)(
  ({ bg, text, border }: { bg: string; text: string; border: string }) => ({
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

type TouchedState = { [K in keyof FilterForm]: boolean };

const initialTouchedFields: TouchedState = {
  organization: false,
  study: false,
  status: false,
};

const columns: Column<T>[] = [
  {
    label: "Name",
    renderValue: (a) => <TruncatedText text={a.name} maxCharacters={30} />,
    comparator: (a, b) => a.name.localeCompare(b.name),
    field: "name",
    default: true,
    sx: {
      width: "356px",
    },
  },
  {
    label: "Data Concierge",
    renderValue: (a) => <TruncatedText text={a.conciergeName} maxCharacters={15} />,
    comparator: (a, b) => (a?.conciergeName || "").localeCompare(b?.conciergeName || ""),
    field: "conciergeName",
    sx: {
      width: "290px",
    },
  },
  {
    label: "Studies",
    renderValue: ({ studies }) => {
      if (!studies || studies?.length < 1) {
        return "";
      }

      return (
        <StudyList
          studies={studies}
          emptyText=""
          renderStudy={(s) => (
            <TruncatedText text={s?.studyAbbreviation || s?.studyName} maxCharacters={37} />
          )}
        />
      );
    },
    field: "studies",
    sortDisabled: true,
  },
  {
    label: "Status",
    renderValue: (a) => a.status,
    comparator: (a, b) => (a?.status || "").localeCompare(b?.status || ""),
    field: "status",
    sx: {
      width: "100px",
    },
  },
  {
    label: "Action",
    renderValue: (a) => (
      <Link to={`/programs/${a?._id}`}>
        <StyledActionButton bg="#C5EAF2" text="#156071" border="#84B4BE">
          Edit
        </StyledActionButton>
      </Link>
    ),
    sortDisabled: true,
    sx: {
      width: "100px",
    },
  },
];

/**
 * A view for the list of Programs.
 *
 * @returns The ListView component
 */
const ListView: FC = () => {
  usePageTitle("Manage Programs");

  const { state } = useLocation();
  const { data, status: orgStatus } = useOrganizationListContext();
  const { searchParams, setSearchParams } = useSearchParamsContext();
  const { watch, register, control, setValue } = useForm<FilterForm>({
    defaultValues: {
      organization: "",
      study: "",
      status: "Active",
    },
  });

  const [dataset, setDataset] = useState<T[]>([]);
  const [count, setCount] = useState<number>(0);
  const [touchedFilters, setTouchedFilters] = useState<TouchedState>(initialTouchedFields);

  const orgFilter = watch("organization");
  const studyFilter = watch("study");
  const statusFilter = watch("status");
  const tableRef = useRef<TableMethods>(null);

  const handleFetchData = async (fetchListing: FetchListing<T>, force: boolean) => {
    const { first, offset, sortDirection, orderBy, comparator } = fetchListing || {};

    if (!data?.length) {
      setDataset([]);
      setCount(0);
      return;
    }

    const filters: FilterFunction<T>[] = [
      (u: T) => {
        if (!orgFilter || orgFilter.trim().length < 1) {
          return true;
        }

        const nameMatch = u.name.toLowerCase().indexOf(orgFilter.toLowerCase()) !== -1;
        const abbrMatch = u.abbreviation
          ? u.abbreviation.toLowerCase().indexOf(orgFilter.toLowerCase()) !== -1
          : false;

        return nameMatch || abbrMatch;
      },
      (u: T) => (statusFilter && statusFilter !== "All" ? u.status === statusFilter : true),
      (u: T) => {
        if (!studyFilter || studyFilter.trim().length < 1) {
          return true;
        }

        const nameMatch = u?.studies?.some(
          (s) => s.studyName.toLowerCase().indexOf(studyFilter.toLowerCase()) !== -1
        );
        const abbrMatch = u?.studies?.some(
          (s) => s.studyAbbreviation.toLowerCase().indexOf(studyFilter.toLowerCase()) !== -1
        );

        return nameMatch || abbrMatch;
      },
    ];

    const filteredData = data.filter((u) => filters.every((filter) => filter(u)));
    const sortedData = sortData(filteredData, orderBy, sortDirection, comparator);
    const paginatedData = sortedData.slice(offset, first + offset);

    setCount(sortedData?.length);
    setDataset(paginatedData);
  };

  const isStatusFilterOption = (status: string): status is FilterForm["status"] =>
    ["All", "Inactive", "Active"].includes(status);

  useEffect(() => {
    if (!data?.length) {
      return;
    }

    const organizationId = searchParams.get("organization") || "";
    const study = searchParams.get("study") || "";
    const status = searchParams.get("status");

    if (organizationId !== orgFilter) {
      setValue("organization", organizationId);
    }
    if (study !== studyFilter) {
      setValue("study", study);
    }
    if (isStatusFilterOption(status) && status !== statusFilter) {
      setValue("status", status);
    }

    setTablePage(0);
  }, [
    data,
    searchParams.get("organization"),
    searchParams.get("study"),
    searchParams.get("status"),
  ]);

  useEffect(() => {
    if (!touchedFilters.organization && !touchedFilters.study && !touchedFilters.status) {
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);

    if (orgFilter) {
      newSearchParams.set("organization", orgFilter);
    } else {
      newSearchParams.delete("organization");
    }
    if (studyFilter) {
      newSearchParams.set("study", studyFilter);
    } else {
      newSearchParams.delete("study");
    }
    if (statusFilter && statusFilter !== "Active") {
      newSearchParams.set("status", statusFilter);
    } else if (statusFilter === "Active") {
      newSearchParams.delete("status");
    }

    if (newSearchParams?.toString() !== searchParams?.toString()) {
      setSearchParams(newSearchParams);
    }
  }, [orgFilter, studyFilter, statusFilter]);

  const setTablePage = (page: number) => {
    tableRef.current?.setPage(page, true);
  };

  const handleFilterChange = (field: keyof FilterForm) => {
    setTouchedFilters((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <>
      <Container maxWidth="xl">
        {(state?.error || orgStatus === OrgStatus.ERROR) && (
          <Alert sx={{ mt: 2, mx: "auto", p: 2 }} severity="error">
            {state?.error || "An error occurred while loading the data."}
          </Alert>
        )}
      </Container>

      <PageBanner
        title="Manage Programs"
        subTitle=""
        padding="38px 0 0 25px"
        body={
          <StyledBannerBody direction="row" alignItems="center" justifyContent="flex-end">
            <StyledButton component={Link} to="/programs/new">
              Add Program
            </StyledButton>
          </StyledBannerBody>
        }
      />

      <StyledContainer maxWidth="xl">
        <StyledFilterContainer>
          <StyledInlineLabel htmlFor="organization-filter">Program</StyledInlineLabel>
          <StyledFormControl>
            <StyledTextField
              {...register("organization", {
                onChange: (e) => handleFilterChange("organization"),
                setValueAs: (val) => val?.trim(),
              })}
              placeholder="Enter a Program"
              id="organization-filter"
              required
            />
          </StyledFormControl>
          <StyledInlineLabel htmlFor="study-filter">Study</StyledInlineLabel>
          <StyledFormControl>
            <StyledTextField
              {...register("study", {
                onChange: (e) => handleFilterChange("study"),
                setValueAs: (val) => val?.trim(),
              })}
              placeholder="Enter a Study"
              id="study-filter"
              required
            />
          </StyledFormControl>
          <StyledInlineLabel htmlFor="status-filter">Status</StyledInlineLabel>
          <StyledFormControl>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  value={field.value}
                  MenuProps={{ disablePortal: true }}
                  inputProps={{ id: "status-filter" }}
                  onChange={(e) => {
                    field.onChange(e);
                    handleFilterChange("status");
                  }}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </StyledSelect>
              )}
            />
          </StyledFormControl>
        </StyledFilterContainer>
        <GenericTable
          ref={tableRef}
          columns={columns}
          data={dataset || []}
          total={count || 0}
          loading={orgStatus === OrgStatus.LOADING}
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
    </>
  );
};

export default ListView;
