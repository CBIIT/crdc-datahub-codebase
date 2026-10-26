import React, { FC, SVGProps } from "react";

import {
  FloatingWindow,
  FloatingWindowConfirm,
  useFloatingWindowContext,
} from "@/components/FloatingWindow";
import type { FloatingWindowLabels } from "@/components/FloatingWindow";

import { useLauncherItem } from "../Contexts/LauncherContext";

import ChatBotLogoSvg from "./assets/chatbot-logo.svg?react";
import ChatPanel from "./ChatPanel";
import ChatBotLogo from "./components/ChatBotLogo";

const WINDOW_LABELS: FloatingWindowLabels = {
  expand: "Expand chat drawer",
  collapse: "Collapse chat drawer",
  enterFullscreen: "Enter full screen",
  exitFullscreen: "Exit full screen",
  minimize: "Minimize chat",
  close: "End conversation",
};

const ChatBotIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <ChatBotLogoSvg width={36} height={29} {...props} />
);

/**
 * The view component for the entire ChatBot.
 */
const ChatBot = (): JSX.Element | null => {
  const { isOpen, isMinimized, openWindow } = useFloatingWindowContext();

  useLauncherItem({
    id: "chatbot",
    label: "SI CRDC Assistant",
    icon: ChatBotIcon,
    gradient: "linear-gradient(177.87deg, #32ACC5 -9.82%, #0946A9 44.29%, #673DFF 97.88%)",
    order: 1,
    isActive: isOpen && !isMinimized,
    onClick: openWindow,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <FloatingWindow
      id="chat-drawer"
      labels={WINDOW_LABELS}
      confirmCloseContent={
        <FloatingWindowConfirm
          title="End Conversation"
          icon={<ChatBotLogo ariaLabel="CRDC Assistant Logo" variant="square" />}
        />
      }
    >
      <ChatPanel />
    </FloatingWindow>
  );
};

export default React.memo(ChatBot);
