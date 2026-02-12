import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, GetAppInput> = gql`
  query getApplication($id: ID!) {
    getApplication(_id: $id) {
      _id
      status
      createdAt
      updatedAt
      submittedDate
      openAccess
      controlledAccess
      PI
      history {
        status
        reviewComment
        dateTime
        userID
      }
      applicant {
        applicantID
        applicantName
      }
      newInstitutions {
        id
        name
      }
      programName
      studyAbbreviation
      questionnaireData
      conditional
      pendingConditions
      version
    }
  }
`;

export type GetAppInput = {
  /**
   * The unique ID of the Application to retrieve
   */
  id: string;
};

export type Response = {
  getApplication: Omit<Application, "questionnaireData"> & {
    questionnaireData: string; // Cast to QuestionnaireData
  };
};
