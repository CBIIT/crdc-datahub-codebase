import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import Dialog from "./index";

const meta = {
  title: "Dialogs / Delete",
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
    header: "Dialog Title",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    confirmText: "Confirm",
    onClose: fn(),
    onConfirm: fn(),
  },
};

export const CustomizedButtons: Story = {
  args: {
    open: true,
    header: "Dialog Title",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    onClose: fn(),
    closeButtonProps: {
      color: "primary",
    },
    onConfirm: fn(),
    confirmButtonProps: {
      disabled: true,
    },
  },
};

export const CustomizedHeader: Story = {
  args: {
    ...Default.args,
    header: "Custom Header",
    headerProps: {
      color: "blue !important",
    },
  },
};
