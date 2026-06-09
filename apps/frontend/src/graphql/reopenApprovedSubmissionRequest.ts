import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation reopenApprovedSubmissionRequest($id: ID!, $ownerId: ID) {
    reopenApprovedSubmissionRequest(_id: $id, ownerId: $ownerId) {
      _id
    }
  }
`;

export type Input = {
  id: string;
  ownerId?: string;
};

export type Response = {
  reopenApprovedSubmissionRequest: Pick<Application, "_id">;
};
