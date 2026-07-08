import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<
  RetrieveSubmissionQCComparisonsResp,
  RetrieveSubmissionQCComparisonsInput
> = gql`
  query retrieveSubmissionQCComparisons(
    $id: ID!
    $issueCode: String
    $nodeTypes: [String]
    $batchIDs: [ID]
    $severities: String
    $status: String
  ) {
    retrieveSubmissionQCComparisons(
      _id: $id
      issueCode: $issueCode
      nodeTypes: $nodeTypes
      batchIDs: $batchIDs
      severities: $severities
      status: $status
    ) {
      total
      skipped
      comparisons {
        submittedID
        nodeType
        existingProps
        incomingProps
      }
    }
  }
`;

export type RetrieveSubmissionQCComparisonsInput = {
  id: string;
  issueCode?: string;
  nodeTypes?: string[];
  batchIDs?: number[];
  severities?: string;
  status?: string;
};

export type RetrieveSubmissionQCComparisonsResp = {
  retrieveSubmissionQCComparisons: {
    total: number;
    skipped: number;
    comparisons: Array<{
      submittedID: string;
      nodeType: string;
      existingProps: string;
      incomingProps: string;
    }>;
  };
};
