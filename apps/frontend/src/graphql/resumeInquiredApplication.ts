import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation resumeInquiredApplication($id: ID!) {
    resumeInquiredApplication(_id: $id) {
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
};

export type Response = {
  resumeInquiredApplication: Pick<
    Application,
    "_id" | "status" | "createdAt" | "updatedAt" | "history" | "applicant"
  >;
};
