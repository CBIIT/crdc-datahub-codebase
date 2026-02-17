import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation approveApplication(
    $id: ID!
    $comment: String
    $wholeProgram: Boolean
    $pendingModelChange: Boolean
  ) {
    approveApplication(
      _id: $id
      wholeProgram: $wholeProgram
      comment: $comment
      pendingModelChange: $pendingModelChange
    ) {
      _id
    }
  }
`;

export type Input = {
  id: string;
  comment: string;
  wholeProgram: boolean;
  pendingModelChange: boolean;
};

export type Response = {
  approveApplication: Pick<Application, "_id">;
};
