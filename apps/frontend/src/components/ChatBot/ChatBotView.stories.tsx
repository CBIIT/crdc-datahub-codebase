import { Meta, StoryObj } from "@storybook/react";

import { FloatingWindowProvider } from "@/components/FloatingWindow";

import ChatBotView from "./ChatBotView";
import chatConfig from "./config/chatConfig";
import { ChatBotProvider } from "./context/ChatBotContext";
import { ChatConversationProvider } from "./context/ChatConversationContext";

type StoryArgs = {
  label: string;
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
        label={context.args.label || "Chat"}
        knowledgeBaseUrl={context.args.endpointUrl}
      >
        <ChatConversationProvider>
          <FloatingWindowProvider config={chatConfig} confirmBeforeClose>
            <Story />
          </FloatingWindowProvider>
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
    endpointUrl: {
      name: "Endpoint URL",
      control: "text",
      description: "The URL for the knowledge base API endpoint.",
      table: {
        defaultValue: { summary: import.meta.env.VITE_CHATBOT_API_BASE_URL || "" },
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
    endpointUrl: import.meta.env.VITE_CHATBOT_API_BASE_URL || "",
  },
};
