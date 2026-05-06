import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import ReviewFormDialog from "./ReviewFormDialog";

const meta: Meta<typeof ReviewFormDialog> = {
  title: "Submission Requests / Review Form Dialog",
  component: ReviewFormDialog,
  argTypes: {
    loading: {
      control: { type: "boolean" },
      description: "Indicates if the dialog is in a loading state.",
      defaultValue: false,
    },
    header: {
      control: { type: "text" },
      description: "The dialog header text.",
    },
    confirmText: {
      control: { type: "text" },
      description: "The confirm button text.",
    },
  },
} satisfies Meta<typeof ReviewFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ApproveDialog: Story = {
  args: {
    open: true,
    header: "Approve Submission Request",
    confirmText: "Confirm to Approve",
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};

export const InquireDialog: Story = {
  args: {
    open: true,
    header: "Request Additional Changes",
    confirmText: "Confirm to move to Inquired",
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};

export const RejectDialog: Story = {
  args: {
    open: true,
    header: "Reject Submission Request",
    confirmText: "Confirm to Reject",
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};
