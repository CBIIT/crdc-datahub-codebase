import gql from "graphql-tag";

export const mutation = gql`
  mutation reviewApplication($id: ID!) {
    reviewApplication(_id: $id) {
      _id
      status
    }
  }
`;

export type Input = {
  id: string;
};

export type Response = {
  reviewApplication: Pick<Application, "_id" | "status">;
};
