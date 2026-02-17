import type { Meta, StoryObj } from "@storybook/react";

import ArrowUpIcon from "../../assets/icons/arrow_up.svg?url";

import Dialog, { IconType } from "./index";

const meta = {
  title: "Dialogs / History",
  component: Dialog,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

type MockStatuses = "uploaded" | "downloaded" | "error";

const IconMap: IconType<MockStatuses> = {
  uploaded: ArrowUpIcon,
  downloaded: ArrowUpIcon,
  error: ArrowUpIcon,
};

export const Default: Story = {
  name: "Standard",
  args: {
    open: true,
    preTitle: "Dialog Pre-Title",
    title: "XYZ Feature History",
    history: [
      { status: "uploaded", dateTime: "2024-09-05T01:45:00Z", userID: "", reviewComment: "" },
      { status: "downloaded", dateTime: "2024-09-02T11:45:00Z", userID: "", reviewComment: "" },
      { status: "error", dateTime: "2024-07-11T19:45:00Z", userID: "", reviewComment: "" },
    ],
    iconMap: IconMap,
    showHeaders: false,
    onClose: () => {},
    getTextColor: () => "#fff",
  },
};

export const WithUserNames: Story = {
  args: {
    open: true,
    preTitle: "Dialog Pre-Title",
    title: "XYZ Feature History",
    history: [
      {
        status: "uploaded",
        dateTime: "2024-09-05T01:45:00Z",
        userID: "",
        userName: "Example X",
        reviewComment: "",
      },
      {
        status: "downloaded",
        dateTime: "2024-09-02T11:45:00Z",
        userID: "",
        userName: "Test T.",
        reviewComment: "",
      },
      {
        status: "error",
        dateTime: "2024-07-11T19:45:00Z",
        userID: "",
        userName: "Very long name with ellipsis",
        reviewComment: "",
      },
    ],
    iconMap: IconMap,
    showHeaders: true,
    onClose: () => {},
    getTextColor: () => "#fff",
  },
};
