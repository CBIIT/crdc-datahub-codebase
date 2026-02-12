import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listApplications(
    $programName: String
    $studyName: String
    $statuses: [String]
    $submitterName: String
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
  ) {
    listApplications(
      programName: $programName
      studyName: $studyName
      statuses: $statuses
      submitterName: $submitterName
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
    ) {
      total
      applications {
        _id
        programName
        studyAbbreviation
        status
        createdAt
        updatedAt
        submittedDate
        applicant {
          applicantName
          applicantID
        }
        conditional
        pendingConditions
        version
      }
      programs
      studies
    }
  }
`;

export type Input = {
  programName: string;
  studyName: string;
  statuses: ApplicationStatus[];
  submitterName: string;
  first: number;
  offset: number;
  orderBy: string;
  sortDirection: Order;
};

export type Response = {
  listApplications: {
    total: number;
    applications: Omit<Application, "questionnaireData">[];
    programs: string[];
    studies: string[];
  };
};
