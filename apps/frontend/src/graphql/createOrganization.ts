import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation createOrganization(
    $name: String!
    $abbreviation: String!
    $description: String
    $conciergeID: String
  ) {
    createOrganization(
      name: $name
      abbreviation: $abbreviation
      description: $description
      conciergeID: $conciergeID
    ) {
      _id
      name
      abbreviation
      description
      status
      conciergeID
      conciergeName
      createdAt
      updateAt
    }
  }
`;

export type Input = {
  name: string;
  abbreviation: string;
  description: string;
  conciergeID: string;
};

export type Response = {
  createOrganization: Organization;
};
