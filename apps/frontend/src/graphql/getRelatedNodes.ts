import gql from "graphql-tag";

const RelatedNodeFragment = gql`
  fragment RelatedNodeFragment on Node {
    nodeType
    nodeID
    status
    props
  }
`;
export const query = gql`
  query getRelatedNodes(
    $submissionID: String!
    $nodeType: String!
    $nodeID: String!
    $relationship: String!
    $relatedNodeType: String!
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $propertiesOnly: Boolean = false
  ) {
    getRelatedNodes(
      submissionID: $submissionID
      nodeType: $nodeType
      nodeID: $nodeID
      relationship: $relationship
      relatedNodeType: $relatedNodeType
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total @skip(if: $propertiesOnly)
      properties @include(if: $propertiesOnly)
      IDPropName @include(if: $propertiesOnly)
      nodes {
        ...RelatedNodeFragment @skip(if: $propertiesOnly)
      }
    }
  }
  ${RelatedNodeFragment}
`;

export type Input = {
  submissionID: string;
  nodeType: string;
  nodeID: string;
  relationship: NodeRelationship;
  relatedNodeType: string;
  first?: number;
  offset?: number;
  orderBy?: string;
  sortDirection?: string;
  propertiesOnly?: boolean;
};

export type PropertiesOnlyResponse = {
  getRelatedNodes: Pick<RelatedNodes, "properties" | "IDPropName">;
};

export type Response = {
  getRelatedNodes: Pick<RelatedNodes, "nodes" | "total">;
};
