import { useMutation } from "@apollo/client";
import { Box, Card, CardActions, CardContent, Container, Stack, Tabs, styled } from "@mui/material";
import { useSnackbar, VariantType } from "notistack";
import { FC, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import bannerPng from "../../assets/banner/submission_banner.png";
import summaryBannerPng from "../../assets/banner/summary_banner.png";
import { useAuthContext } from "../../components/Contexts/AuthContext";
import { useSearchParamsContext } from "../../components/Contexts/SearchParamsContext";
import { useSubmissionContext } from "../../components/Contexts/SubmissionContext";
import BackButton from "../../components/DataSubmissions/BackButton";
import CopyAdornment from "../../components/DataSubmissions/CopyAdornment";
import DataSubmissionSummary from "../../components/DataSubmissions/DataSubmissionSummary";
import { DataUpload } from "../../components/DataSubmissions/DataUpload";
import LinkTab from "../../components/DataSubmissions/LinkTab";
import MetadataUpload from "../../components/DataSubmissions/MetadataUpload";
import { UserGuide } from "../../components/DataSubmissions/UserGuide";
import ValidationControls from "../../components/DataSubmissions/ValidationControls";
import ValidationStatistics from "../../components/DataSubmissions/ValidationStatistics";
import DbGaPSheetExport from "../../components/DbGaPSheetExport";
import { hasPermission } from "../../config/AuthPermissions";
import { SUBMISSION_ACTION, SubmissionActionResp } from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";
import { Logger } from "../../utils";

import CrossValidation from "./CrossValidation";
import DataActivity, { DataActivityRef } from "./DataActivity";
import DataSubmissionActions from "./DataSubmissionActions";
import QualityControl from "./QualityControl";
import SubmittedData from "./SubmittedData";

const StyledBanner = styled("div")(({ bannerSrc }: { bannerSrc: string }) => ({
  background: `url(${bannerSrc})`,
  backgroundBlendMode: "luminosity, normal",
  backgroundSize: "cover",
  backgroundPosition: "center",
  width: "100%",
  height: "296px",
  zIndex: 0,
}));

const StyledBannerContentContainer = styled(Container)(({ padding }: { padding?: string }) => ({
  "&.MuiContainer-root": {
    padding: padding || "58px 73px 75px",
    marginTop: "-295px",
    width: "100%",
    height: "100%",
    position: "relative",
    zIndex: 1,
  },
}));

const StyledCard = styled(Card)(() => ({
  borderRadius: "8px",
  backgroundColor: "#FFFFFF",
  padding: 0,
  // boxShadow: "0px -5px 35px 0px rgba(53, 96, 160, 0.30)",
  "& .MuiCardContent-root": {
    padding: 0,
  },
  "& .MuiCardActions-root": {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
    position: "relative",
  },
  "&.MuiPaper-root": {
    border: "1px solid #6CACDA",
    borderTopRightRadius: 0,
    borderTopLeftRadius: 0,
    overflow: "visible",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    zIndex: 1,
    bottom: "50px",
    left: 0,
    pointerEvents: "none",
    backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(251,253,255, 1) 20%)",
    width: "100%",
    height: "260px",
  },
}));

const StyledMainContentArea = styled("div")(() => ({
  position: "relative",
  zIndex: 10,
  borderRadius: 0,
  padding: "21px 40px 0",
}));

const StyledCardActions = styled(CardActions)(() => ({
  "&.MuiCardActions-root": {
    paddingTop: "32px",
  },
}));

const StyledTabStack = styled(Stack)({
  position: "relative",
  "&::before": {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderBottom: "1.25px solid #6CACDA",
    zIndex: 1,
  },
});

const StyledTabs = styled(Tabs)({
  marginLeft: "auto",
  marginRight: "auto",
  display: "flex",
  alignItems: "flex-end",
  zIndex: 3,
  "& .MuiTabs-flexContainer": {
    justifyContent: "center",
  },
  "& .MuiTabs-indicator": {
    display: "none !important",
  },
});

const StyledSheetWrapper = styled("div")({
  position: "absolute",
  right: "40px",
});

const StyledWrapper = styled("div")({
  background: "#FBFDFF",
});

const StyledCardContent = styled(CardContent)({
  background: `url(${summaryBannerPng})`,
  backgroundSize: "auto",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "top",
});

const StyledFlowContainer = styled(Box)({
  padding: "27px 59px 59px 60px",
});

const URLTabs = {
  UPLOAD_ACTIVITY: "upload-activity",
  VALIDATION_RESULTS: "validation-results",
  SUBMITTED_DATA: "data-view",
  CROSS_VALIDATION_RESULTS: "cross-validation-results",
};

const submissionLockedStatuses: SubmissionStatus[] = [
  "Submitted",
  "Released",
  "Completed",
  "Canceled",
];

type Props = {
  submissionId: string;
  tab: string;
};

const DataSubmission: FC<Props> = ({ submissionId, tab = URLTabs.UPLOAD_ACTIVITY }) => {
  usePageTitle(`Data Submission ${submissionId || ""}`);

  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const { lastSearchParams } = useSearchParamsContext();
  const { data, error, refetch: getSubmission } = useSubmissionContext();

  const dataSubmissionListPageUrl = `/data-submissions${
    lastSearchParams?.["/data-submissions"] ?? ""
  }`;
  const activityRef = useRef<DataActivityRef>(null);
  const crossValidationVisible: boolean = useMemo<boolean>(
    () =>
      hasPermission(user, "data_submission", "review", data?.getSubmission) &&
      data?.getSubmission?.crossSubmissionStatus !== null,
    [user, data?.getSubmission]
  );
  const isValidTab =
    tab &&
    Object.values(URLTabs).includes(tab) &&
    (tab !== URLTabs.CROSS_VALIDATION_RESULTS || crossValidationVisible);

  const [submissionAction] = useMutation<SubmissionActionResp>(SUBMISSION_ACTION, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const updateSubmissionAction = async (action: SubmissionAction, reviewComment?: string) => {
    if (!submissionId) {
      return;
    }

    try {
      const { data: d, errors } = await submissionAction({
        variables: {
          submissionID: submissionId,
          action,
          comment: reviewComment,
        },
      });
      if (errors || !d?.submissionAction?._id) {
        Logger.error("Submission Action Error", errors);
        throw new Error(`Error occurred while performing '${action}' submission action.`);
      }
      await getSubmission();
    } catch (err) {
      enqueueSnackbar(err?.message, { variant: "error" });
    }
  };

  const handleBatchRefresh = useCallback(() => {
    // Force refresh the batch table to fetch the latest batch
    activityRef?.current?.tableRef?.refresh?.();
  }, [activityRef?.current?.tableRef]);

  const handleOnUpload = useCallback(
    async (message: string, variant: VariantType) => {
      enqueueSnackbar(message, { variant });

      // If the Data Activity tab is active, refresh the table
      handleBatchRefresh();

      // Refresh the submission data to start polling if needed
      await getSubmission();
    },
    [enqueueSnackbar, handleBatchRefresh, getSubmission]
  );

  useEffect(() => {
    if (!submissionId) {
      navigate(dataSubmissionListPageUrl, {
        state: { error: "Oops! An invalid Data Submission ID was provided." },
      });
    } else if (error) {
      navigate(dataSubmissionListPageUrl, {
        state: { error: "Oops! An error occurred while retrieving that Data Submission." },
      });
    }
  }, [error]);

  useEffect(() => {
    if (!isValidTab) {
      navigate(`/data-submission/${submissionId}/${URLTabs.UPLOAD_ACTIVITY}`, { replace: true });
    }
  }, [isValidTab]);

  return (
    <StyledWrapper>
      <StyledBanner bannerSrc={bannerPng} />
      <StyledBannerContentContainer maxWidth="xl">
        <CopyAdornment _id={submissionId} />
        <StyledCard>
          <StyledCardContent>
            <DataSubmissionSummary dataSubmission={data?.getSubmission} />
            <ValidationStatistics />
            <StyledFlowContainer>
              <UserGuide />
              <MetadataUpload
                readOnly={submissionLockedStatuses.includes(data?.getSubmission?.status)}
                onCreateBatch={handleBatchRefresh}
                onUpload={handleOnUpload}
              />
              <DataUpload submission={data?.getSubmission} />
              <ValidationControls />
            </StyledFlowContainer>
            <StyledTabStack direction="row" alignItems="center">
              <StyledTabs value={isValidTab ? tab : URLTabs.UPLOAD_ACTIVITY}>
                <LinkTab
                  value={URLTabs.UPLOAD_ACTIVITY}
                  label="Upload Activities"
                  to={`/data-submission/${submissionId}/${URLTabs.UPLOAD_ACTIVITY}`}
                  selected={tab === URLTabs.UPLOAD_ACTIVITY}
                  preventScrollReset
                />
                <LinkTab
                  value={URLTabs.VALIDATION_RESULTS}
                  label="Validation Results"
                  to={`/data-submission/${submissionId}/${URLTabs.VALIDATION_RESULTS}`}
                  selected={tab === URLTabs.VALIDATION_RESULTS}
                  preventScrollReset
                />
                {crossValidationVisible && (
                  <LinkTab
                    value={URLTabs.CROSS_VALIDATION_RESULTS}
                    label="Cross Validation Results"
                    to={`/data-submission/${submissionId}/${URLTabs.CROSS_VALIDATION_RESULTS}`}
                    selected={tab === URLTabs.CROSS_VALIDATION_RESULTS}
                    preventScrollReset
                  />
                )}
                <LinkTab
                  value={URLTabs.SUBMITTED_DATA}
                  label="Data View"
                  to={`/data-submission/${submissionId}/${URLTabs.SUBMITTED_DATA}`}
                  selected={tab === URLTabs.SUBMITTED_DATA}
                  preventScrollReset
                />
              </StyledTabs>
              <StyledSheetWrapper>
                <DbGaPSheetExport disabled={data?.getSubmission?.status === "New"} />
              </StyledSheetWrapper>
            </StyledTabStack>

            <StyledMainContentArea>
              {/* Primary Tab Content */}
              {tab === URLTabs.UPLOAD_ACTIVITY && <DataActivity ref={activityRef} />}
              {tab === URLTabs.VALIDATION_RESULTS && <QualityControl />}
              {tab === URLTabs.CROSS_VALIDATION_RESULTS && crossValidationVisible && (
                <CrossValidation />
              )}
              {tab === URLTabs.SUBMITTED_DATA && <SubmittedData />}

              {/* Return to Data Submissions Button */}
              <BackButton navigateTo={dataSubmissionListPageUrl} text="Back to Data Submissions" />
            </StyledMainContentArea>
          </StyledCardContent>
          <StyledCardActions>
            <DataSubmissionActions onAction={updateSubmissionAction} />
          </StyledCardActions>
        </StyledCard>
      </StyledBannerContentContainer>
    </StyledWrapper>
  );
};

export default DataSubmission;
