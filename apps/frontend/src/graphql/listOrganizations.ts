import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listPrograms(
    $status: String!
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
  ) {
    listPrograms(
      status: $status
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      programs {
        _id
        name
        abbreviation
        description
        status
        conciergeName
        studies {
          _id
          studyName
          studyAbbreviation
        }
        readOnly
        createdAt
        updateAt
      }
    }
  }
`;

export type Input = {
  status: "All" | Organization["status"];
  first?: number;
  offset?: number;
  orderBy?: keyof Organization;
  sortDirection?: "asc" | "desc";
};

export type Response = {
  listPrograms: {
    total: number;
    programs: Array<
      Pick<
        Organization,
        | "_id"
        | "name"
        | "abbreviation"
        | "description"
        | "status"
        | "conciergeName"
        | "createdAt"
        | "updateAt"
        | "readOnly"
      > & {
        studies: Pick<Organization["studies"][number], "_id" | "studyName" | "studyAbbreviation">[];
      }
    >;
  };
};
