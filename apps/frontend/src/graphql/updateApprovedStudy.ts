import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation updateApprovedStudy(
    $studyID: ID!
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
    $pendingImageDeIdentification: Boolean
    $GPAName: String
    $isPendingGPA: Boolean
    $status: String
  ) {
    updateApprovedStudy(
      studyID: $studyID
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
      pendingImageDeIdentification: $pendingImageDeIdentification
      GPAName: $GPAName
      isPendingGPA: $isPendingGPA
      status: $status
    ) {
      _id
    }
  }
`;

export type Input = {
  studyID: string;
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
  pendingImageDeIdentification: boolean;
  GPAName: string;
  isPendingGPA: boolean;
  status: string;
};

export type Response = {
  updateApprovedStudy: Pick<ApprovedStudy, "_id">;
};
