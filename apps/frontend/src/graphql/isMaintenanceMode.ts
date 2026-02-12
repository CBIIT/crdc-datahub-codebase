import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const IS_MAINTENANCE_MODE: TypedDocumentNode<Response, null> = gql`
  query isMaintenanceMode {
    isMaintenanceMode
  }
`;

export type IsMaintenanceModeResponse = {
  /**
   * Whether the application is currently in maintenance mode.
   */
  isMaintenanceMode: boolean;
};
