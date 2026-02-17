import gql from "graphql-tag";

export const query = gql`
  query getMyLastApplication {
    getMyLastApplication {
      _id
      questionnaireData
    }
  }
`;

export type Response = {
  getMyLastApplication: {
    /**
     * Unique identifier for the application
     */
    _id: Application["_id"];
    /**
     * A stringified JSON object containing the Questionnaire data
     *
     * @see {@link QuestionnaireData}
     */
    questionnaireData: string;
  };
};
