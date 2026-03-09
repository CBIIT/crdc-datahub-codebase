import gql from "graphql-tag";

export const query = gql`
  query submissionCrossValidationResults(
    $submissionID: ID!
    $nodeTypes: [String]
    $batchIDs: [ID]
    $severities: String
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
  ) {
    submissionCrossValidationResults(
      submissionID: $submissionID
      nodeTypes: $nodeTypes
      batchIDs: $batchIDs
      severities: $severities
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      results {
        submissionID
        type
        validationType
        batchID
        displayID
        submittedID
        severity
        uploadedDate
        validatedDate
        errors {
          title
          description
        }
        warnings {
          title
          description
        }
        conflictingSubmission
      }
    }
  }
`;

export type Input = {
  submissionID: string;
  nodeTypes?: string[];
  batchIDs?: string[];
  severities?: string;
  first?: number;
  offset?: number;
  orderBy?: keyof CrossValidationResult;
  sortDirection?: string;
};

export type Response = {
  submissionCrossValidationResults: ValidationResult<CrossValidationResult>;
};
