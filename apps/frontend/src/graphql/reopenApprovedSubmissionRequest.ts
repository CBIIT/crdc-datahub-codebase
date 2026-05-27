import gql from "graphql-tag";

export const mutation = gql`
  mutation reopenApprovedSubmissionRequest($id: ID!, $assignee: String) {
    reopenApprovedSubmissionRequest(_id: $id, assignee: $assignee) {
      _id
      status
      createdAt
      updatedAt
      history {
        status
        reviewComment
        dateTime
        userID
      }
      applicant {
        applicantID
        applicantName
      }
    }
  }
`;

export type Input = {
  id: string;
  assignee?: string;
};

export type Response = {
  reopenApprovedSubmissionRequest: Pick<
    Application,
    "_id" | "status" | "createdAt" | "updatedAt" | "history" | "applicant"
  >;
};
