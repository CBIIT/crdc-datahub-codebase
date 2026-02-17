import type { Meta, StoryObj } from "@storybook/react";

import { nodeTypeSummaryFactory } from "@/factories/submission/NodeTypeSummaryFactory";

import SubmitSummaryTable from "./SubmitSummaryTable";

const meta: Meta<typeof SubmitSummaryTable> = {
  title: "Data Submissions / Submit Summary Table",
  component: SubmitSummaryTable,
  parameters: {
    layout: "padded",
  },
};
export default meta;

type Story = StoryObj<typeof SubmitSummaryTable>;

const makeRows = (n = 3) =>
  nodeTypeSummaryFactory.build(n, (i) => ({
    nodeType: `NodeType ${i + 1}`,
    new: 10 + i,
    updated: 5 + i,
    deleted: 50 + i,
  }));

export const SkeletonUnknownIntention: Story = {
  args: {
    intention: undefined,
    data: [],
    loading: true,
  },
};

export const LoadingNewUpdate: Story = {
  args: {
    intention: "New/Update",
    data: [],
    loading: true,
  },
};

export const LoadingDelete: Story = {
  args: {
    intention: "Delete",
    data: [],
    loading: true,
  },
};

export const DataNewUpdate: Story = {
  args: {
    intention: "New/Update",
    data: makeRows(3).map((r) => ({ ...r, deleted: 0 })),
    loading: false,
  },
};

export const DataDelete: Story = {
  args: {
    intention: "Delete",
    data: makeRows(2).map((r) => ({ ...r, new: 0, updated: 0 })),
    loading: false,
  },
};
