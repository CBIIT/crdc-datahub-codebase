import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const RETRIEVE_PROPS_FOR_NODE_TYPE: TypedDocumentNode<
  RetrievePropsForNodeTypeResp,
  RetrievePropsForNodeTypeInput
> = gql`
  query retrievePropsForNodeType(
    $studyId: String!
    $dataCommonsDisplayName: String!
    $nodeType: String!
  ) {
    retrievePropsForNodeType(
      studyID: $studyId
      dataCommonsDisplayName: $dataCommonsDisplayName
      nodeType: $nodeType
    ) {
      name
      required
      group
    }
  }
`;

export type RetrievePropsForNodeTypeInput = {
  /**
   * The _ID of the Study to list nodes types for
   */
  studyId: string;
  /**
   * The display name of the Data Commons to filter node types by
   */
  dataCommonsDisplayName: string;
  /**
   * The name of the node type to retrieve properties for
   */
  nodeType: string;
};

export type RetrievePropsForNodeTypeResp = {
  retrievePropsForNodeType: Array<{
    /**
     * The name of the node property
     */
    name: string;
    /**
     * Whether this property is marked as required in the model definition file
     */
    required: boolean;
    /**
     * The group this property belongs to
     *
     * This can be one of:
     * - "model_defined": The property is defined in the model definition file.
     * - "not_defined": The property was included in a data submission but is not defined in the model.
     * - "internal": The property is an internal property used by the system (e.g. crdc_ic)
     */
    group: "model_defined" | "not_defined" | "internal";
  }>;
};
