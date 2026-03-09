import gql from "graphql-tag";

export const query = gql`
  query listSubmissionNodeTypes($_id: ID!) {
    listSubmissionNodeTypes(_id: $_id)
  }
`;

export type Input = {
  _id: string;
};

export type Response = {
  listSubmissionNodeTypes: string[];
};
