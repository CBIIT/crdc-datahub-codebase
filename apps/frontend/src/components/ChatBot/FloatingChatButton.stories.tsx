import { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React from "react";

import chatConfig from "./config/chatConfig";
import FloatingChatButton from "./FloatingChatButton";

const meta: Meta<typeof FloatingChatButton> = {
  title: "ChatBot / FloatingChatButton",
  component: FloatingChatButton,
  args: {
    label: "CRDC\nAssistant",
    onClick: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      React.useEffect(() => {
        sessionStorage.removeItem(chatConfig.floatingButton.sessionKey);
      }, []);

      return <Story />;
    },
  ],
} satisfies Meta<typeof FloatingChatButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Button: Story = {
  name: "Floating Chat Button",
  parameters: meta.parameters,
};

export const Expanded: Story = {
  name: "Floating Chat Button (Expanded)",
  args: {
    label: "CRDC\nAssistant",
    forceExpanded: true,
  },
  parameters: meta.parameters,
};
