import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import Button from "./index";

const meta: Meta<typeof Button> = {
  title: "Data Submissions / Copy Text Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    onCopy: fn(),
  },
  decorators: [],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The default copy to clipboard button
 */
export const CopyButton: Story = {
  name: "Button",
  parameters: meta.parameters,
};

/**
 * The copy to clipboard button with a tooltip
 */
export const Tooltip: Story = {
  name: "With Tooltip",
  parameters: meta.parameters,
  args: {
    title: "Tooltip text example",
    copyText: "Tooltip text example",
  },
};
