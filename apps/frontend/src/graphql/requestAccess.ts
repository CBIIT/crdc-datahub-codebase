import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation requestAccess(
    $role: String!
    $studies: [String]!
    $institutionName: String!
    $additionalInfo: String
  ) {
    requestAccess(
      role: $role
      studies: $studies
      institutionName: $institutionName
      additionalInfo: $additionalInfo
    ) {
      success
      message
    }
  }
`;

export type Input = {
  /**
   * The role the user is requesting access for.
   */
  role: UserRole;
  /**
   * The free-text name of the institution the user is affiliated with.
   */
  institutionName: string;
  /**
   * The list of approved study ID's the user is requesting access for.
   */
  studies: string[];
  /**
   * Any additional contextual information the user wants to provide.
   */
  additionalInfo?: string;
};

export type Response = {
  requestAccess: AsyncProcessResult;
};
