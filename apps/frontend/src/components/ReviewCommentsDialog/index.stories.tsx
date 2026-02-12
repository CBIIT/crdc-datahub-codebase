import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import Dialog from "./index";

const meta: Meta<typeof Dialog> = {
  title: "Dialogs / Review Comments",
  component: Dialog,
  args: {
    open: true,
    preTitle: "Lorem Ipsum",
    title: "Review Comments",
    onClose: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Dialog>;

type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  args: {
    ...meta.args,
    lastReview: {
      dateTime: "2024-06-01T12:00:00Z",
      status: "Approved",
      userID: "mock-uuid-01",
      userName: "John Doe",
      reviewComment: "lorem ipsum dolor sit amet consectetur adipiscing elit".repeat(15),
    },
    status: "Approved",
  },
};

export const Rejected: Story = {
  args: {
    ...meta.args,
    lastReview: {
      dateTime: "2024-06-01T12:00:00Z",
      status: "Rejected",
      userID: "mock-uuid-01",
      userName: "John Doe",
      reviewComment: "lorem ipsum dolor sit amet consectetur adipiscing elit".repeat(15),
    },
    status: "Rejected",
  },
};

export default meta;
