import type { Meta, StoryObj } from "@storybook/react";

import TruncatedText from "./index";

const meta: Meta<typeof TruncatedText> = {
  title: "Miscellaneous / TruncatedText",
  component: TruncatedText,
  args: {
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt",
    maxCharacters: 20,
    underline: true,
    ellipsis: true,
    disableInteractiveTooltip: true,
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TruncatedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const ForceTooltip: Story = {
  args: {
    forceTooltip: true,
    text: "Short text",
    tooltipText: "This is a forced tooltip",
  },
};
