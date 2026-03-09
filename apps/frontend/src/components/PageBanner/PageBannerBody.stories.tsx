import type { Meta, StoryObj } from "@storybook/react";

import PageBannerBody from "./PageBannerBody";

const meta = {
  title: "Miscellaneous / PageBannerBody",
  component: PageBannerBody,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    label: {
      control: "text",
      description: "The label text displayed on the button",
    },
    to: {
      control: "text",
      description: "The destination URL for the link",
    },
  },
} satisfies Meta<typeof PageBannerBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Click Me",
    to: "/destination",
  },
};
