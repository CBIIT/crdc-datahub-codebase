import { useLazyQuery, useMutation } from "@apollo/client";
import { Alert, Container, Button, Stack, styled, TableCell, TableHead, Box } from "@mui/material";
import { isEqual } from "lodash";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ExportApplicationsButton, {
  ExportApplicationsButtonProps,
} from "@/components/ExportApplicationsButton";
import ExportTemplateButton from "@/components/ExportTemplateButton";

import bannerSvg from "../../assets/banner/submission_banner.png";
import BellIcon from "../../assets/icons/filled_bell_icon.svg?react";
import { useAuthContext, Status as AuthStatus } from "../../components/Contexts/AuthContext";
import CreateApplicationButton from "../../components/CreateApplicationButton";
import GenericTable, { Column } from "../../components/GenericTable";
import PageBanner from "../../components/PageBanner";
import StyledTooltip from "../../components/StyledFormComponents/StyledTooltip";
import TooltipList from "../../components/SummaryList/TooltipList";
import ToggleApplicationButton from "../../components/ToggleApplicationButton";
import Tooltip from "../../components/Tooltip";
import TruncatedText from "../../components/TruncatedText";
import { hasPermission } from "../../config/AuthPermissions";
import {
  LIST_APPLICATIONS,
  ListApplicationsInput,
  ListApplicationsResp,
  REVIEW_APP,
  ReviewAppInput,
  ReviewAppResp,
} from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";
import { extractVersion, FormatDate, Logger } from "../../utils";

import QuestionnaireContext from "./Contexts/QuestionnaireContext";
import ListFilters, { defaultValues, FilterForm } from "./ListFilters";

type T = ListApplicationsResp["listApplications"]["applications"][number];

const StyledBannerBody = styled(Stack)({
  marginTop: "-46px",
});

const StyledContainer = styled(Container)({
  marginTop: "-62px",
});

const StyledFilterTableWrapper = styled(Box)({
  borderRadius: "8px",
  background: "#FFF",
  border: "1px solid #6CACDA",
  marginBottom: "25px",
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

const StyledDateTooltip = styled(StyledTooltip)(() => ({
  cursor: "pointer",
}));

const StyledSpecialStatus = styled(Stack)({
  color: "#C94313",
  fontWeight: 600,
  cursor: "pointer",
});

const StyledBellIcon = styled(BellIcon)({
  width: "18px",
  marginLeft: "6px",
});

const columns: Column<T>[] = [
  {
    label: "Submitter Name",
    renderValue: (a) => <TruncatedText text={a.applicant?.applicantName} />,
    fieldKey: "applicant.applicantName",
  },
  {
    label: "Program",
    renderValue: (a) => (
      <TruncatedText text={a.programName || "NA"} disableInteractiveTooltip={false} />
    ),
    field: "programName",
  },
  {
    label: "Study",
    renderValue: (a) => (
      <TruncatedText text={a.studyAbbreviation || "NA"} disableInteractiveTooltip={false} />
    ),
    field: "studyAbbreviation",
  },
  {
    label: "Status",
    renderValue: ({ status, conditional, pendingConditions }) => {
      if (!conditional || !pendingConditions?.length || status !== "Approved") {
        return status;
      }

      return (
        <Tooltip
          title={<TooltipList data={pendingConditions} />}
          placement="top"
          open={undefined}
          disableHoverListener={false}
          arrow
        >
          <StyledSpecialStatus direction="row" alignItems="center">
            <span>{status}</span>
            <StyledBellIcon data-testid="pending-conditions-icon" />
          </StyledSpecialStatus>
        </Tooltip>
      );
    },
    field: "status",
    sx: {
      width: "124px",
    },
  },
  {
    label: "Version",
    renderValue: (a) => extractVersion(a.version) || "",
    field: "version",
  },
  {
    label: "Submitted Date",
    renderValue: (a) =>
      a.submittedDate ? (
        <StyledDateTooltip title={FormatDate(a.submittedDate, "M/D/YYYY h:mm A")} placement="top">
          <span>{FormatDate(a.submittedDate, "M/D/YYYY")}</span>
        </StyledDateTooltip>
      ) : (
        ""
      ),
    field: "submittedDate",
    default: true,
    sx: {
      width: "161px",
    },
  },
  {
    label: "Last Updated Date",
    renderValue: (a) =>
      a.updatedAt ? (
        <StyledDateTooltip title={FormatDate(a.updatedAt, "M/D/YYYY h:mm A")} placement="top">
          <span>{FormatDate(a.updatedAt, "M/D/YYYY")}</span>
        </StyledDateTooltip>
      ) : (
        ""
      ),
    field: "updatedAt",
    sx: {
      width: "181px",
    },
  },
  {
    label: "Action",
    renderValue: (a) => (
      <QuestionnaireContext.Consumer>
        {({ user, handleOnReviewClick }) => {
          if (
            hasPermission(user, "submission_request", "create") &&
            a.applicant?.applicantID === user._id &&
            ["New", "In Progress", "Inquired"].includes(a.status)
          ) {
            return (
              <Link to={`/submission-request/${a?._id}`} state={{ from: "/submission-requests" }}>
                <StyledActionButton bg="#99E3BB" text="#156071" border="#63BA90">
                  Resume
                </StyledActionButton>
              </Link>
            );
          }
          if (
            hasPermission(user, "submission_request", "review") &&
            ["Submitted", "In Review"].includes(a.status)
          ) {
            return (
              <StyledActionButton
                onClick={() => handleOnReviewClick(a)}
                bg="#F1C6B3"
                text="#5F564D"
                border="#DB9C62"
              >
                Review
              </StyledActionButton>
            );
          }

          return (
            <Link to={`/submission-request/${a?._id}`} state={{ from: "/submission-requests" }}>
              <StyledActionButton bg="#89DDE6" text="#156071" border="#84B4BE">
                View
              </StyledActionButton>
            </Link>
          );
        }}
      </QuestionnaireContext.Consumer>
    ),
    sortDisabled: true,
    sx: {
      width: "140px",
      textAlign: "center",
    },
  },
  {
    label: "",
    fieldKey: "secondary-action",
    renderValue: (a) => (
      <QuestionnaireContext.Consumer>
        {({ tableRef }) => (
          <ToggleApplicationButton application={a} onCancel={() => tableRef.current?.refresh?.()} />
        )}
      </QuestionnaireContext.Consumer>
    ),
    sortDisabled: true,
    sx: {
      width: "0px",
    },
  },
];

/**
 * View for List of Submission Requests
 *
 * @returns {JSX.Element}
 */
const ListingView: FC = () => {
  usePageTitle("Submission Requests");

  const navigate = useNavigate();
  const { state } = useLocation();
  const { user, status: authStatus } = useAuthContext();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [data, setData] = useState<ListApplicationsResp["listApplications"]>(null);

  const filtersRef = useRef<FilterForm>({ ...defaultValues });
  const tableRef = useRef<TableMethods>(null);

  const [listApplications] = useLazyQuery<ListApplicationsResp, ListApplicationsInput>(
    LIST_APPLICATIONS,
    {
      context: { clientName: "backend" },
      fetchPolicy: "no-cache",
    }
  );

  const [reviewApp] = useMutation<ReviewAppResp, ReviewAppInput>(REVIEW_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const handleCreate = useCallback(
    (_id: string) => {
      if (!_id) {
        navigate("", {
          state: {
            error: "Unable to create a submission request. Please try again later",
          },
        });
        return;
      }

      navigate(`/submission-request/${_id}`, {
        state: { from: "/submission-requests" },
      });
    },
    [navigate]
  );

  const handleFetchData = async (fetchListing: FetchListing<T>, force: boolean) => {
    const { first, offset, sortDirection, orderBy } = fetchListing || {};
    try {
      setLoading(true);

      const { programName, studyName, statuses, submitterName } = filtersRef.current;

      const { data: d, error } = await listApplications({
        variables: {
          submitterName: submitterName || undefined,
          programName: programName || "All",
          studyName: studyName || undefined,
          statuses,
          first,
          offset,
          sortDirection,
          orderBy,
        },
        context: { clientName: "backend" },
        fetchPolicy: "no-cache",
      });
      if (error || !d?.listApplications) {
        throw new Error("Unable to retrieve Submission Requests results.");
      }

      setData(d.listApplications);
    } catch (err) {
      Logger.error(`ListView: Unable to retrieve Submission Requests results`, err);
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

  const handleOnReviewClick = useCallback(
    async ({ _id, status }: T) => {
      if (status !== "Submitted") {
        navigate(`/submission-request/${_id}`, {
          state: {
            from: "/submission-requests",
          },
        });
        return;
      }

      try {
        const { data: d, errors } = await reviewApp({
          variables: {
            id: _id,
          },
        });

        if (errors || !d?.reviewApplication?._id) {
          throw new Error("Unable to review Submission Request.");
        }

        navigate(`/submission-request/${_id}`, {
          state: {
            from: "/submission-requests",
          },
        });
      } catch (err) {
        Logger.error("Error transitioning form from Submitted to In Review", err);
      }
    },
    [navigate, reviewApp]
  );

  const exportScope: ExportApplicationsButtonProps["scope"] = {
    ...filtersRef.current,
    submitterName: filtersRef?.current?.submitterName || undefined,
    programName: filtersRef?.current?.programName || "All",
    studyName: filtersRef?.current?.studyName || undefined,
    ...tableRef.current?.tableParams,
  };

  const Actions = useMemo<React.ReactNode>(
    () => (
      <Stack direction="row" alignItems="center" gap="8px" marginRight="37px">
        <ExportApplicationsButton scope={exportScope} disabled={!data?.total} />
      </Stack>
    ),
    [exportScope, data?.total]
  );

  const providerValue = useMemo(
    () => ({ user, handleOnReviewClick, tableRef }),
    [user, handleOnReviewClick, tableRef.current]
  );

  return (
    <>
      <PageBanner
        title="Submission Requests"
        subTitle="Below is a list of submission requests that are associated with your account. Please click on any of the submission requests to review or continue work."
        padding="57px 25px 0 25px"
        body={
          <StyledBannerBody
            direction="row"
            alignItems="center"
            justifyContent="flex-end"
            columnGap="40px"
          >
            <ExportTemplateButton />
            <CreateApplicationButton onCreate={handleCreate} />
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
          <ListFilters applicationData={data} onChange={handleOnFiltersChange} />

          <QuestionnaireContext.Provider value={providerValue}>
            <GenericTable
              ref={tableRef}
              columns={columns}
              data={data?.applications || []}
              total={data?.total || 0}
              loading={loading || authStatus === AuthStatus.LOADING}
              defaultRowsPerPage={20}
              defaultOrder="desc"
              position="both"
              noContentText="You either do not have the appropriate permissions to view submission requests, or there are no submission requests associated with your account."
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
          </QuestionnaireContext.Provider>
        </StyledFilterTableWrapper>
      </StyledContainer>
    </>
  );
};

export default ListingView;
