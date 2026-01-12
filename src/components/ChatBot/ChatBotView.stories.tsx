import { Meta, StoryObj } from "@storybook/react";

import ChatBotView from "./ChatBotView";
import { ChatBotProvider } from "./context/ChatBotContext";
import { ChatConversationProvider } from "./context/ChatConversationContext";
import { ChatDrawerProvider } from "./context/ChatDrawerContext";

type StoryArgs = {
  label: string;
  title: string;
  endpointUrl: string;
};

const meta: Meta<StoryArgs> = {
  title: "ChatBot / ChatBot",
  component: ChatBotView,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, context) => (
      <ChatBotProvider
        title={context.args.title || "Chat"}
        label={context.args.label || "Chat"}
        knowledgeBaseUrl={context.args.endpointUrl}
      >
        <ChatConversationProvider>
          <ChatDrawerProvider>
            <Story />
          </ChatDrawerProvider>
        </ChatConversationProvider>
      </ChatBotProvider>
    ),
  ],
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
    endpointUrl: {
      name: "Endpoint URL",
      control: "text",
      description: "The URL for the knowledge base API endpoint.",
      table: {
        defaultValue: { summary: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "" },
      },
    },
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = {
  name: "ChatBot",
  parameters: meta.parameters,
  args: {
    label: "Chat",
    title: "Chat",
    endpointUrl: import.meta.env.VITE_KNOWLEDGE_BASE_URL || "",
  },
};
