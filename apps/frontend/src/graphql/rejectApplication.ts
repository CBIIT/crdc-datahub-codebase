import gql from "graphql-tag";

export const mutation = gql`
  mutation rejectApplication($id: ID!, $comment: String!) {
    rejectApplication(_id: $id, comment: $comment) {
      _id
    }
  }
`;

export type Response = {
  rejectApplication: Pick<Application, "_id">;
};
