import { Meta, StoryObj } from "@storybook/react";

import ChatBotView from "./ChatBotView";

const meta: Meta<typeof ChatBotView> = {
  title: "ChatBot / ChatBot",
  component: ChatBotView,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [],
  argTypes: {
    label: {
      name: "Label",
      control: "text",
      description: "The label text displayed on the floating chat button.",
      table: {
        defaultValue: { summary: "Chat" },
      },
    },
    title: {
      name: "Title",
      control: "text",
      description: "The title text displayed in the chat drawer header.",
      table: {
        defaultValue: { summary: "Chat" },
      },
    },
  },
} satisfies Meta<typeof ChatBotView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = {
  name: "ChatBot",
  parameters: meta.parameters,
  args: {
    label: "Chat",
    title: "Chat",
  },
};
