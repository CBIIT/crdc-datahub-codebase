/**
 * An object containing all the tooltip text for the Questionnaire/Submission Request page.
 */
export const TOOLTIP_TEXT: {
  // TODO: Change to ApplicationStatus
  STATUS_DESCRIPTIONS: Record<string, string>;
} = {
  STATUS_DESCRIPTIONS: {
    New: "The request form was created.",
    "In Progress": "The request form was started but not submitted.",
    Submitted: "The request form was submitted for review.",
    "In Review": "The request form is under evaluation by the Submission Review Committee.",
    Approved: "The request form was reviewed and approved.",
    Rejected: "The request form was reviewed and rejected.",
    Inquired: "Additional information or clarification was requested from the submitter.",
    Canceled: "The request form was manually canceled and is no longer active.",
    Deleted:
      "The request form was automatically deleted by the system due to inactivity and is no longer active.",
  },
} as const;

export type TooltipText = typeof TOOLTIP_TEXT;
