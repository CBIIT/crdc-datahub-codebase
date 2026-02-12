import gql from "graphql-tag";

export const query = gql`
  query getDashboardURL($type: String!) {
    getDashboardURL(type: $type) {
      url
    }
  }
`;

export type Input = {
  type: string;
};

export type Response = {
  getDashboardURL: {
    url: string;
  };
};
