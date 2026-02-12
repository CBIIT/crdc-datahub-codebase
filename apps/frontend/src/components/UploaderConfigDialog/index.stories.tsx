import type { Meta, StoryObj } from "@storybook/react";

import Dialog from "./index";

const meta = {
  title: "Dialogs / Uploader CLI Config",
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
    onDownload: async () => {},
    onClose: () => {},
  },
};
