import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response> = gql`
  query getMyUser {
    getMyUser {
      _id
      firstName
      lastName
      userStatus
      role
      IDP
      email
      dataCommons
      dataCommonsDisplayNames
      studies {
        _id
        studyName
        studyAbbreviation
        dbGaPID
        controlledAccess
        pendingModelChange
        isPendingGPA
      }
      institution {
        _id
        name
      }
      permissions
      notifications
      createdAt
      updateAt
    }
  }
`;

export type Response = {
  getMyUser: User & {
    studies: Pick<
      ApprovedStudy,
      | "_id"
      | "studyName"
      | "studyAbbreviation"
      | "dbGaPID"
      | "controlledAccess"
      | "pendingModelChange"
      | "isPendingGPA"
    >[];
  };
};
