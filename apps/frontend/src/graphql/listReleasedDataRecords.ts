import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const LIST_RELEASED_DATA_RECORDS: TypedDocumentNode<
  ListReleasedDataRecordsResponse,
  ListReleasedDataRecordsInput
> = gql`
  query listReleasedDataRecords(
    $studyId: String!
    $nodeType: String!
    $dataCommonsDisplayName: String!
    $properties: [String] = []
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
  ) {
    listReleasedDataRecords(
      studyID: $studyId
      nodeType: $nodeType
      dataCommonsDisplayName: $dataCommonsDisplayName
      properties: $properties
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      nodes
    }
  }
`;

export type ListReleasedDataRecordsInput = {
  /**
   * The _ID of the Study to list nodes for
   */
  studyId: string;
  /**
   * The type of node to query data for
   */
  nodeType: string;
  /**
   * The display name of the Data Commons to filter nodes by
   */
  dataCommonsDisplayName: string;
  /**
   * An optional list of properties to include in the results,
   * if not provided all properties will be included
   */
  properties?: string[];
} & BasePaginationParams;

export type ListReleasedDataRecordsResponse = {
  listReleasedDataRecords: {
    /**
     * The total number of records returned
     */
    total: number;
    /**
     * An array of JSON objects representing the nodes
     */
    nodes: Record<string, unknown>[];
  };
};
