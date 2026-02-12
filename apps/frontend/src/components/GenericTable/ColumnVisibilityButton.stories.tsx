import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, screen, within, waitFor } from "@storybook/test";
import { useState } from "react";

import ColumnVisibilityButton from "./ColumnVisibilityButton";
import { ColumnVisibilityPopperGroup } from "./ColumnVisibilityPopper";

type Column = {
  field: string;
  label: string;
  hideable?: boolean;
  group?: string;
};

const columns: Column[] = [
  { field: "name", label: "Name", hideable: false },
  { field: "age", label: "Age" },
  { field: "email", label: "Email" },
  { field: "long_label", label: "a_very_long_label_with_no_spaces" },
  {
    field: "long_label_spaces",
    label: "A equally long label with spaces",
  },
];

const getColumnKey = (column: Column) => column.field;
const getColumnLabel = (column: Column) => column.label;

const meta: Meta<typeof ColumnVisibilityButton<Column>> = {
  title: "Miscellaneous / Column Visibility",
  argTypes: {
    sortAlphabetically: {
      control: { type: "boolean" },
    },
  },
  component: ColumnVisibilityButton,
  tags: ["autodocs"],
} satisfies Meta<typeof ColumnVisibilityButton<Column>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  name: "Basic - Ungrouped",
  render: () => {
    const [mockModel, setMockModel] = useState<Record<string, boolean>>({
      name: true,
      age: true,
      email: true,
      long_label: true,
      long_label_spaces: true,
    });

    return (
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={mockModel}
        getColumnKey={fn(getColumnKey)}
        getColumnLabel={fn(getColumnLabel)}
        onColumnVisibilityModelChange={fn(setMockModel)}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const { getByTestId, findByTestId } = within(canvasElement);

    await findByTestId("column-visibility-button");
    await userEvent.click(getByTestId("column-visibility-button"));

    await waitFor(() => screen.findByTestId("column-visibility-popper"));

    await userEvent.unhover(getByTestId("column-visibility-button"));
  },
};

export const BasicWithGroups: Story = {
  name: "Basic - Grouped",
  render: () => {
    const [mockModel, setMockModel] = useState<Record<string, boolean>>({
      name: true,
      age: true,
      email: true,
      long_label: true,
      long_label_spaces: true,
    });

    const mockGroups: ColumnVisibilityPopperGroup[] = [
      { name: "lorem", description: "lorem ipsum dolor sit amet" },
      { name: "ipsum", description: "ipsum dolor sit amet" },
      { name: "dolor", description: "dolor sit amet dolor" },
    ];

    const mockGetGroups = (column: Column) => {
      switch (column.field) {
        case "name":
          return "lorem";
        case "age":
          return "ipsum";
        case "email":
        case "long_label":
        case "long_label_spaces":
          return "dolor";
        default:
          return undefined;
      }
    };

    return (
      <ColumnVisibilityButton
        columns={columns}
        groups={mockGroups}
        columnVisibilityModel={mockModel}
        getColumnKey={fn(getColumnKey)}
        getColumnLabel={fn(getColumnLabel)}
        getColumnGroup={fn(mockGetGroups)}
        onColumnVisibilityModelChange={fn(setMockModel)}
      />
    );
  },
  play: Basic.play,
};

export const Hovered: Story = {
  ...Basic,
  play: async ({ canvasElement }) => {
    const { getByTestId, findByTestId } = within(canvasElement);

    await findByTestId("column-visibility-button");
    await userEvent.hover(getByTestId("column-visibility-button"));

    await waitFor(() => screen.findByRole("tooltip"));
  },
};

export const LongColumnListGrouped: Story = {
  ...Basic,
  name: "Scroll Region - Grouped",
  render: () => {
    const columns: Column[] = Array(50)
      .fill(null)
      .map((_, index) => ({
        field: `column_${index}`,
        label: `column_${index}`,
        group: `group_${Math.floor(index / 10)}`,
      }));

    const [mockModel, setMockModel] = useState<Record<string, boolean>>({});

    const mockGroups: ColumnVisibilityPopperGroup[] = [
      { name: "group_0", description: "Group 0" },
      { name: "group_1", description: "Group 1" },
      { name: "group_2", description: "Group 2" },
      { name: "group_3", description: "Group 3" },
      { name: "group_4", description: "Group 4" },
    ];

    const mockGetGroups = (column: Column) => column.group;

    return (
      <ColumnVisibilityButton
        columns={columns}
        groups={mockGroups}
        columnVisibilityModel={mockModel}
        getColumnKey={fn(getColumnKey)}
        getColumnLabel={fn(getColumnLabel)}
        getColumnGroup={fn(mockGetGroups)}
        onColumnVisibilityModelChange={fn(setMockModel)}
      />
    );
  },
};

export const LongColumnListUngrouped: Story = {
  ...Basic,
  name: "Scroll Region - Ungrouped",
  render: () => {
    const columns: Column[] = Array(50)
      .fill(null)
      .map((_, index) => ({
        field: `column_${index}`,
        label: `column_${index}`,
      }));

    const [mockModel, setMockModel] = useState<Record<string, boolean>>({});

    return (
      <ColumnVisibilityButton
        columns={columns}
        columnVisibilityModel={mockModel}
        getColumnKey={fn(getColumnKey)}
        getColumnLabel={fn(getColumnLabel)}
        onColumnVisibilityModelChange={fn(setMockModel)}
      />
    );
  },
};
