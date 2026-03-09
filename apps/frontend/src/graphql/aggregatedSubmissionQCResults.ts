import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

// The base aggregatedQCResult model used for all aggregatedSubmissionQCResults queries
const BaseAggregatedQCResultFragment = gql`
  fragment BaseAggregatedQCResultFragment on aggregatedQCResult {
    code
    title
  }
`;

// The extended aggregatedQCResult model which includes all fields
const FullAggregatedQCResultFragment = gql`
  fragment AggregatedQCResultFragment on aggregatedQCResult {
    severity
    count
    property
    value
  }
`;

export const query: TypedDocumentNode<Response, Input> = gql`
  query aggregatedSubmissionQCResults(
    $submissionID: ID!
    $severity: String
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $partial: Boolean = false
  ) {
    aggregatedSubmissionQCResults(
      submissionID: $submissionID
      severity: $severity
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      results {
        ...BaseAggregatedQCResultFragment
        ...AggregatedQCResultFragment @skip(if: $partial)
      }
    }
  }
  ${FullAggregatedQCResultFragment}
  ${BaseAggregatedQCResultFragment}
`;

export type Input = {
  submissionID: string;
  severity?: string;
  partial?: boolean;
} & BasePaginationParams;

export type Response = {
  aggregatedSubmissionQCResults: ValidationResult<AggregatedQCResult>;
};
