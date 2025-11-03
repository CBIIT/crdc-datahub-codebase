import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const mutation: TypedDocumentNode<Response, Input> = gql`
  mutation saveApplication($application: AppInput!, $status: String) {
    saveApplication(application: $application, status: $status) {
      _id
      status
      createdAt
      updatedAt
      submittedDate
      ORCID
      openAccess
      controlledAccess
      PI
      programName
      studyAbbreviation
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
      GPAName
    }
  }
`;

export type Input = {
  /**
   * The Submission Request input
   */
  application: {
    /**
     * The unique ID of the Application
     */
    _id: string;
    /**
     * The Study Name of the Application
     */
    studyName: string;
    /**
     * The Study Abbreviation or Study Name if the abbreviation is null
     */
    studyAbbreviation: string;
    /**
     * Stringified JSON Application Questionnaire Data
     *
     * @see {@link QuestionnaireData}
     */
    questionnaireData: string;
    /**
     * Whether the data submission will contain controlled access data
     */
    controlledAccess: boolean;
    /**
     * Whether the data submission will contain open access data
     */
    openAccess: boolean;
    /**
     * The Open Researcher and Contributor ID
     */
    ORCID?: string;
    /**
     * Principal Investigator's full name "<first name> <last name>"
     */
    PI: string;
    /**
     * The name for the application program
     */
    programName: string;
    /**
     * The abbreviation for the application program
     */
    programAbbreviation: string;
    /**
     * The description for the application program
     */
    programDescription: string;
    /**
     * An array of new institutions in the form.
     */
    newInstitutions: Array<{ id: string; name: string }>;
    /**
     * The name of the Genomic Program Administrator
     */
    GPAName: string;
  };
  /**
   * The status to save the application as
   */
  status?: Extends<ApplicationStatus, "New" | "In Progress">;
};

export type Response = {
  saveApplication: Omit<Application, "questionnaireData">;
};
