import type { Meta, StoryObj } from "@storybook/react";

import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import GenericTable from "./index";

const meta: Meta<typeof GenericTable> = {
  title: "Miscellaneous / Generic Table",
  component: GenericTable,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <SearchParamsProvider>
        <Story />
      </SearchParamsProvider>
    ),
    (Story) => (
      <div style={{ background: "#f2f2f2" }}>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof GenericTable>;

export default meta;
type Story = StoryObj<typeof meta>;

type ExampleDatasetType = {
  column1: string;
};

const exampleDataset: ExampleDatasetType[] = [
  {
    column1: "Row 1",
  },
  {
    column1: "Row 2",
  },
];

const exampleColumns = [
  {
    label: "Column #1",
    renderValue: (dataset: ExampleDatasetType) => dataset.column1,
  },
  {
    label: "Column #2",
    renderValue: (dataset: ExampleDatasetType) => dataset.column1,
  },
  {
    label: "Column #3",
    renderValue: (dataset: ExampleDatasetType) => dataset.column1,
  },
  {
    label: "Column #4",
    renderValue: (dataset: ExampleDatasetType) => dataset.column1,
  },
];

export const Table: Story = {
  args: {
    columns: exampleColumns,
    data: exampleDataset,
    total: exampleDataset.length,
    loading: false,
  },
};

/**
 * Renders the table as empty with no data.
 */
export const NoData: Story = {
  args: {
    columns: exampleColumns,
    data: [],
    total: 0,
    loading: false,
  },
};

/**
 * Renders the table in a loading state
 */
export const Loading: Story = {
  args: {
    columns: exampleColumns,
    data: [],
    total: 0,
    numRowsNoContent: 4,
    loading: true,
  },
};

/**
 * Renders the table with pagination centered.
 */
export const PaginationAlignment: Story = {
  args: {
    ...Table.args,
    paginationPlacement: "center",
  },
};

/**
 * Control the position of the pagination controls in the table.
 */
export const PaginationPositions: Story = {
  args: {
    ...Table.args,
    position: "both",
  },
  argTypes: {
    position: {
      control: {
        type: "select",
        options: ["top", "bottom", "both"],
      },
      description: "Position of the pagination controls in the table.",
    },
  },
};
