// import { MockedResponse } from "@apollo/client/testing";
import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { Context as AuthContext, Status as AuthStatus } from "../Contexts/AuthContext";

import EditSubmissionNameDialog from "./EditSubmissionNameDialog";

const mockSubmission = submissionFactory.build({
  _id: "mock-submission-id",
  name: "Test Submission",
  submitterID: "user1",
});
const mockUser = userFactory.build({ _id: "user1", role: "Submitter" });

const meta: Meta<typeof EditSubmissionNameDialog> = {
  title: "Data Submissions/Edit Submission Name Dialog",
  component: EditSubmissionNameDialog,
  // tags: ["autodocs"],
  // parameters: {
  //    apolloClient: {
  //        mocks: [],
  //    }
  // }
  decorators: [
    (Story) => (
      <Box mt={3}>
        <Story />
      </Box>
    ),
    (Story) => (
      <AuthContext.Provider
        value={{
          status: AuthStatus.LOADED,
          isLoggedIn: true,
          user: mockUser,
        }}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof EditSubmissionNameDialog>;

export default meta;
type Story = StoryObj<typeof EditSubmissionNameDialog>;

export const Dialog: Story = {
  args: {
    open: true,
    submissionID: mockSubmission._id,
    initialValue: mockSubmission.name,
    onCancel: fn(),
    onSave: fn(),
  },
};
