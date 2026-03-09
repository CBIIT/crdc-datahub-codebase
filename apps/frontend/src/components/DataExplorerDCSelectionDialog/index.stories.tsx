import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import Dialog from "./index";

const meta: Meta<typeof Dialog> = {
  title: "Data Explorer / DataExplorerDCSelectionDialog",
  component: Dialog,
  args: {
    open: true,
    dataCommons: ["GC", "CCDI", "ICDC"],
    onSubmitForm: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
