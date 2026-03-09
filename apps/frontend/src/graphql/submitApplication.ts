import gql from "graphql-tag";

export const mutation = gql`
  mutation submitApplication($id: ID!) {
    submitApplication(_id: $id) {
      _id
    }
  }
`;

export type Response = {
  submitApplication: Pick<Application, "_id">;
};
