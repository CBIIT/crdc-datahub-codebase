import gql from "graphql-tag";

export const mutation = gql`
  mutation validateSubmission($_id: ID!, $types: [String], $scope: String) {
    validateSubmission(_id: $_id, types: $types, scope: $scope) {
      success
    }
  }
`;

export type Input = {
  _id: string;
  types?: ValidationType[];
  scope?: ValidationTarget;
};

export type Response = {
  validateSubmission: Pick<AsyncProcessResult, "success">;
};
