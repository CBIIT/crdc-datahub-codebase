import gql from "graphql-tag";

export const query = gql`
  query retrieveCLIConfig(
    $_id: String!
    $apiURL: String!
    $dataFolder: String
    $manifest: String
    $archive_manifest: String
  ) {
    retrieveCLIConfig(
      submissionID: $_id
      apiURL: $apiURL
      dataFolder: $dataFolder
      manifest: $manifest
      archive_manifest: $archive_manifest
    )
  }
`;

export type Response = {
  /**
   * A string containing the Uploader CLI file config pre-filled template
   */
  retrieveCLIConfig: string;
};
