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
      "item 1",
      "",
      "  item 2",
      "",
      "    **item 3**",
      "",
      "      _**item 4**_",
      "",
      "",
      "Hello _**World!          &lt;-10 spaces**_",
      "",
      "",
      "1. **first** item",
      "2. second item",
      "3. third _**item**_",
      "",
      "",
      "",
      "",
      "- item 1",
      "- **item 2**",
      "- _**item 3**_",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "**Hello World!**",
    ].join("\n"),
  },
};

export const EmptyContent: Story = {
  args: {
    content: "   ",
  },
};
