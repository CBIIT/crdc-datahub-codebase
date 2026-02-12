import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query getSubmissionSummary($submissionID: ID!) {
    getSubmissionSummary(submissionID: $submissionID) {
      nodeType
      new
      updated
      deleted
    }
  }
`;

export type Input = {
  submissionID: string;
};

export type Response = {
  getSubmissionSummary: NodeTypeSummary[];
};
