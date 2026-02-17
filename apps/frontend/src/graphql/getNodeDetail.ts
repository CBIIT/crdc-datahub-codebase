import gql from "graphql-tag";

export const query = gql`
  query getNodeDetail($submissionID: String!, $nodeType: String!, $nodeID: String!) {
    getNodeDetail(submissionID: $submissionID, nodeType: $nodeType, nodeID: $nodeID) {
      parents {
        nodeType
        total
      }
      children {
        nodeType
        total
      }
      IDPropName
    }
  }
`;

export type Input = {
  submissionID: string;
  nodeType: string;
  nodeID: string;
};

export type Response = {
  getNodeDetail: Pick<NodeDetailResult, "parents" | "children" | "IDPropName">;
};
