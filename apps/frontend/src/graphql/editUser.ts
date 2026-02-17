import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation editUser(
    $userID: ID!
    $userStatus: String
    $role: String
    $studies: [String]
    $institution: String
    $dataCommons: [String]
    $permissions: [String]
    $notifications: [String]
  ) {
    editUser(
      userID: $userID
      status: $userStatus
      role: $role
      studies: $studies
      institutionID: $institution
      dataCommons: $dataCommons
      permissions: $permissions
      notifications: $notifications
    ) {
      userStatus
      role
      dataCommons
      dataCommonsDisplayNames
      studies {
        _id
        studyName
        studyAbbreviation
        dbGaPID
        controlledAccess
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
  /**
   * The UUIDv4 identifier of the user account
   */
  userID: User["_id"];
  /**
   * An array of studyIDs to assign to the user
   */
  studies: string[];
  /**
   * The `_id` of the institution to assign to the user
   */
  institution: string;
} & Pick<User, "userStatus" | "role" | "dataCommons" | "permissions" | "notifications">;

export type Response = {
  editUser: Pick<
    User,
    | "userStatus"
    | "role"
    | "dataCommons"
    | "dataCommonsDisplayNames"
    | "permissions"
    | "notifications"
    | "institution"
  > & {
    studies: Pick<
      ApprovedStudy,
      "_id" | "studyName" | "studyAbbreviation" | "dbGaPID" | "controlledAccess"
    >[];
  };
};
