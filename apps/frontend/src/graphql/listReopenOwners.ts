import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response> = gql`
  query listReopenOwners {
    listReopenOwners {
      userID
      firstName
      lastName
    }
  }
`;

export type Response = {
  listReopenOwners: (Pick<User, "firstName" | "lastName"> & { userID: User["_id"] })[];
};
