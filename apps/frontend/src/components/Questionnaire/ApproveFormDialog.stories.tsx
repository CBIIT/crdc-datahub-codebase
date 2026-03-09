import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import ApproveFormDialog from "./ApproveFormDialog";

const meta: Meta<typeof ApproveFormDialog> = {
  title: "Submission Requests / Review Comments / Approve Dialog",
  component: ApproveFormDialog,
  argTypes: {
    loading: {
      control: { type: "boolean" },
      description: "Indicates if the dialog is in a loading state.",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof ApproveFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApproveDialog: Story = {
  args: {
    open: true,
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};
