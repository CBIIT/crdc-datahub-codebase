import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const DOWNLOAD_DCF_MANIFEST: TypedDocumentNode<
  DownloadDCFManifestResp,
  DownloadDCFManifestInput
> = gql`
  query downloadDCFManifest($submissionID: String!) {
    downloadDCFManifest(submissionID: $submissionID)
  }
`;

export type DownloadDCFManifestInput = {
  /**
   * The ID of the Data Submission to download the DCF manifest for
   */
  submissionID: string;
};

export type DownloadDCFManifestResp = {
  /**
   * The presigned download URL for the DCF manifest TSV file.
   */
  downloadDCFManifest: string;
};
