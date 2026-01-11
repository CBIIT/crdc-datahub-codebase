import { Meta, StoryObj } from "@storybook/react";

import ChatDrawer from "./ChatDrawer";
import { ChatBotProvider } from "./context/ChatBotContext";
import { ChatDrawerProvider } from "./context/ChatDrawerContext";

const meta: Meta<typeof ChatDrawer> = {
  title: "ChatBot / Chat Drawer",
  component: ChatDrawer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ChatBotProvider title="Chat" label="Chat">
        <ChatDrawerProvider>
          <Story />
        </ChatDrawerProvider>
      </ChatBotProvider>
    ),
  ],
  argTypes: {
    children: {
      description: "Child content rendered in the drawer body.",
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof ChatDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div style={{ padding: "16px" }}>Chat content goes here</div>,
  },
};

export const WithCustomContent: Story = {
  args: {
    children: (
      <div style={{ padding: "16px" }}>
        <h3>Custom Chat Panel</h3>
        <p>This is custom content inside the chat drawer.</p>
      </div>
    ),
  },
};
