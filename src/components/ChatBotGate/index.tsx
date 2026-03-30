import { useQuery } from "@apollo/client";
import { FC, memo } from "react";

import env from "@/env";

import { IS_CHATBOT_ENABLED, IsChatBotEnabledResp } from "../../graphql";
import { Logger } from "../../utils/logger";

type Props = {
  children?: React.ReactNode;
};

/**
 * Provides a rendering gateway for toggling the ChatBot feature.
 * If the ChatBot API base URL is not configured or the ChatBot is disabled, it will render nothing.
 * Otherwise, it will render the children.
 *
 * @returns The ChatBot gate component.
 */
const ChatBotGate: FC<Props> = ({ children }) => {
  const { VITE_CHATBOT_API_BASE_URL } = env || {};
  const isEnvConfigured = !!VITE_CHATBOT_API_BASE_URL?.trim();

  const { data } = useQuery<IsChatBotEnabledResp>(IS_CHATBOT_ENABLED, {
    fetchPolicy: "cache-and-network",
    skip: !isEnvConfigured,
    onError: (error) => {
      Logger.error("Unable to fetch ChatBot enabled status. Assuming disabled.", error);
    },
  });

  if (!isEnvConfigured || data?.isChatBotEnabled !== true) {
    return null;
  }

  return children;
};

export default memo<Props>(ChatBotGate);
