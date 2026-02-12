import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query getInstitution($_id: ID!) {
    getInstitution(_id: $_id) {
      _id
      name
      status
    }
  }
`;

export type Input = {
  _id: string;
};

export type Response = {
  getInstitution: Pick<Institution, "_id" | "name" | "status">;
};
