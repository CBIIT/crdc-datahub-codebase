import { Box, FormControl, MenuItem, SelectChangeEvent, styled, Typography } from "@mui/material";
import {
  createEmbeddingContext,
  DashboardContentOptions,
  DashboardExperience,
  FrameOptions,
  ToolbarOptions,
} from "amazon-quicksight-embedding-sdk";
import { isEqual } from "lodash";
import { FC, memo, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import bannerSvg from "../../assets/banner/submission_banner.png";
import { useAuthContext } from "../../components/Contexts/AuthContext";
import StyledLabel from "../../components/StyledFormComponents/StyledLabel";
import StyledSelect from "../../components/StyledFormComponents/StyledSelect";
import SuspenseLoader from "../../components/SuspenseLoader";
import { RequiresStudiesAssigned } from "../../config/AuthRoles";
import { addDataCommonsParameter, addStudiesParameter } from "../../utils";

export type DashboardViewProps = {
  url: string;
  currentType: string;
  loading: boolean;
};

const StyledPageContainer = styled(Box)({
  background: `url(${bannerSvg})`,
  backgroundSize: "100% 296px",
  backgroundPosition: "top",
  backgroundRepeat: "no-repeat",
  paddingBottom: "24px",
});

const StyledViewHeader = styled(Box)({
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px 0",
});

const StyledFormControl = styled(FormControl)({
  width: "351px",
});

const CustomLabel = styled(StyledLabel)({
  textAlign: "center",
});

const StyledFrameContainer = styled(Box)(({ theme }) => ({
  borderRadius: "6px",
  border: "1px solid #E0E0E0",
  background: "#fff",
  position: "relative",
  margin: "0 auto",
  maxWidth: "calc(100% - 64px)",
  boxShadow: theme.shadows[1],
  "& .quicksight-iframe": {
    borderRadius: "6px",
  },
}));

const StyledPlaceholder = styled(Typography)({
  margin: "100px auto",
  textAlign: "center",
  userSelect: "none",
  fontSize: "16px",
  color: "#5C5C5C",
});

/**
 * The view for the OperationDashboard component.
 *
 * @note This component MUST be protected by authorization to ensure they have the correct role to access the dashboard.
 *       This component assumes that the AuthState is already populated with the user info.
 * @param {DashboardViewProps} props The props for the component.
 * @returns {JSX.Element} The OperationDashboard component.
 */
const DashboardView: FC<DashboardViewProps> = ({
  url,
  currentType,
  loading,
}: DashboardViewProps) => {
  const { user } = useAuthContext();

  const [, setSearchParams] = useSearchParams();
  const [embeddedDashboard, setEmbeddedDashboard] = useState<DashboardExperience>(null);
  const dashboardElementRef = useRef<HTMLDivElement>(null);

  const contentParameters = useMemo<DashboardContentOptions["parameters"]>(() => {
    if (!user?.role) {
      return [];
    }

    const { role } = user;

    if (RequiresStudiesAssigned.includes(role)) {
      return addStudiesParameter(user);
    }

    if (role === "Data Commons Personnel") {
      return addDataCommonsParameter(user);
    }

    return [];
  }, [user]);

  const handleDashboardChange = (e: SelectChangeEvent) => {
    setSearchParams({ type: e.target.value });
    if (dashboardElementRef.current) {
      dashboardElementRef.current.innerHTML = "";
    }
    setEmbeddedDashboard(null);
  };

  const createEmbed = async () => {
    if (!url || embeddedDashboard) {
      return;
    }

    const frameConfig: FrameOptions = {
      url,
      container: dashboardElementRef.current,
      height: "1200px",
      width: "100%",
      withIframePlaceholder: true,
      className: "quicksight-iframe",
    };

    const toolbarOptions: ToolbarOptions = {
      export: true,
      reset: true,
    };

    const contentConfig: DashboardContentOptions = {
      parameters: contentParameters,
      toolbarOptions,
    };

    const context = await createEmbeddingContext();
    const dashboard = await context.embedDashboard(frameConfig, contentConfig);

    setEmbeddedDashboard(dashboard);
  };

  useEffect(() => {
    if (!url) {
      return;
    }

    createEmbed();
  }, [url]);

  return (
    <StyledPageContainer data-testid="operation-dashboard-container">
      {loading && <SuspenseLoader />}
      <StyledViewHeader>
        <StyledFormControl>
          <CustomLabel htmlFor="dashboard-type">Metrics:</CustomLabel>
          <StyledSelect
            value={currentType}
            onChange={handleDashboardChange}
            MenuProps={{ disablePortal: true }}
            inputProps={{ id: "dashboard-type" }}
          >
            <MenuItem value="Submission">Data Submissions Metrics</MenuItem>
          </StyledSelect>
        </StyledFormControl>
      </StyledViewHeader>
      <StyledFrameContainer>
        {!embeddedDashboard && (
          <StyledPlaceholder variant="body1">Please select a metric to visualize</StyledPlaceholder>
        )}
        <div ref={dashboardElementRef} />
      </StyledFrameContainer>
    </StyledPageContainer>
  );
};

export default memo<DashboardViewProps>(DashboardView, isEqual);
