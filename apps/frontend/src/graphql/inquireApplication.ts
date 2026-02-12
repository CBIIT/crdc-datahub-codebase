import gql from "graphql-tag";

export const mutation = gql`
  mutation inquireApplication($id: ID!, $comment: String!) {
    inquireApplication(_id: $id, comment: $comment) {
      _id
    }
  }
`;

export type Response = {
  inquireApplication: Pick<Application, "_id">;
};
