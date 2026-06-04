import type { Meta, StoryObj } from "@storybook/react";

import RichTextViewer from "./index";

type StoryArgs = React.ComponentProps<typeof RichTextViewer>;

const meta: Meta<StoryArgs> = {
  title: "Inputs / Rich Text Viewer",
  component: RichTextViewer,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    content: {
      control: "text",
      description: "Markdown content rendered by the viewer.",
    },
    className: {
      control: "text",
    },
  },
  args: {
    content: "Simple paragraph content.",
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const FormattedContent: Story = {
  args: {
    content: [
      "This paragraph includes **bold** and *italic* text.",
      "",
      "- First bullet",
      "- Second bullet with <u>underlined text</u>",
      "- Third bullet",
      "",
      "1. First ordered item",
      "2. Second ordered item",
    ].join("\n"),
  },
};

export const EmptyContent: Story = {
  args: {
    content: "   ",
  },
};
