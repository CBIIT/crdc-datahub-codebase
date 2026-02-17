import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation createInstitution($name: String!, $status: String!) {
    createInstitution(name: $name, status: $status) {
      _id
    }
  }
`;

export type Input = {
  name: string;
  status: string;
};

export type Response = {
  createInstitution: Pick<Institution, "_id">;
};
