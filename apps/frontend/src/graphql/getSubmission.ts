import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

const PartialSubmissionFragment: TypedDocumentNode<Response, Input> = gql`
  fragment PartialSubmissionFragment on Submission {
    _id
    metadataValidationStatus
    fileValidationStatus
    crossSubmissionStatus
    deletingData
  }
`;

const FullSubmissionFragment: TypedDocumentNode<Response, Input> = gql`
  fragment FullSubmissionFragment on Submission {
    _id
    name
    submitterID
    submitterName
    organization {
      _id
      name
      abbreviation
    }
    dataCommons
    dataCommonsDisplayName
    modelVersion
    studyID
    studyAbbreviation
    studyName
    dbGaPID
    bucketName
    rootPath
    status
    metadataValidationStatus
    fileValidationStatus
    crossSubmissionStatus
    validationStarted
    validationEnded
    validationScope
    validationType
    deletingData
    history {
      status
      reviewComment
      dateTime
      userID
      userName
    }
    conciergeName
    conciergeEmail
    intention
    dataType
    otherSubmissions
    nodeCount
    collaborators {
      collaboratorID
      collaboratorName
      permission
    }
    dataFileSize {
      size
    }
    createdAt
    updatedAt
  }
`;

export const query: TypedDocumentNode<Response, Input> = gql`
  query getSubmission($id: ID!, $partial: Boolean = false) {
    getSubmission(_id: $id) {
      ...PartialSubmissionFragment
      ...FullSubmissionFragment @skip(if: $partial)
    }
    submissionStats(_id: $id) {
      stats {
        nodeName
        total
        new
        passed
        warning
        error
      }
    }
    getSubmissionAttributes(submissionID: $id) {
      submissionAttributes {
        isBatchUploading
        hasOrphanError
      }
    }
  }
  ${PartialSubmissionFragment}
  ${FullSubmissionFragment}
`;

export type Input = {
  /**
   * The submission ID
   */
  id: string;
  /**
   * If true, only fetch minimal fields. This is used
   * to determine if polling should continue or stop
   */
  partial?: boolean;
};

export type Response<IsPartial = false> = {
  /**
   * The submission object
   */
  getSubmission: IsPartial extends true
    ? Pick<
        Submission,
        | "_id"
        | "metadataValidationStatus"
        | "fileValidationStatus"
        | "crossSubmissionStatus"
        | "deletingData"
      >
    : Submission;
  /**
   * The node statistics for the submission
   */
  submissionStats?: {
    stats: SubmissionStatistic[];
  };
  /**
   * The submission attributes and validation status
   */
  getSubmissionAttributes: {
    /**
     * The submission attributes
     */
    submissionAttributes: Pick<SubmissionAttributes, "isBatchUploading" | "hasOrphanError">;
  };
};
