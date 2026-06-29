import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listSubmissions(
    $organization: String
    $status: [String]
    $dataCommons: String
    $name: String
    $dbGaPID: String
    $submitterName: String
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $isInternalUser: Boolean = false
  ) {
    listSubmissions(
      organization: $organization
      status: $status
      dataCommons: $dataCommons
      name: $name
      dbGaPID: $dbGaPID
      submitterName: $submitterName
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      submissions {
        _id
        name
        submitterName
        dataCommonsDisplayName
        organization {
          name
        }
        study {
          studyName
          studyAbbreviation
          dbGaPID
        }
        modelVersion
        status
        archived
        conciergeName
        nodeCount
        createdAt
        updatedAt
        intention
        history {
          status
        }
        dataFileSize {
          formatted
        }
        submissionRequestID
        canViewSubmissionRequest
        adminSubmitComment @include(if: $isInternalUser)
      }
      organizations {
        _id
        name
      }
      submitterNames
      dataCommons
      dataCommonsDisplayNames
    }
  }
`;

export type Input = {
  organization?: string;
  status?: SubmissionStatus[];
  dataCommons?: string;
  name?: string;
  dbGaPID?: string;
  submitterName?: string;
  /**
   * Indicates whether the user making the request is an internal user.
   */
  isInternalUser?: boolean;
} & BasePaginationParams;

export type Response = {
  listSubmissions: {
    total: number;
    submissions: (Pick<
      Submission,
      | "_id"
      | "name"
      | "submitterName"
      | "dataCommonsDisplayName"
      | "organization"
      | "study"
      | "modelVersion"
      | "status"
      | "archived"
      | "conciergeName"
      | "nodeCount"
      | "createdAt"
      | "updatedAt"
      | "intention"
      | "adminSubmitComment"
    > & {
      dataFileSize: Pick<Submission["dataFileSize"], "formatted">;
      history: Pick<Submission["history"][number], "status">[];
      /**
       * The ID of the submission request associated with this submission, if it exists.
       */
      submissionRequestID: string;
      /**
       * Whether the current user can view the submission request associated with this submission.
       */
      canViewSubmissionRequest: boolean;
    })[];
    organizations: Pick<Organization, "_id" | "name">[];
    submitterNames: string[];
    dataCommons: string[];
    dataCommonsDisplayNames: string[];
  };
};
