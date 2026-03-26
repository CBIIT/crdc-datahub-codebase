import { Suspense, lazy } from "react";

const ChatController = lazy(() => import("./Controller"));

const ChatBot = () => (
  <Suspense fallback={null}>
    <ChatController />
  </Suspense>
);

export default ChatBot;
