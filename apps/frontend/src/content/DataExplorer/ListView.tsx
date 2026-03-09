import { useLazyQuery } from "@apollo/client";
import { Box, Container, styled, TableCell, TableHead } from "@mui/material";
import { isEqual } from "lodash";
import { useMemo, useRef, useState } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";

import bannerSvg from "../../assets/banner/submission_banner.png";
import { Status as AuthStatus, useAuthContext } from "../../components/Contexts/AuthContext";
import DataExplorerListContext from "../../components/Contexts/DataExplorerListContext";
import DataExplorerDCSelectionDialog, {
  InputForm,
} from "../../components/DataExplorerDCSelectionDialog";
import FormAlert from "../../components/FormAlert";
import GenericTable, { Column } from "../../components/GenericTable";
import PageBanner from "../../components/PageBanner";
import TruncatedText from "../../components/TruncatedText";
import {
  LIST_RELEASED_STUDIES,
  ListReleasedStudiesInput,
  ListReleasedStudiesResp,
} from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";
import { Logger } from "../../utils";

import ListFilters, { defaultValues, FilterForm } from "./ListFilters";

const StyledWrapper = styled(Box)({
  marginTop: "-62px",
});

const StyledContainer = styled(Container)({
  marginTop: 0,
});

const StyledFormAlert = styled(FormAlert)({
  marginBottom: "24px",
});

const StyledFilterTableWrapper = styled(Box)({
  borderRadius: "8px",
  background: "#FFF",
  border: "1px solid #6CACDA",
  marginBottom: "25px",
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

const StyledStudyAbbreviation = styled(Box)({
  display: "inline-block",
  color: "#0000ee",
  cursor: "pointer",
  textDecoration: "underline",
});

const columns: Column<T>[] = [
  {
    label: "Study Abbreviation",
    renderValue: (a) => (
      <DataExplorerListContext.Consumer>
        {({ handleClickStudyAbbreviation }) => (
          <StyledStudyAbbreviation onClick={() => handleClickStudyAbbreviation(a)}>
            <TruncatedText text={a.studyAbbreviation} maxCharacters={40} underline={false} />
          </StyledStudyAbbreviation>
        )}
      </DataExplorerListContext.Consumer>
    ),
    field: "studyAbbreviation",
  },
  {
    label: "Study Name",
    renderValue: (a) => <TruncatedText text={a.studyName} maxCharacters={40} />,
    field: "studyName",
  },
  {
    label: "Data Commons",
    renderValue: (a) => (
      <TruncatedText text={a.dataCommonsDisplayNames?.join(", ")} maxCharacters={40} />
    ),
    field: "dataCommonsDisplayNames",
  },
  {
    label: "dbGaP ID",
    renderValue: (a) => <TruncatedText text={a.dbGaPID} maxCharacters={30} />,
    field: "dbGaPID",
  },
];

type T = ListReleasedStudiesResp["listReleasedStudies"]["studies"][number];

const ListView = () => {
  usePageTitle("Data Explorer");
  const navigate = useNavigate();
  const { status: authStatus } = useAuthContext();

  const [data, setData] = useState<ListReleasedStudiesResp["listReleasedStudies"] | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [multipleDCDialog, setMultipleDCDialog] = useState<boolean>(false);
  const tableRef = useRef<TableMethods>(null);
  const filtersRef = useRef<FilterForm>({ ...defaultValues });
  const clickedStudyRef = useRef<ReleasedStudy | null>(null);

  const [listReleasedStudies] = useLazyQuery<ListReleasedStudiesResp, ListReleasedStudiesInput>(
    LIST_RELEASED_STUDIES,
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

      const { name, dbGaPID, dataCommonsDisplayNames: dc } = filtersRef.current || {};

      const { data: d, error } = await listReleasedStudies({
        variables: {
          name: name || undefined,
          dbGaPID: dbGaPID || undefined,
          dataCommonsDisplayNames: dc ? [dc] : ["All"],
          first,
          offset,
          sortDirection,
          orderBy,
        },
        context: { clientName: "backend" },
        fetchPolicy: "no-cache",
      });
      if (error || !d?.listReleasedStudies) {
        throw new Error("Unable to retrieve Data Explorer results.");
      }

      setData(d.listReleasedStudies);
    } catch (err) {
      Logger.error("Error while fetching Data Explorer data", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOnFiltersChange = (data: FilterForm) => {
    if (isEqual(data, filtersRef.current)) {
      return;
    }

    filtersRef.current = { ...data };
    setTablePage(0);
  };

  const setTablePage = (page: number) => {
    tableRef.current?.setPage(page, true);
  };

  const handleDCSelect = (form: InputForm) => {
    if (!form?.dataCommon || !clickedStudyRef.current?._id) {
      return;
    }

    navigate({
      pathname: `/data-explorer/${clickedStudyRef.current._id}`,
      search: createSearchParams({
        dataCommonsDisplayName: form.dataCommon,
      }).toString(),
    });
  };

  const handleClickStudyAbbreviation = (study: ReleasedStudy) => {
    if (!study?._id || !study?.dataCommonsDisplayNames?.length) {
      return;
    }
    if (study.dataCommonsDisplayNames.length <= 1) {
      navigate({
        pathname: `/data-explorer/${study._id}`,
        search: createSearchParams({
          dataCommonsDisplayName: study.dataCommonsDisplayNames[0],
        }).toString(),
      });
      return;
    }

    clickedStudyRef.current = study;
    setMultipleDCDialog(true);
  };

  const dataExplorerListContextValue = useMemo(
    () => ({
      handleClickStudyAbbreviation,
    }),
    [handleClickStudyAbbreviation]
  );

  return (
    <>
      <PageBanner
        title="Data Explorer"
        subTitle="The list below shows studies associated with your account. Select a study to view metadata that has already been released by a Data Commons."
        padding="57px 0 0 25px"
        bannerSrc={bannerSvg}
      />

      <StyledWrapper>
        <StyledFormAlert error={error ? "An error occurred while loading the data." : null} />

        <StyledContainer maxWidth="xl">
          <StyledFilterTableWrapper>
            <ListFilters
              dataCommonsDisplayNames={data?.dataCommonsDisplayNames || []}
              onChange={handleOnFiltersChange}
            />

            <DataExplorerListContext.Provider value={dataExplorerListContextValue}>
              <GenericTable
                ref={tableRef}
                columns={columns}
                data={data?.studies || []}
                total={data?.total || 0}
                loading={loading || authStatus === AuthStatus.LOADING}
                defaultRowsPerPage={20}
                defaultOrder="asc"
                disableUrlParams={false}
                position="bottom"
                noContentText="You either do not have the appropriate permissions to view released studies, or there are no studies associated with your account."
                onFetchData={handleFetchData}
                containerProps={{
                  sx: {
                    marginBottom: "8px",
                    border: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  },
                }}
                CustomTableHead={StyledTableHead}
                CustomTableHeaderCell={StyledHeaderCell}
                CustomTableBodyCell={StyledTableCell}
              />
            </DataExplorerListContext.Provider>
          </StyledFilterTableWrapper>
        </StyledContainer>
      </StyledWrapper>

      <DataExplorerDCSelectionDialog
        open={multipleDCDialog}
        dataCommons={clickedStudyRef.current?.dataCommonsDisplayNames || []}
        onSubmitForm={(form) => handleDCSelect(form)}
        onClose={() => setMultipleDCDialog(false)}
      />
    </>
  );
};

export default ListView;
