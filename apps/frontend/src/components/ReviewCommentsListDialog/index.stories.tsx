import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import ReviewCommentsListDialog from "./index";

const meta: Meta<typeof ReviewCommentsListDialog> = {
  title: "Dialogs / Review Comments List",
  component: ReviewCommentsListDialog,
  args: {
    open: true,
    preTitle: "CRDC Submission Request",
    title: "Review Comments",
    onClose: fn(),
    onView: fn(),
    events: [
      {
        status: "Inquired",
        dateTime: "2023-05-28T16:40:00Z",
        userID: "user-1",
        reviewComment: "Please provide additional details for section C.",
      },
      {
        status: "Inquired",
        dateTime: "2023-05-15T16:40:00Z",
        userID: "user-2",
        reviewComment: "Please confirm dbGaP registration status.",
      },
      {
        status: "Inquired",
        dateTime: "2023-04-28T16:40:00Z",
        userID: "user-3",
        reviewComment: "Please clarify file repository details.",
      },
    ] as HistoryBase<ApplicationStatus>[],
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ReviewCommentsListDialog>;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...meta.args,
  },
};

export default meta;
