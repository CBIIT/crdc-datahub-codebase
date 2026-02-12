import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listInstitutions(
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $status: String
    $name: String
  ) {
    listInstitutions(
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
      status: $status
      name: $name
    ) {
      total
      institutions {
        _id
        name
        status
        submitterCount
      }
    }
  }
`;

export type Input = {
  first?: number;
  offset?: number;
  orderBy?: string;
  sortDirection?: Order;
  status?: Institution["status"] | "All";
  name?: Institution["name"];
};

export type Response = {
  listInstitutions: {
    total: number;
    institutions: Institution[];
  };
};
