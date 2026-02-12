import gql from "graphql-tag";

export const query = gql`
  query listPotentialCollaborators($submissionID: String!) {
    listPotentialCollaborators(submissionID: $submissionID) {
      _id
      firstName
      lastName
    }
  }
`;

export type Input = {
  submissionID: string;
};

export type Response = {
  listPotentialCollaborators: Pick<User, "_id" | "firstName" | "lastName">[];
};
