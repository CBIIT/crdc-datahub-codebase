/**
 * A SVG component that represents the active (hovered) bar in the chart.
 *
 * @param props
 * @returns {React.ReactElement}
 */
const ActiveBar = ({ fill, x, y, width, height }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      style={{
        cursor: "pointer",
        filter: "drop-shadow(0px 0px 5px rgba(152, 110, 226, 1))",
      }}
    />
  </g>
);

export default ActiveBar;
