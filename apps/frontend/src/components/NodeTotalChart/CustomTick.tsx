import { styled } from "@mui/material";
import { isEqual } from "lodash";
import { memo, useCallback, useMemo } from "react";

import { titleCase } from "../../utils";

const StyledTSpan = styled("tspan")({
  fontFamily: "Roboto",
  fontSize: "11px",
  fontWeight: 400,
  color: "#474747",
  textTransform: "capitalize",
  overflow: "hidden",
  userSelect: "none",
});

/**
 * Renders a custom X-Axis tick for the NodeTotalChart
 * which handles the rotation and formatting of the tick label
 *
 * @note Details on how the `angled` prop is implemented:
 * - If `true`, the tick label will be rotated 65 degrees
 *   and will be displayed in a single line. Any excess
 *   characters (`labelLength`) will be trimmed and replaced with an ellipsis.
 * - If `false`, the tick label will be displayed in multiple lines
 *   denoted by spaces in the label string.
 * @returns {React.FC}
 */
const CustomTick = ({
  x,
  y,
  payload,
  labelLength = 7,
  angled = false,
  handleMouseEnter = null,
  handleMouseLeave = null,
}) => {
  const label: string = titleCase(payload?.value?.replace(/_/g, " ")?.trim() || "");
  const labelLines: string[] = useMemo<string[]>(() => {
    if (angled) {
      return [label.length > labelLength ? `${label.slice(0, labelLength).trim()}...` : label];
    }

    return label.split(" ");
  }, [label, angled, labelLength]);

  const onMouseEnter = useCallback(() => {
    handleMouseEnter?.({ x, y, label: titleCase(label) });
  }, [x, y, label, handleMouseEnter]);

  const onMouseLeave = useCallback(() => {
    handleMouseLeave?.();
  }, [x, y, label, handleMouseLeave]);

  return (
    <g transform={`translate(${x},${y})`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <g transform={angled ? "rotate(65)" : undefined}>
        <text>
          {labelLines.map((tickLabel, index) => (
            <StyledTSpan
              key={tickLabel}
              textAnchor={angled ? "start" : "middle"}
              x={0}
              y={0}
              dy={6 + index * 12} // Start + (index * line height)
            >
              {tickLabel}
            </StyledTSpan>
          ))}
        </text>
      </g>
    </g>
  );
};

export default memo(CustomTick, isEqual);
