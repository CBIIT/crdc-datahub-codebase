import type { Meta, StoryObj } from "@storybook/react";

import Footer from "./index";

const meta = {
  title: "Navigation / Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {},
};
