import gql from "graphql-tag";

const SubmissionNodeFragment = gql`
  fragment SubmissionNodeFragment on Node {
    nodeType
    status
    props
  }
`;

export const query = gql`
  query getSubmissionNodes(
    $_id: String!
    $nodeType: String!
    $status: String
    $submittedID: String
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $partial: Boolean = false
  ) {
    getSubmissionNodes(
      submissionID: $_id
      nodeType: $nodeType
      status: $status
      nodeID: $submittedID
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      IDPropName @skip(if: $partial)
      properties @skip(if: $partial)
      nodes {
        nodeID
        ...SubmissionNodeFragment @skip(if: $partial)
      }
    }
  }
  ${SubmissionNodeFragment}
`;

export type Input = {
  /**
   * The `_id` of the Data Submission
   */
  _id: string;
  /**
   * The type of node to query for
   */
  nodeType: string;
  /**
   * Status filter for the current validation status of the node
   */
  status: "All" | ValidationStatus;
  /**
   * Optional fuzzy-filter for the submitted Node ID
   */
  submittedID?: string;
  /**
   * If true, only return the `total`, and `nodes.nodeID` fields
   * will be returned.
   */
  partial?: boolean;
} & BasePaginationParams;

export type Response<IsPartial = false> = {
  getSubmissionNodes: IsPartial extends false
    ? {
        /**
         * Total number of nodes in the submission.
         */
        total: number;
        /**
         * The ID/Key property of current node.
         *
         */
        IDPropName: string;
        /**
         * The list of all node properties including parents
         */
        properties: string[];
        /**
         * An array of nodes matching the queried node type
         *
         * @note Unused values are omitted from the query. See the type definition for additional fields.
         */
        nodes: Pick<SubmissionNode, "nodeType" | "nodeID" | "props" | "status">[];
      }
    : {
        total: number;
        nodes: Pick<SubmissionNode, "nodeID">[];
      };
};
