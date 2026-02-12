import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import Filters, { DataExplorerFilterProps } from "./index";

type CustomStoryProps = DataExplorerFilterProps;

const meta: Meta<CustomStoryProps> = {
  title: "Data Explorer / DataExplorerFilters",
  component: Filters,
  args: {
    onChange: fn(),
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <SearchParamsProvider>
        <Story />
      </SearchParamsProvider>
    ),
  ],
} satisfies Meta<CustomStoryProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...meta.args,
    nodeTypes: ["mock-node-1", "another-mock-node", "participant-node"],
    defaultValues: {
      nodeType: "mock-node-1",
    },
  },
};
