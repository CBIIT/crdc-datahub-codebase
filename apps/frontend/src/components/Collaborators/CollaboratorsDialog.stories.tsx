import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, screen, expect, waitFor } from "@storybook/test";
import React, { ComponentPropsWithoutRef } from "react";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { TOOLTIP_TEXT } from "../../config/DashboardTooltips";
import {
  LIST_POTENTIAL_COLLABORATORS,
  ListPotentialCollaboratorsInput,
  ListPotentialCollaboratorsResp,
} from "../../graphql";
import { Context as AuthContext, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import { CollaboratorsProvider } from "../Contexts/CollaboratorsContext";
import { SubmissionContext, SubmissionCtxState } from "../Contexts/SubmissionContext";

import CollaboratorsDialog from "./CollaboratorsDialog";

const NUM_COLLABORATORS = 5;

const listPotentialCollaboratorsMock: MockedResponse<
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput
> = {
  request: {
    query: LIST_POTENTIAL_COLLABORATORS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listPotentialCollaborators: userFactory
        .pick(["_id", "firstName", "lastName"])
        .build(NUM_COLLABORATORS, (index) => ({
          _id: `user-${index + 1}`,
          firstName: `${index + 1} Jane`,
          lastName: "Smith",
        })),
    },
  },
};

type ContextArgs = {
  isEdit: boolean;
  userRole: UserRole;
  submissionStatus: SubmissionStatus;
  collaboratorsCount: number;
};

type ComponentProps = ComponentPropsWithoutRef<typeof CollaboratorsDialog>;

type StoryArgs = ContextArgs & ComponentProps;

const meta: Meta<StoryArgs> = {
  title: "Data Submissions / Collaborators Dialog",
  component: CollaboratorsDialog,
  parameters: {
    layout: "fullscreen",
    apolloClient: { mocks: [listPotentialCollaboratorsMock] },
  },
  argTypes: {
    isEdit: { name: "Edit mode", control: "boolean" },
    userRole: {
      name: "User Role",
      control: "select",
      options: [
        "User",
        "Submitter",
        "Admin",
        "Data Commons Personnel",
        "Federal Lead",
      ] as UserRole[],
      defaultValue: "Submitter",
    },
    submissionStatus: {
      name: "Submission Status",
      control: "select",
      options: [
        "New",
        "In Progress",
        "Canceled",
        "Withdrawn",
        "Released",
        "Rejected",
        "Completed",
        "Deleted",
      ] as SubmissionStatus[],
      defaultValue: "In Progress",
    },
    collaboratorsCount: {
      name: "Collaborators Count",
      control: { type: "number", min: 0, max: NUM_COLLABORATORS },
      defaultValue: 1,
    },
  },
  args: {
    isEdit: false,
    userRole: "Submitter",
    submissionStatus: "In Progress",
    collaboratorsCount: 1,
    open: true,
  },
  decorators: [
    (Story, ctx) => {
      const { isEdit, userRole, submissionStatus, collaboratorsCount } = ctx.args;
      const authState: AuthCtxState = authCtxStateFactory.build({
        user: userFactory.build({
          _id: "user-1",
          firstName: "Example",
          role: userRole,
          permissions: ["data_submission:create"],
        }),
      });

      const submissionState: SubmissionCtxState = submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({
            _id: "submission-1",
            submitterID: isEdit ? "user-1" : "other-user",
            collaborators: collaboratorFactory.build(collaboratorsCount, (i) => ({
              collaboratorID: `user-${i + 2}`,
              collaboratorName: `Smith, ${i + 2} Jane`,
              permission: "Can Edit",
            })),
            status: submissionStatus,
          }),
          submissionStats: { stats: [] },
          getSubmissionAttributes: {
            submissionAttributes: submissionAttributesFactory
              .pick(["hasOrphanError", "isBatchUploading"])
              .build({
                hasOrphanError: false,
                isBatchUploading: false,
              }),
          },
        },
      });

      return (
        <AuthContext.Provider value={authState}>
          <SubmissionContext.Provider value={submissionState}>
            <CollaboratorsProvider>
              <Story />
            </CollaboratorsProvider>
          </SubmissionContext.Provider>
        </AuthContext.Provider>
      );
    },
  ],
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  args: { isEdit: true, open: true },
  play: async () => {
    await expect(await screen.findByTestId("collaborators-dialog")).toBeInTheDocument();
    await expect(await screen.findByTestId("collaborators-dialog-header")).toBeInTheDocument();

    const saveBtn = await screen.findByTestId("collaborators-dialog-save-button");
    await expect(saveBtn).not.toBeDisabled();

    const addBtn = await screen.findByTestId("add-collaborator-button");
    await userEvent.click(addBtn);

    const rows = await screen.findAllByTestId(/collaborator-row-/);
    expect(rows.length).toBe(2);
  },
};

export const ViewOnly: Story = {
  args: { isEdit: false, open: true },
  play: async () => {
    await expect(await screen.findByTestId("collaborators-dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("collaborators-dialog-save-button")).toBeNull();

    await expect(
      await screen.findByTestId("collaborators-dialog-close-button")
    ).toBeInTheDocument();
  },
};

export const MaxReached: Story = {
  args: { isEdit: true, open: true },
  play: async () => {
    await expect(await screen.findByTestId("collaborators-dialog")).toBeInTheDocument();

    const addBtn = await screen.findByTestId("add-collaborator-button");
    new Array(NUM_COLLABORATORS - 1).fill(null).forEach(() => {
      userEvent.click(addBtn);
    });

    await waitFor(() => expect(addBtn).toBeDisabled());

    await userEvent.hover(addBtn);
    const tooltip = await screen.findByText(
      TOOLTIP_TEXT.COLLABORATORS_DIALOG.ACTIONS.ADD_COLLABORATOR_DISABLED
    );
    expect(tooltip).toBeInTheDocument();
  },
};
