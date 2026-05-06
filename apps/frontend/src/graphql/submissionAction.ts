import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const SUBMISSION_ACTION: TypedDocumentNode<SubmissionActionResp, SubmissionActionInput> =
  gql`
    mutation submissionAction($submissionID: ID!, $action: String!, $comment: String) {
      submissionAction(submissionID: $submissionID, action: $action, comment: $comment) {
        _id
      }
    }
  `;

export type SubmissionActionResp = {
  submissionAction: Pick<Submission, "_id">;
};

export type SubmissionActionInput = {
  submissionID: string;
  action: SubmissionAction;
  comment?: string;
};
