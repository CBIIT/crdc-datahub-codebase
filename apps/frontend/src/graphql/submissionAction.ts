import gql from "graphql-tag";

// action in [Submit, Release, Withdraw, Reject, Complete, Cancel]
export const mutation = gql`
  mutation submissionAction($submissionID: ID!, $action: String!, $comment: String) {
    submissionAction(submissionID: $submissionID, action: $action, comment: $comment) {
      _id
    }
  }
`;

export type Response = {
  submissionAction: Pick<Submission, "_id">;
};
