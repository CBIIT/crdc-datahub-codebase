import type { Meta, StoryObj } from "@storybook/react";

import GenericDialog from "./index";

const meta: Meta<typeof GenericDialog> = {
  title: "Dialogs / Generic Dialog",
  component: GenericDialog,
  args: {
    open: true,
    title: "Generic Dialog Component",
    message: "This is the content of the generic dialog. You could also use a ReactNode.",
    actions: (
      <>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </>
    ),
  },
  argTypes: {
    actions: {
      control: false,
    },
  },
} satisfies Meta<typeof GenericDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
