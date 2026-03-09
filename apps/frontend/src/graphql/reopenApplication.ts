import gql from "graphql-tag";

export const mutation = gql`
  mutation reopenApplication($id: ID!) {
    reopenApplication(_id: $id) {
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

export type Response = {
  reopenApplication: Pick<
    Application,
    "_id" | "status" | "createdAt" | "updatedAt" | "history" | "applicant"
  >;
};
