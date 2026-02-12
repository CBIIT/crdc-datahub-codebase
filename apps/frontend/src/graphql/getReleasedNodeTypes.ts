import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const GET_RELEASED_NODE_TYPES: TypedDocumentNode<
  GetReleasedNodeTypesResp,
  GetReleasedNodeTypesInput
> = gql`
  query getReleaseNodeTypes($studyId: String!, $dataCommonsDisplayName: String!) {
    getReleaseNodeTypes(studyID: $studyId, dataCommonsDisplayName: $dataCommonsDisplayName) {
      nodes {
        name
        IDPropName
        count
      }
    }
  }
`;

export type GetReleasedNodeTypesInput = {
  /**
   * The _ID of the Study to list nodes types for
   */
  studyId: string;
  /**
   * The display name of the Data Commons to filter node types by
   */
  dataCommonsDisplayName: string;
};

export type GetReleasedNodeTypesResp = {
  getReleaseNodeTypes: {
    nodes: Array<{
      /**
       * The name of the node type
       */
      name: string;
      /**
       * The name of the ID Property for this node type
       */
      IDPropName: string;
      /**
       * The count of nodes of this type currently released
       */
      count: number;
    }>;
  };
};
