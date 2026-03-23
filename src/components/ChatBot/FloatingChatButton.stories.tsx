import { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import FloatingChatButton from "./FloatingChatButton";

const meta: Meta<typeof FloatingChatButton> = {
  title: "ChatBot / FloatingChatButton",
  component: FloatingChatButton,
  args: {
    label: "Chat",
    onClick: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [],
} satisfies Meta<typeof FloatingChatButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = {
  name: "Floating Chat Button",
  parameters: meta.parameters,
};
