import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const GET_PENDING_PVS: TypedDocumentNode<GetPendingPVsResponse, GetPendingPVsInput> = gql`
  query getPendingPVs($submissionID: String!) {
    getPendingPVs(submissionID: $submissionID) {
      id
      offendingProperty
      value
    }
  }
`;

export type GetPendingPVsInput = {
  submissionID: string;
};

export type GetPendingPVsResponse = {
  getPendingPVs: {
    id: string;
    /**
     * The property in the submission that has a pending PV request.
     */
    offendingProperty: string;
    /**
     * The value of the property that has a pending PV request.
     */
    value: string;
  }[];
};
