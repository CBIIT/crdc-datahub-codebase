import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation createApprovedStudy(
    $name: String!
    $acronym: String
    $controlledAccess: Boolean!
    $openAccess: Boolean
    $dbGaPID: String
    $ORCID: String
    $programID: ID
    $PI: String
    $primaryContactID: String
    $useProgramPC: Boolean!
    $pendingModelChange: Boolean
    $GPAName: String
    $isPendingGPA: Boolean
  ) {
    createApprovedStudy(
      name: $name
      acronym: $acronym
      controlledAccess: $controlledAccess
      openAccess: $openAccess
      dbGaPID: $dbGaPID
      ORCID: $ORCID
      programID: $programID
      PI: $PI
      primaryContactID: $primaryContactID
      useProgramPC: $useProgramPC
      pendingModelChange: $pendingModelChange
      GPAName: $GPAName
      isPendingGPA: $isPendingGPA
    ) {
      _id
    }
  }
`;

export type Input = {
  name: string;
  acronym: string;
  controlledAccess: boolean;
  openAccess: boolean;
  dbGaPID: string;
  ORCID: string;
  programID: string;
  PI: string;
  primaryContactID: string;
  useProgramPC: boolean;
  pendingModelChange: boolean;
  GPAName: string;
  isPendingGPA: boolean;
};

export type Response = {
  createApprovedStudy: Pick<ApprovedStudy, "_id">;
};
