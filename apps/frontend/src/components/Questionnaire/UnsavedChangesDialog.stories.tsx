import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import UnsavedChangesDialog from "./UnsavedChangesDialog";

const meta: Meta<typeof UnsavedChangesDialog> = {
  title: "Submission Requests / Unsaved Changes Dialog",
  component: UnsavedChangesDialog,
  args: {
    open: true,
    onCancel: fn(),
    onDiscard: fn(),
    onSave: fn(),
  },
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
