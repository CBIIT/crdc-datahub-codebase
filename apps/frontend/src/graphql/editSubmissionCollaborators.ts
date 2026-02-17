import gql from "graphql-tag";

export const mutation = gql`
  mutation editSubmissionCollaborators($submissionID: ID!, $collaborators: [CollaboratorInput]) {
    editSubmissionCollaborators(submissionID: $submissionID, collaborators: $collaborators) {
      _id
      collaborators {
        collaboratorID
        collaboratorName
        permission
      }
    }
  }
`;

export type Input = {
  submissionID: string;
  collaborators: CollaboratorInput[];
};

export type Response = {
  editSubmissionCollaborators: Pick<Submission, "_id" | "collaborators">;
};
