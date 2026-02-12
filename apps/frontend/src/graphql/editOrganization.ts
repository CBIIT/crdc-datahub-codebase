import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation editOrganization(
    $orgID: ID!
    $name: String
    $abbreviation: String
    $description: String
    $conciergeID: String
    $status: String
  ) {
    editOrganization(
      orgID: $orgID
      name: $name
      abbreviation: $abbreviation
      description: $description
      conciergeID: $conciergeID
      status: $status
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
  orgID: string;
  name: string;
  abbreviation: string;
  description: string;
  conciergeID: string;
  status: Organization["status"];
};

export type Response = {
  editOrganization: Organization;
};
