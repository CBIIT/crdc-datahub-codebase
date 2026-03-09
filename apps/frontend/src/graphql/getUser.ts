import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query getUser($userID: ID!) {
    getUser(userID: $userID) {
      _id
      firstName
      lastName
      userStatus
      role
      IDP
      email
      createdAt
      updateAt
      dataCommons
      dataCommonsDisplayNames
      studies {
        _id
        studyName
        studyAbbreviation
      }
      institution {
        _id
        name
      }
      permissions
      notifications
    }
  }
`;

export type Input = {
  userID: string;
};

export type Response = {
  getUser: User & {
    studies: Pick<ApprovedStudy, "_id" | "studyName" | "studyAbbreviation">[];
  };
};
