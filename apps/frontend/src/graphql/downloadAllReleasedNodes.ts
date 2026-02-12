import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const DOWNLOAD_ALL_RELEASED_NODES: TypedDocumentNode<
  DownloadAllReleasedNodesResp,
  DownloadAllReleaseNodesInput
> = gql`
  query listReleasedDataRecords($studyId: String!, $dataCommonsDisplayName: String!) {
    downloadAllReleasedNodes(studyID: $studyId, dataCommonsDisplayName: $dataCommonsDisplayName)
  }
`;

export type DownloadAllReleaseNodesInput = {
  /**
   * The _ID of the study to generate the released nodes zip for
   */
  studyId: string;
  /**
   * The display name for the Data Commons to export data for
   */
  dataCommonsDisplayName: string;
};

export type DownloadAllReleasedNodesResp = {
  /**
   * The URL to the pre-signed S3 zip file
   */
  downloadAllReleasedNodes: string;
};
