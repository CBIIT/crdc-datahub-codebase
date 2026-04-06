import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query getOrganizationData($orgID: ID!) {
    getOrganization(orgID: $orgID) {
      _id
      name
      abbreviation
      description
      status
      conciergeID
      conciergeName
      studies {
        _id
      }
      readOnly
      createdAt
      updateAt
    }
  }
`;

export type Input = {
  orgID: string;
};

export type Response = {
  /**
   * The organization that was requested
   */
  getOrganization: Organization;
};
