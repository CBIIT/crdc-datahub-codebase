import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation restoreApplication($_id: ID!, $comment: String!) {
    restoreApplication(_id: $_id, comment: $comment) {
      _id
    }
  }
`;

export type Input = {
  /**
   * ID of the application to restore
   */
  _id: string;
  /**
   * Justification for restoring the application
   */
  comment: string;
};

export type Response = {
  restoreApplication: Pick<Application, "_id">;
};
