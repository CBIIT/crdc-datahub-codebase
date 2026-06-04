import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React, { useEffect } from "react";

import RichTextEditor from "./index";

type StoryArgs = React.ComponentProps<typeof RichTextEditor>;

const StatefulEditor = (args: StoryArgs): React.ReactElement => {
  const { value: initialValue, onChange, onTextLengthChange, ...editorProps } = args;
  const [value, setValue] = React.useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Box>
      <RichTextEditor
        {...editorProps}
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          onChange(nextValue);
        }}
        onTextLengthChange={(length) => {
          onTextLengthChange?.(length);
        }}
      />
    </Box>
  );
};

const meta: Meta<StoryArgs> = {
  title: "Inputs / Rich Text Editor",
  component: RichTextEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    value: {
      control: "text",
      description: "Markdown value displayed in the editor.",
    },
    placeholder: {
      control: "text",
    },
    disabled: {
      control: "boolean",
    },
    onChange: {
      control: false,
    },
    onTextLengthChange: {
      control: false,
    },
  },
  args: {
    value: "",
    placeholder: "Start typing here...",
    disabled: false,
    "aria-label": "Rich text editor",
    onChange: fn(),
    onTextLengthChange: fn(),
  },
  render: (args) => <StatefulEditor {...args} />,
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const PrefilledContent: Story = {
  args: {
    value: [
      "# Study Summary",
      "",
      "This **rich text editor** supports markdown-compatible formatting.",
      "",
      "- Bullet one",
      "- Bullet two",
      "- Bullet three",
      "",
      "1. Ordered item",
      "2. Another ordered item",
    ].join("\n"),
  },
};

export const Disabled: Story = {
  args: {
    value: "This editor is in read-only mode.",
    disabled: true,
  },
};
