type SeriesLabel = "New" | "Passed" | "Error" | "Warning";

type LegendFilter = {
  label: SeriesLabel;
  color: string;
  disabled?: boolean;
};

type BarChartDataset = {
  label: string;
  New: number;
  Passed: number;
  Error: number;
  Warning: number;
};

type PieSectorDataItem = {
  label: SeriesLabel;
  value: number;
  color: string;
};
