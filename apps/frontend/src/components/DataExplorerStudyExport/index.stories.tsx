import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, screen, fn } from "@storybook/test";

import {
  ListReleasedDataRecordsResponse,
  ListReleasedDataRecordsInput,
  LIST_RELEASED_DATA_RECORDS,
  DOWNLOAD_ALL_RELEASED_NODES,
  DownloadAllReleasedNodesResp,
  DownloadAllReleaseNodesInput,
} from "../../graphql";

import Button, { DataExplorerStudyExportProps } from "./index";

const mockListDataRecordsSuccess: MockedResponse<
  ListReleasedDataRecordsResponse,
  ListReleasedDataRecordsInput
> = {
  request: {
    query: LIST_RELEASED_DATA_RECORDS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listReleasedDataRecords: {
        total: 1,
        nodes: [
          {
            "parent.id": "mock-parent-id",
            data_file_type: "mock-file-type",
            file_size: 12345,
            file_name: "mock-file-name.txt",
          },
        ],
      },
    },
  },
};

const mockDownloadNodesResponse: MockedResponse<
  DownloadAllReleasedNodesResp,
  DownloadAllReleaseNodesInput
> = {
  request: {
    query: DOWNLOAD_ALL_RELEASED_NODES,
  },
  variableMatcher: () => true,
  result: {
    data: {
      downloadAllReleasedNodes: "https://localhost:4010/presigned-url-here",
    },
  },
};

type CustomStoryProps = DataExplorerStudyExportProps;

const meta: Meta<CustomStoryProps> = {
  title: "Data Explorer / Export Metadata Button",
  component: Button,
  args: {
    studyId: "mock-study-id",
    studyDisplayName: "Mock Study",
    nodeType: "participant",
    dataCommonsDisplayName: "MOCK-DC",
    columns: [
      {
        label: "Parent ID",
        field: "parent.id",
        renderValue: () => null,
      },
      {
        label: "File Name",
        field: "file_name",
        renderValue: () => null,
      },
      {
        label: "File Size",
        field: "file_size",
        renderValue: () => null,
      },
      {
        label: "File Type",
        field: "data_file_type",
        renderValue: () => null,
      },
    ],
  },
  beforeEach: () => {
    window.open = fn(window.open).mockImplementation(
      (_) =>
        ({
          close: () => {},
        }) as Window
    );
  },
  tags: ["autodocs"],
} satisfies Meta<CustomStoryProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...meta.args,
  },
  parameters: {
    apolloClient: {
      mocks: [mockListDataRecordsSuccess, mockDownloadNodesResponse],
    },
  },
};

export const Toggled: Story = {
  args: {
    ...meta.args,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");

    userEvent.click(button);

    await screen.findByText("Available Downloads");
  },
  parameters: {
    ...Default.parameters,
  },
};

export const Disabled: Story = {
  args: {
    ...meta.args,
    disabled: true,
  },
};
