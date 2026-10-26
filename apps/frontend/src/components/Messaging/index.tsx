import { FC, useCallback, useState } from "react";

import MailIcon from "@/assets/icons/mail_icon.svg?react";

import { useLauncherItem } from "../Contexts/LauncherContext";

import MessagingPanel from "./MessagingPanel";

export type MessagingSubject = {
  type: "SubmissionRequest" | "DataSubmission";
  id: string;
};

type Props = {
  /**
   * The record the conversation is about.
   */
  subject: MessagingSubject;
  /**
   * Whether the current user can send messages.
   */
  canSend: boolean;
  /**
   * Whether the conversation is in read-only view.
   */
  isReadOnly: boolean;
};

const MessagingConversation: FC<Props> = ({ subject, canSend, isReadOnly }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  useLauncherItem({
    id: "messaging",
    label: "Message CRDC Staff",
    icon: MailIcon,
    gradient: "linear-gradient(180deg, #006374 0%, #13AA84 100%)",
    order: 2,
    isActive: isOpen,
    onClick: handleOpen,
  });

  return (
    <MessagingPanel
      open={isOpen}
      subject={subject}
      canSend={canSend}
      isReadOnly={isReadOnly}
      onClose={handleClose}
    />
  );
};

/**
 * Manages a single messaging conversation.
 */
const Messaging: FC<Props> = ({ subject, canSend, isReadOnly }) => (
  <MessagingConversation
    key={`${subject.type}:${subject.id}`}
    subject={subject}
    canSend={canSend}
    isReadOnly={isReadOnly}
  />
);

export default Messaging;
