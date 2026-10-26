import { FC } from "react";

import type { MessagingSubject } from ".";

type Props = {
  /**
   * Whether the panel is open.
   */
  open: boolean;
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
  /**
   * Called when the panel is closed.
   */
  onClose: () => void;
};

/**
 * The messaging panel for a single record.
 */
const MessagingPanel: FC<Props> = () => null;

export default MessagingPanel;
