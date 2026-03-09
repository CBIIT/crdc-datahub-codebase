import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen, expect, waitFor } from "@storybook/test";
import React, { useEffect } from "react";

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
import { CollaboratorsProvider, useCollaboratorsContext } from "../Contexts/CollaboratorsContext";
import { SubmissionContext, SubmissionCtxState } from "../Contexts/SubmissionContext";

import CollaboratorsTable from "./CollaboratorsTable";

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

const TableWithAutoLoad: React.FC<{ isEdit: boolean }> = ({ isEdit }) => {
  const { loadPotentialCollaborators } = useCollaboratorsContext();
  useEffect(() => loadPotentialCollaborators(), [loadPotentialCollaborators]);
  return <CollaboratorsTable isEdit={isEdit} />;
};

const meta: Meta<typeof CollaboratorsTable> = {
  title: "Data Submissions / Collaborators Table",
  component: CollaboratorsTable,
  parameters: {
    layout: "fullscreen",
    apolloClient: { mocks: [listPotentialCollaboratorsMock] },
  },
  argTypes: {
    isEdit: { name: "Edit mode", control: "boolean" },
  },
  args: {
    isEdit: false,
  },
  decorators: [
    (Story) => {
      const authState: AuthCtxState = authCtxStateFactory.build({
        user: userFactory.build({
          _id: "user-1",
          firstName: "Example",
          role: "Submitter",
          permissions: ["data_submission:create"],
        }),
      });

      const submissionState: SubmissionCtxState = submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({
            _id: "submission-1",
            submitterID: "user-1",
            collaborators: collaboratorFactory.build(1, {
              collaboratorID: "user-2",
              collaboratorName: "Smith, 2 Jane",
              permission: "Can Edit",
            }),
          }),
          submissionStats: {
            stats: [],
          },
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
} satisfies Meta<typeof CollaboratorsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  args: { role: "Submitter", isEdit: true },
  render: (args) => <TableWithAutoLoad isEdit={args.isEdit} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);

    const addBtn = await c.findByTestId("add-collaborator-button");
    await waitFor(() => expect(addBtn).not.toBeDisabled());

    await userEvent.click(addBtn);
    const rows = await c.findAllByTestId(/collaborator-row-/);
    expect(rows.length).toBe(2);
  },
};

export const ViewOnly: Story = {
  args: { role: "Data Curator", isEdit: false },
  render: (args) => <TableWithAutoLoad isEdit={args.isEdit} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    expect(c.queryByTestId("remove-collaborator-button-0")).toBeNull();
  },
};

export const MaxReached: Story = {
  args: { role: "Submitter", isEdit: true },
  render: (args) => <TableWithAutoLoad isEdit={args.isEdit} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);

    const addBtn = await c.findByTestId("add-collaborator-button");
    await waitFor(() => expect(addBtn).not.toBeDisabled());

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
