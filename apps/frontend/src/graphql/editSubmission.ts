import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation editSubmission($_id: String!, $newName: String!) {
    editSubmission(_id: $_id, newName: $newName) {
      _id
      name
    }
  }
`;

export type Input = {
  _id: string;
  newName: string;
};

export type Response = {
  editSubmission: Pick<Submission, "_id" | "name">;
};
