import gql from "graphql-tag";

export const mutation = gql`
  mutation {
    grantToken {
      tokens
      message
    }
  }
`;

export type Response = {
  grantToken: {
    tokens: string[];
    message: string;
  };
};
