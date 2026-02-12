import gql from "graphql-tag";

export const query = gql`
  query listActiveDCPs {
    listActiveDCPs(dataCommons: ["All"]) {
      userID
      firstName
      lastName
      createdAt
      updateAt
    }
  }
`;

export type Response = {
  listActiveDCPs: (Pick<User, "firstName" | "lastName" | "createdAt" | "updateAt"> & {
    userID: User["_id"];
  })[];
};
