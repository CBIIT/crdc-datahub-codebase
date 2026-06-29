import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor, within } from "@storybook/test";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import {
  LIST_USERS,
  ListUsersResp,
  REOPEN_APPROVED_SR,
  ReopenApprovedSRInput,
  ReopenApprovedSRResp,
} from "../../graphql";
import { Context as AuthContext } from "../Contexts/AuthContext";

import Button from "./index";

const mockListUsers: MockedResponse<ListUsersResp> = {
  request: {
    query: LIST_USERS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listUsers: [
        userFactory.build({
          _id: "user-1",
          firstName: "John",
          lastName: "Doe",
          userStatus: "Active",
          role: "User",
        }),
        userFactory.build({
          _id: "user-2",
          firstName: "Jane",
          lastName: "Smith",
          userStatus: "Active",
          role: "Submitter",
        }),
        userFactory.build({
          _id: "owner-1",
          firstName: "Current",
          lastName: "Owner",
          userStatus: "Active",
          role: "Submitter",
        }),
      ],
    },
  },
};

const mockReopenApp: MockedResponse<ReopenApprovedSRResp, ReopenApprovedSRInput> = {
  request: {
    query: REOPEN_APPROVED_SR,
  },
  variableMatcher: () => true,
  result: {
    data: {
      reopenApprovedSubmissionRequest: {
        _id: "new-revision-id",
        status: "Reopened",
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
        history: [],
        applicant: {
          applicantID: "owner-1",
          applicantName: "Current Owner",
        },
      } as ReopenApprovedSRResp["reopenApprovedSubmissionRequest"],
    },
  },
};

const meta: Meta<typeof Button> = {
  title: "Submission Requests / Reopen Application Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    onComplete: fn(),
    application: applicationFactory.build({
      _id: "mock-id",
      status: "Approved",
      nextRevisionId: null,
      studyAbbreviation: "TEST-STUDY",
      programName: "Test Program",
      programAbbreviation: "TP",
      applicant: applicantFactory.build({
        applicantID: "owner-1",
        applicantName: "Current Owner",
      }),
    }),
  },
  argTypes: {
    application: {
      control: { disable: true },
    },
  },
  parameters: {
    apolloClient: {
      mocks: [mockListUsers, mockReopenApp],
    },
  },
  decorators: [
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            _id: "admin-1",
            role: "Admin",
            permissions: ["submission_request:reopen"],
          }),
        })}
      >
        <Story />
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The Reopen button that appears in the SR table.
 */
export const Default: Story = {
  name: "Button",
};

/**
 * The confirmation dialog that appears when the Reopen button is clicked.
 */
export const ReopenDialog: Story = {
  name: "Reopen Confirmation Dialog",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = canvas.getByTestId("reopen-application-button");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  },
};
