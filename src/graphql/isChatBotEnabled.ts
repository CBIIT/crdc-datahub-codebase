import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const IS_CHATBOT_ENABLED: TypedDocumentNode<Response, null> = gql`
  query isChatBotEnabled {
    isChatBotEnabled
  }
`;

export type Response = {
  /**
   * Whether the ChatBot feature is currently enabled.
   */
  isChatBotEnabled: boolean;
};
