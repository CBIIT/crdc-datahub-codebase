import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation updateInstitution($_id: ID!, $name: String, $status: String) {
    updateInstitution(_id: $_id, name: $name, status: $status) {
      _id
      name
      status
    }
  }
`;

export type Input = {
  _id: string;
  name: string;
  status: string;
};

export type Response = {
  updateInstitution: Pick<Institution, "_id" | "name" | "status">;
};
