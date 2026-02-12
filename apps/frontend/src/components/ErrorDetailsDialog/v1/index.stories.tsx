import type { Meta, StoryObj } from "@storybook/react";

import Dialog from "./index";

const meta = {
  title: "Dialogs / Error Details / V1",
  component: Dialog,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    header: "Dialog Pre-Title",
    title: "Error Details",
    errors: ["Lorem ipsum dolor", "sit ame, consectetur."],
    closeText: "Close",
  },
};
