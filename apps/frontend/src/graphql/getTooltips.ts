import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query getTooltips($keys: [String!]) {
    getTooltips(keys: $keys) {
      key
      value
    }
  }
`;

export type Input = {
  keys: Array<AuthPermissions | AuthNotifications>;
};

export type Response = {
  getTooltips: Array<{
    key: AuthPermissions | AuthNotifications;
    value: string;
  }>;
};
