import gql from "graphql-tag";

export const query = gql`
  query listUsers {
    listUsers {
      _id
      firstName
      lastName
      IDP
      email
      userStatus
      role
    }
  }
`;

export type Response = {
  listUsers: Pick<
    User,
    "_id" | "firstName" | "lastName" | "IDP" | "email" | "userStatus" | "role"
  >[];
};
