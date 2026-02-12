import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import InquireFormDialog from "./InquireFormDialog";

const meta: Meta<typeof InquireFormDialog> = {
  title: "Submission Requests / Review Comments / Inquire Dialog",
  component: InquireFormDialog,
  argTypes: {
    loading: {
      control: { type: "boolean" },
      description: "Indicates if the dialog is in a loading state.",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof InquireFormDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InquireDialog: Story = {
  args: {
    open: true,
    loading: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};
