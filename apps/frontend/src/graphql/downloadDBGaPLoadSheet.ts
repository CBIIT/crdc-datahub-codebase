import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const DOWNLOAD_DB_GAP_SHEET: TypedDocumentNode<
  DownloadDbGaPSheetResp,
  DownloadDbGaPSheetInput
> = gql`
  query downloadDBGaPLoadSheet($submissionID: String!) {
    downloadDBGaPLoadSheet(submissionID: $submissionID)
  }
`;

export type DownloadDbGaPSheetInput = {
  /**
   * The ID of the Data Submission to download the dbGaP loading sheet for
   */
  submissionID: string;
};

export type DownloadDbGaPSheetResp = {
  /**
   * The presigned download URL for the dbGaP loading sheet zip.
   */
  downloadDBGaPLoadSheet: string;
};
