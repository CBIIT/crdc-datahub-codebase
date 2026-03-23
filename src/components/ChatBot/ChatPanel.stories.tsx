import { Meta, StoryObj } from "@storybook/react";
import React from "react";

import ChatPanel from "./ChatPanel";
import { ChatBotProvider } from "./context/ChatBotContext";
import {
  ChatConversationContext,
  ChatConversationProvider,
  useChatConversationContext,
} from "./context/ChatConversationContext";
import { ChatDrawerProvider } from "./context/ChatDrawerContext";
import { createChatMessage } from "./utils/chatUtils";
import {
  clearConversationMessages,
  storeConversationMessages,
} from "./utils/conversationStorageUtils";
import { clearStoredSessionId } from "./utils/sessionStorageUtils";

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
    },
  },
  decorators: [
    (Story, context) => {
      const { endpointUrl } = context.args;
      const seedMessages = context.parameters.seedMessages as ChatMessage[] | undefined;
      const forceBotTyping = context.parameters.forceBotTyping as boolean | undefined;
      const [ready, setReady] = React.useState(false);

      React.useEffect(() => {
        const init = async () => {
          await clearConversationMessages();
          clearStoredSessionId();
          if (seedMessages?.length) {
            await storeConversationMessages(seedMessages);
          }
          setReady(true);
        };

        init();
      }, []);

      React.useEffect(() => {
        if (!forceBotTyping) {
          return undefined;
        }
        const originalFetch = window.fetch;
        window.fetch = () => new Promise<Response>(() => {});
        return () => {
          window.fetch = originalFetch;
        };
      }, [forceBotTyping]);

      if (!ready) {
        return null;
      }

      const TypingWrapper = forceBotTyping
        ? ({ children }: { children: React.ReactNode }) => {
            const ctx = useChatConversationContext();
            const value = React.useMemo(() => ({ ...ctx, isBotTyping: true }), [ctx]);
            return (
              <ChatConversationContext.Provider value={value}>
                {children}
              </ChatConversationContext.Provider>
            );
          }
        : React.Fragment;

      return (
        <ChatBotProvider label="Ask a question" knowledgeBaseUrl={endpointUrl}>
          <ChatConversationProvider>
            <TypingWrapper>
              <ChatDrawerProvider>
                <div style={{ height: "600px", width: "100%" }}>
                  <Story />
                </div>
              </ChatDrawerProvider>
            </TypingWrapper>
          </ChatConversationProvider>
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
    endpointUrl: "",
  },
};

export const WithMessages: Story = {
  args: {
    endpointUrl: "https://mock-knowledge-base",
  },
  parameters: {
    seedMessages: [
      createChatMessage({
        text: "How do I submit data?",
        sender: "user",
        senderName: "You",
      }),
      createChatMessage({
        text: [
          "# Heading 1\n\n",
          "## Heading 2\n\n",
          "### Heading 3\n\n",
          "#### Heading 4\n\n",
          "##### Heading 5\n\n",
          "###### Heading 6\n\n",
          "---\n\n",
          "### Inline Formatting\n\n",
          "This is **bold text**, this is *italic text*, this is `inline code`, this is ~~strikethrough~~, and this is a [link](#).\n\n",
          "### Paragraph\n\n",
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\n",
          "### Table\n\n",
          "| Column A | Column B | Column C | Column D |\n",
          "|----------|----------|----------|----------|\n",
          "| Lorem | Ipsum | Dolor | Sit |\n",
          "| Amet | Consectetur | Adipiscing | Elit |\n",
          "| Sed | Eiusmod | Tempor | Incididunt |\n\n",
          "### Code Block\n\n",
          "```python\ndef lorem_ipsum(dolor: str) -> dict:\n",
          '    """Consectetur adipiscing elit."""\n',
          '    data = {"amet": dolor, "sit": 42}\n',
          "    for key, value in data.items():\n",
          '        print(f"Processing {key}: {value}")\n',
          "    return data\n```\n\n",
          "### Ordered List\n\n",
          "1. Lorem ipsum dolor sit amet\n",
          "2. Consectetur adipiscing elit\n",
          "3. Sed do eiusmod tempor incididunt\n",
          "4. Ut labore et dolore magna aliqua\n\n",
          "### Unordered List\n\n",
          "- Lorem ipsum dolor sit amet\n",
          "- Consectetur adipiscing elit\n",
          "  - Sed do eiusmod tempor\n",
          "  - Incididunt ut labore\n",
          "- Ut enim ad minim veniam\n\n",
          "### Task List\n\n",
          "- [x] Lorem ipsum dolor sit amet\n",
          "- [x] Consectetur adipiscing elit\n",
          "- [ ] Sed do eiusmod tempor incididunt\n",
          "- [ ] Ut labore et dolore magna aliqua\n\n",
          "### Blockquote\n\n",
          "> Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n",
          ">\n",
          "> Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n",
          "### Horizontal Rule\n\n",
          "---\n\n",
          "Lorem ipsum dolor sit amet.",
        ].join(""),
        sender: "bot",
        senderName: "Bot",
        citations: [
          { documentName: "Dolor Sit Amet Consectetur", documentLink: "#" },
          { documentName: "Adipiscing Elit Sed Eiusmod", documentLink: "#" },
          { documentName: "Tempor Incididunt Ut Labore", documentLink: "#" },
        ],
      }),
    ],
  },
};

export const BotTyping: Story = {
  args: {
    endpointUrl: "https://mock-knowledge-base",
  },
  parameters: {
    forceBotTyping: true,
    seedMessages: [
      createChatMessage({
        text: "Lorem ipsum dolor sit amet?",
        sender: "user",
        senderName: "You",
      }),
    ],
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    endpointUrl: "",
  },
};
