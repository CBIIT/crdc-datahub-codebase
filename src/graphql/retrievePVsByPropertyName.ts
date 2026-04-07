import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const RETRIEVE_PVS_BY_PROPERTY_NAME: TypedDocumentNode<
  RetrievePVsByPropertyNameResponse,
  RetrievePVsByPropertyNameInput
> = gql`
  query retrievePVsByPropertyName(
    $propertyNames: [String!]!
    $modelName: String!
    $modelVersion: String!
  ) {
    retrievePVsByPropertyName(
      propertyNames: $propertyNames
      model: $modelName
      version: $modelVersion
    ) {
      property
      permissibleValues
    }
  }
`;

export type RetrievePVsByPropertyNameInput = {
  /**
   * The list of property names for which to retrieve permissible values.
   */
  propertyNames: string[];
  /**
   * The name of the model for which to retrieve permissible values.
   *
   * @note This should be derived from the YAML file `Handle` field.
   * @example "CDS"
   */
  modelName: string;
  /**
   * The version of the model for which to retrieve permissible values.
   *
   * @note This should be derived from the YAML file `Version` field.
   * @example "1.9.0"
   */
  modelVersion: string;
};

export type RetrievePVsByPropertyNameResponse = {
  retrievePVsByPropertyName: {
    /**
     * The property name for which the permissible values are retrieved.
     *
     * @see RetrievePVsByPropertyNameInput.propertyNames
     */
    property: string;
    /**
     * The list of permissible values for the given property name.
     */
    permissibleValues: string[];
  }[];
};
