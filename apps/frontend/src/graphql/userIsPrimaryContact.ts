import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query userIsPrimaryContact($userID: ID!) {
    userIsPrimaryContact(userID: $userID)
  }
`;

export type Input = {
  /**
   * The ID of the user to check if they are the primary contact
   */
  userID: string;
};

export type Response = {
  /**
   * Whether the user is currently assigned as primary contact for any Program or Study.
   */
  userIsPrimaryContact: boolean;
};
