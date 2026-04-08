import { MockedResponse } from "@apollo/client/testing";
import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, waitFor, within } from "@storybook/test";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { SubmissionContext, SubmissionCtxStatus } from "@/components/Contexts/SubmissionContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { DELETE_DATA_RECORDS, DeleteDataRecordsInput, DeleteDataRecordsResp } from "@/graphql";

import DeleteNodeDataButton from "./DeleteNodeDataButton";

const deleteDataRecordsMock: MockedResponse<DeleteDataRecordsResp, DeleteDataRecordsInput> = {
  request: {
    query: DELETE_DATA_RECORDS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      deleteDataRecords: {
        success: true,
        message: "",
      },
    },
  },
};

const meta: Meta<typeof DeleteNodeDataButton> = {
  title: "Data Submissions / Delete Node Data Button",
  component: DeleteNodeDataButton,
  tags: ["autodocs"],
  parameters: {
    apolloClient: {
      mocks: [deleteDataRecordsMock],
    },
  },
  decorators: [
    (Story) => (
      <Box mt={3}>
        <Story />
      </Box>
    ),
    (Story) => (
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          user: userFactory.build({
            permissions: ["data_submission:view", "data_submission:create"],
          }),
        })}
      >
        <SubmissionContext.Provider
          value={{
            status: SubmissionCtxStatus.LOADED,
            error: null,
            data: {
              getSubmission: submissionFactory.build({
                _id: "mock-submission-id",
                status: "In Progress",
              }),
              submissionStats: { stats: [] },
              getSubmissionAttributes: null,
            },
          }}
        >
          <Story />
        </SubmissionContext.Provider>
      </AuthContext.Provider>
    ),
  ],
} satisfies Meta<typeof DeleteNodeDataButton>;

export default meta;
type Story = StoryObj<typeof DeleteNodeDataButton>;

export const MetadataNode: Story = {
  name: "Metadata",
  args: {
    nodeType: "diagnosis",
    selectedItems: ["node-1"],
    selectType: "explicit",
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId("delete-node-data-button"));

    const dialog = await screen.findByRole("dialog");
    const checkbox = within(dialog).getByRole("checkbox", {
      name: /also delete associated data files/i,
    });

    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  },
};

export const MetadataNodeWithOrphanedFiles: Story = {
  name: "Metadata (Checkbox Toggled)",
  args: {
    ...MetadataNode.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId("delete-node-data-button"));

    const dialog = await screen.findByRole("dialog");
    const checkbox = within(dialog).getByRole("checkbox", {
      name: /also delete associated data files/i,
    });
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  },
};

export const DataFilesNode: Story = {
  name: "Data File",
  args: {
    ...MetadataNode.args,
    nodeType: "data file",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId("delete-node-data-button"));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("checkbox", {
        name: /also delete associated data files/i,
      })
    ).toBeNull();
  },
};

export const DisabledButton: Story = {
  name: "Disabled",
  args: {
    ...MetadataNode.args,
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("delete-node-data-button");

    expect(button).toBeDisabled();

    userEvent.hover(button, { pointerEventsCheck: 0 });

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  },
};
