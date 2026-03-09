import { Stack, StackProps, Tab, Tabs, Typography, styled } from "@mui/material";
import { cloneDeep } from "lodash";
import React, { FC, useMemo, useState } from "react";

import blurredDataVisualizationSvg from "../../assets/dataSubmissions/blurred_data_visualization.svg?url";
import { buildMiniChartSeries, buildPrimaryChartSeries, compareNodeStats } from "../../utils";
import ContentCarousel from "../Carousel";
import { SubmissionCtxStatus, useSubmissionContext } from "../Contexts/SubmissionContext";
import MiniPieChart from "../NodeChart";
import NodeTotalChart from "../NodeTotalChart";
import SuspenseLoader from "../SuspenseLoader";

import StatisticLegend from "./StatisticLegend";

const StyledChartArea = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "hasNoData",
})<StackProps & { hasNoData?: boolean }>(({ hasNoData }) => ({
  height: "422px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  overflow: "visible",
  background: "#FFFFFF",
  width: "100%",
  position: "relative",
  "& > *": {
    zIndex: 10,
  },
  "&::before": {
    position: "absolute",
    content: '""',
    width: "1440px",
    height: "100%",
    background: "#FFFFFF",
    top: "0",
    left: "50%",
    transform: "translateX(-50%)",
    boxShadow: "0px 4px 20px 0px #00000059",
    zIndex: 1,
  },
  ...(hasNoData && {
    "&::after": {
      position: "absolute",
      content: `url("${blurredDataVisualizationSvg}")`,
      width: "100%",
      height: "344px",
      background: "transparent",
      top: "0",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 2,
    },
  }),
}));

const StyledSectionTitle = styled(Typography)({
  marginTop: "5px",
  marginBottom: "23px",
  fontSize: "13px",
  fontWeight: 600,
  textTransform: "uppercase",
  color: "#187A90",
});

const StyledNoData = styled(Typography)({
  width: "944px",
  fontSize: "21px",
  fontWeight: 400,
  lineHeight: "29px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  color: "#595959",
  filter: "drop-shadow(0px 0px 85px #FFF)",
  textAlign: "center",
  userSelect: "none",
});

const StyledTab = styled(Tab)({
  color: "#156071",
  opacity: 0.6,
  textTransform: "none",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "Nunito",
  paddingBottom: "0px",
  paddingLeft: "0px",
  paddingRight: "0px",
  minWidth: "auto",
  marginRight: "10px",
  marginLeft: "10px",
  "&.Mui-selected": {
    color: "#156071",
    opacity: 1,
  },
  "&.MuiTab-root": {
    minWidth: "auto",
  },
});

const defaultFilters: LegendFilter[] = [
  { label: "New", color: "#4D90D3", disabled: false },
  { label: "Passed", color: "#32E69A", disabled: false },
  { label: "Error", color: "#D65219", disabled: false },
  { label: "Warning", color: "#FFD700", disabled: false },
];

/**
 * The primary chart container with secondary detail charts
 *
 * @param {Props} props
 * @returns {React.FC}
 */
const DataSubmissionStatistics: FC = () => {
  const { data: dataSubmission, status } = useSubmissionContext();
  const { stats: statistics } = dataSubmission?.submissionStats || {};

  const [filters, setFilters] = useState<LegendFilter[]>(defaultFilters);
  const [tabValue, setTabValue] = useState<"count" | "percentage">("count");

  const disabledSeries: SeriesLabel[] = filters.filter((f) => f.disabled).map((f) => f.label);
  const dataset: SubmissionStatistic[] = useMemo(
    () => cloneDeep(statistics || []).sort(compareNodeStats),
    [statistics]
  );
  const primaryChartSeries: BarChartDataset[] = useMemo(
    () => buildPrimaryChartSeries(dataset, disabledSeries),
    [dataset, disabledSeries]
  );

  const handleFilterChange = (filter: LegendFilter) => {
    const newFilters = filters.map((f) => {
      if (f.label === filter.label) {
        return { ...f, disabled: !f.disabled };
      }
      return f;
    });

    setFilters(newFilters);
  };

  const handleViewByChange = (_: React.SyntheticEvent, newValue: "count" | "percentage") =>
    setTabValue(newValue);

  if (!dataSubmission || status === SubmissionCtxStatus.LOADING || !dataset) {
    return (
      <StyledChartArea direction="row" data-testid="statistics-loader-container">
        <SuspenseLoader fullscreen={false} />
      </StyledChartArea>
    );
  }

  if (!dataset?.some((s) => s.total > 0)) {
    return (
      <StyledChartArea direction="row" data-testid="statistics-empty-container" hasNoData>
        <StyledNoData variant="h6">
          This is the data submission visualization section which displays validation results for
          uploaded data. After uploading and validating the data (see below), the visualization
          graphic will display.
        </StyledNoData>
      </StyledChartArea>
    );
  }

  return (
    <StyledChartArea direction="row" data-testid="statistics-charts-container">
      <Stack direction="column" alignItems="center" flex={1}>
        <StyledSectionTitle variant="h6">Summary Total</StyledSectionTitle>
        <NodeTotalChart data={primaryChartSeries} normalize={tabValue === "percentage"} />
        <Tabs value={tabValue} onChange={handleViewByChange} aria-label="View chart by" centered>
          <StyledTab label="View By Count" value="count" />
          <StyledTab label="View By Percentage" value="percentage" />
        </Tabs>
      </Stack>
      <Stack direction="column" alignItems="center" flex={1} height={344}>
        <StyledSectionTitle variant="h6">
          Individual Node Types {`(${dataset.length})`}
        </StyledSectionTitle>
        {/* NOTE: The transform is derived from the difference of Chart width and
            chart container width which is 50px on each side (100px) */}
        <ContentCarousel
          key={`carousel_${dataset.length}`}
          additionalTransfrom={dataset.length > 3 ? 100 : 0}
          locked={dataset.length <= 3}
        >
          {dataset?.map((stat) => (
            <MiniPieChart
              key={stat.nodeName}
              label={stat.nodeName}
              centerCount={stat.total}
              data={buildMiniChartSeries(stat, disabledSeries)}
            />
          ))}
          {/* NOTE: the 4th node is cut-off without this */}
          {dataset.length === 4 && <span />}
        </ContentCarousel>
        <StatisticLegend filters={filters} onClick={handleFilterChange} />
      </Stack>
    </StyledChartArea>
  );
};

export default React.memo(DataSubmissionStatistics);
