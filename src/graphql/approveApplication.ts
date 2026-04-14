import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation approveApplication(
    $id: ID!
    $comment: String
    $wholeProgram: Boolean
    $pendingModelChange: Boolean
    $pendingImageDeIdentification: Boolean
  ) {
    approveApplication(
      _id: $id
      wholeProgram: $wholeProgram
      comment: $comment
      pendingModelChange: $pendingModelChange
      pendingImageDeIdentification: $pendingImageDeIdentification
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
  pendingImageDeIdentification: boolean;
};

export type Response = {
  approveApplication: Pick<Application, "_id">;
};
