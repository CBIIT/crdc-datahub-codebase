import { FC } from "react";

import { useAuthContext } from "@/components/Contexts/AuthContext";
import { useFormContext } from "@/components/Contexts/FormContext";
import {
  canSendSRFMessages,
  canViewSRFMessages,
  isSRFConversationClosed,
} from "@/utils/messagingUtils";

import Messaging from "..";

export const SRFMessaging: FC = () => {
  const { user } = useAuthContext();
  const { data } = useFormContext();

  const isNewSRF = !data?._id || data._id === "new";
  if (isNewSRF || !canViewSRFMessages(user, data)) {
    return null;
  }

  return (
    <Messaging
      subject={{ type: "SubmissionRequest", id: data._id }}
      canSend={canSendSRFMessages(user, data)}
      isReadOnly={isSRFConversationClosed(data)}
    />
  );
};
