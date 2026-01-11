import { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/test";
import React from "react";

import ChatPanel from "./ChatPanel";
import { ChatBotProvider } from "./context/ChatBotContext";
import { ChatDrawerProvider } from "./context/ChatDrawerContext";

type StoryArgs = {
  endpointUrl: string;
};

const meta: Meta<StoryArgs> = {
  title: "ChatBot / Chat Panel",
  component: ChatPanel,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    endpointUrl: {
      name: "Endpoint URL",
      control: "text",
      description: "The URL for the knowledge base API endpoint.",
      table: {
        defaultValue: { summary: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "not set" },
      },
    },
  },
  decorators: [
    (Story, context) => {
      const { endpointUrl } = context.args;

      return (
        <ChatBotProvider
          title="CRDC Data Hub Support"
          label="Ask a question"
          knowledgeBaseUrl={endpointUrl}
        >
          <ChatDrawerProvider>
            <div style={{ height: "600px", width: "100%", border: "1px solid #ccc" }}>
              <Story />
            </div>
          </ChatDrawerProvider>
        </ChatBotProvider>
      );
    },
  ],
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  name: "Chat Panel",
  args: {
    endpointUrl: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "",
  },
};

export const WithMessages: Story = {
  args: {
    endpointUrl: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for component to render
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // Find the textarea and send button
    const textarea = canvas.getByRole("textbox");
    const sendButton = canvas.getByRole("button", { name: /send/i });

    // Type a message
    await userEvent.type(textarea, "How do I submit data?");

    // Click send button
    await userEvent.click(sendButton);

    // Wait for response
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  },
};

export const BotTyping: Story = {
  args: {
    endpointUrl: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for component to render
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // Find the textarea and send button
    const textarea = canvas.getByRole("textbox");
    const sendButton = canvas.getByRole("button", { name: /send/i });

    // Type a message
    await userEvent.type(textarea, "How do I upload files?");

    // Click send button
    await userEvent.click(sendButton);

    // Story pauses here showing the bot typing indicator
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    endpointUrl: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "",
  },
};
