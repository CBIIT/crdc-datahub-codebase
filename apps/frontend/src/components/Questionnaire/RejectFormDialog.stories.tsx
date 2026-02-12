import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import RejectFormDialog from "./RejectFormDialog";

const meta: Meta<typeof RejectFormDialog> = {
  title: "Submission Requests / Review Comments / Reject Dialog",
  component: RejectFormDialog,
  argTypes: {
    loading: {
      control: { type: "boolean" },
      description: "Indicates if the dialog is in a loading state.",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof RejectFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RejectDialog: Story = {
  args: {
    open: true,
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};
