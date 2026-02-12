import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const UPDATE_SUBMISSION_INFO: TypedDocumentNode<
  UpdateSubmissionInfoResp,
  UpdateSubmissionInfoInput
> = gql`
  mutation updateSubmissionInfo($_id: String!, $version: String, $submitterID: String) {
    updateSubmissionInfo(_id: $_id, version: $version, submitterID: $submitterID) {
      _id
      modelVersion
      submitterID
      submitterName
    }
  }
`;

export type UpdateSubmissionInfoInput = {
  /**
   * ID of the submission to change the model version for
   */
  _id: string;
  /**
   * The version of the Data Model to change to
   */
  version?: string;
  /**
   * The UUID of the user to reassign the submission to
   */
  submitterID?: string;
};

export type UpdateSubmissionInfoResp = {
  updateSubmissionInfo: Pick<Submission, "_id" | "modelVersion" | "submitterID" | "submitterName">;
};
