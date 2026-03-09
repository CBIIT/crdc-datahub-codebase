import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listReleasedStudies(
    $name: String
    $dbGaPID: String
    $dataCommonsDisplayNames: [String]!
    $first: Int = 20
    $offset: Int = 0
    $orderBy: String = "studyAbbreviation"
    $sortDirection: String = "ASC"
  ) {
    listReleasedStudies(
      name: $name
      dbGaPID: $dbGaPID
      dataCommonsDisplayNames: $dataCommonsDisplayNames
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      dataCommonsDisplayNames
      studies {
        _id
        studyName
        dbGaPID
        studyAbbreviation
        dataCommons
        dataCommonsDisplayNames
      }
    }
  }
`;

export type Input = {
  name?: string;
  dbGaPID?: string;
  dataCommonsDisplayNames: string[];
  first?: number;
  offset?: number;
  orderBy?: string;
  sortDirection?: Order;
};

export type Response = {
  listReleasedStudies: {
    total: number;
    dataCommonsDisplayNames: string[];
    studies: ReleasedStudy[];
  };
};
