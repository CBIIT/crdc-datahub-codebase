import gql from "graphql-tag";

export const mutation = gql`
  mutation deleteDataRecords(
    $_id: String!
    $nodeType: String!
    $nodeIds: [String!]
    $deleteAll: Boolean
    $exclusiveIDs: [String!]
  ) {
    deleteDataRecords(
      submissionID: $_id
      nodeType: $nodeType
      nodeIDs: $nodeIds
      deleteAll: $deleteAll
      exclusiveIDs: $exclusiveIDs
    ) {
      success
      message
    }
  }
`;

export type Input = {
  /**
   * The ID of the data submission to delete the records from
   */
  _id: string;
  /**
   * The type of node to delete
   */
  nodeType: string;
  /**
   * An array of the IDs of the nodes to delete.
   * Should NOT be provided when using deleteAll with exclusiveIDs.
   */
  nodeIds?: string[];
  /**
   * Whether to delete all nodes of this type.
   * When true, uses exclusiveIDs to specify exceptions.
   */
  deleteAll?: boolean;
  /**
   * An array of node IDs to exclude from deletion when deleteAll is true.
   * Has a length limit of 2000.
   */
  exclusiveIDs?: string[];
};

export type Response = {
  deleteDataRecords: AsyncProcessResult;
};
