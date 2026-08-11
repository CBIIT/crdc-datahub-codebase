import type { Meta, StoryObj } from "@storybook/react";

import RichTextViewer from "./index";

type StoryArgs = React.ComponentProps<typeof RichTextViewer>;

const meta: Meta<StoryArgs> = {
  title: "Miscellaneous / Rich Text Viewer",
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

export const WithLinks: Story = {
  args: {
    content: [
      "Read the [study protocol](https://www.cancer.gov) before enrolling.",
      "",
      "1. Review the [eligibility criteria](https://clinicaltrials.gov)",
      "2. Submit the form to [the coordinator](https://www.cancer.gov/contact)",
      "",
      "- **Required:** [consent form](https://www.cancer.gov/consent)",
      "- _Optional:_ [supporting guidance](https://www.cancer.gov/guidance)",
    ].join("\n"),
  },
};

export const UnsafeLinks: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Only absolute http and https destinations render as anchors. Other schemes, relative paths, and raw anchor attributes are dropped, leaving the link text as plain content.",
      },
    },
  },
  args: {
    content: [
      "Script scheme: [click me](javascript:alert(1))",
      "",
      "Relative path: [internal report](/admin/report)",
      "",
      'Raw anchor: <a href="javascript:alert(1)" onclick="alert(1)">raw link</a>',
      "",
      'Raw anchor with a safe URL: <a href="https://www.cancer.gov" style="color:red">sanitized link</a>',
    ].join("\n"),
  },
};

export const EmptyContent: Story = {
  args: {
    content: "   ",
  },
};
