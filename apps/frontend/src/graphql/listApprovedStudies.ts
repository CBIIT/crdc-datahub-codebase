import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query listApprovedStudies(
    $first: Int
    $offset: Int
    $orderBy: String
    $sortDirection: String
    $dbGaPID: String
    $controlledAccess: String
    $study: String
    $programID: ID
  ) {
    listApprovedStudies(
      first: $first
      offset: $offset
      orderBy: $orderBy
      sortDirection: $sortDirection
      dbGaPID: $dbGaPID
      controlledAccess: $controlledAccess
      study: $study
      programID: $programID
    ) {
      total
      studies {
        _id
        studyName
        studyAbbreviation
        dbGaPID
        controlledAccess
        openAccess
        PI
        ORCID
        primaryContact {
          _id
          firstName
          lastName
        }
        program {
          _id
          name
          conciergeID
          conciergeName
        }
        useProgramPC
        pendingModelChange
        isPendingGPA
        createdAt
      }
    }
  }
`;

export type Input = {
  first?: number;
  offset?: number;
  orderBy?: string;
  sortDirection?: Order;
  dbGaPID?: string;
  controlledAccess?: AccessType;
  openAccess?: boolean;
  study?: string;
  programID?: string;
};

export type Response = {
  listApprovedStudies: {
    total: number;
    studies: ApprovedStudy[];
  };
};
