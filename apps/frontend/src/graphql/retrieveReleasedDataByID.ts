import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query retrieveReleasedDataByID(
    $submissionId: String!
    $nodeType: String!
    $nodeId: String!
    $status: String! = "Released"
  ) {
    retrieveReleasedDataByID(
      submissionID: $submissionId
      nodeType: $nodeType
      nodeID: $nodeId
      status: $status
    ) {
      nodeType
      nodeID
      props
    }
  }
`;

export type Input = {
  submissionId: string;
  nodeType: string;
  nodeId: string;
  status?: string;
};

export type Response = {
  /**
   * An containing the existing/new nodes,
   * where the first node is the new node and the second node is the existing node
   *
   * @note This is just a subset of the full data available. Refer to the GraphQL
   * documentation for more details.
   */
  retrieveReleasedDataByID: Array<Pick<SubmissionNode, "nodeType" | "nodeID" | "props">>;
};
