import { Box, styled } from "@mui/material";
import { FC, useCallback, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { calculateMaxDomain, calculateTextWidth, formatTick } from "../../utils";

import ActiveBar from "./ActiveBar";
import BarTooltip from "./BarTooltip";
import CustomTick from "./CustomTick";
import LabelToolTip from "./LabelTooltip";

const StyledChartContainer = styled(Box, {
  shouldForwardProp: (p) => p !== "height" && p !== "width",
})(({ width, height }) => ({
  overflow: "visible",
  width: `${width}px`,
  height: `${height}px`,
}));

type Props = {
  /**
   * The data to display in the pie chart
   */
  data: BarChartDataset[];
  /**
   * If true, the data bars will be normalized to 100%
   */
  normalize?: boolean;
  /**
   * The width of the gap between the bars in pixels
   *
   * @default 8
   */
  barGapPx?: number;
  /**
   * The width of the full chart container in pixels
   */
  containerWidthPx?: number;
  /**
   * The height of the full chart container in pixels
   */
  containerHeightPx?: number;
};

/**
 * Builds a summary of node states (passed, new, ...) chart for the node statistics
 *
 * @param {Props} props
 * @returns {React.FC<Props>}
 */
const NodeTotalChart: FC<Props> = ({
  data,
  normalize = true,
  barGapPx = 8,
  containerWidthPx = 482,
  containerHeightPx = 246,
}) => {
  const [tooltipData, setTooltipData] = useState<{ label: string; x: number; y: number } | null>(
    null
  );

  const computedBarWidth = useMemo<number>(
    () => (containerWidthPx - barGapPx * data.length) / data.length,
    [data.length]
  );

  const shouldRotateLabels = useMemo<boolean>(
    () =>
      data?.some(
        ({ label }) => calculateTextWidth(label, "Roboto", "11px", "400") > computedBarWidth
      ),
    [data, computedBarWidth]
  );

  const handleLabelEnter = useCallback(
    (e) => {
      // Ignore tooltip if labels are not rotated
      if (!shouldRotateLabels) {
        return;
      }

      setTooltipData({ ...e, y: e.y + 30 });
    },
    [shouldRotateLabels]
  );

  const handleLabelLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  return (
    <StyledChartContainer height={containerHeightPx} width={containerWidthPx}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          layout="horizontal"
          data={data}
          stackOffset={normalize ? "expand" : "none"}
          maxBarSize={53}
          barCategoryGap={`${barGapPx}px`}
          barGap={`${barGapPx}px`}
          aria-label="Node Total background"
          // @ts-ignore - `overflow` is not in the type definition for BarChart
          overflow="visible"
        >
          <CartesianGrid stroke="#E1E1E1" strokeWidth="0.6px" vertical={false} />
          <Tooltip content={<BarTooltip normalized={normalize} />} cursor={false} />
          <YAxis
            type="number"
            axisLine={false}
            tickFormatter={(tick) => formatTick(tick, normalize)}
            domain={normalize ? [0, "dataMax"] : [0, calculateMaxDomain]}
            interval={0}
            tickMargin={4}
          />
          <XAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            // eslint-disable-next-line react/no-unstable-nested-components
            tick={(p) => (
              <CustomTick
                {...p}
                angled={shouldRotateLabels}
                handleMouseEnter={handleLabelEnter}
                handleMouseLeave={handleLabelLeave}
              />
            )}
            interval={0}
            allowDataOverflow
            allowDuplicatedCategory
          />
          <Bar dataKey="New" fill="#4D90D3" stackId="primary" activeBar={ActiveBar} />
          <Bar dataKey="Passed" fill="#32E69A" stackId="primary" activeBar={ActiveBar} />
          <Bar dataKey="Error" fill="#D65219" stackId="primary" activeBar={ActiveBar} />
          <Bar dataKey="Warning" fill="#FFC700" stackId="primary" activeBar={ActiveBar} />
        </BarChart>
      </ResponsiveContainer>
      {tooltipData && (
        <Tooltip
          content={<LabelToolTip />}
          label={tooltipData.label}
          wrapperStyle={{
            visibility: "visible",
            transform: `translate(${tooltipData.x}px, ${tooltipData.y}px)`,
          }}
          active
        />
      )}
    </StyledChartContainer>
  );
};

export default NodeTotalChart;
