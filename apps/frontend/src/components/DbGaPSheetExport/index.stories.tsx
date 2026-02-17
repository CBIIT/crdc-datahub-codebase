import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { DataCommons } from "../../config/DataCommons";
import {
  DOWNLOAD_DB_GAP_SHEET,
  DownloadDbGaPSheetInput,
  DownloadDbGaPSheetResp,
  type GetSubmissionResp,
} from "../../graphql";
import { SubmissionContext, SubmissionCtxStatus } from "../Contexts/SubmissionContext";

import Button, { DbGaPSheetExportProps } from "./index";

const successDownloadMock: MockedResponse<DownloadDbGaPSheetResp, DownloadDbGaPSheetInput> = {
  request: {
    query: DOWNLOAD_DB_GAP_SHEET,
  },
  variableMatcher: () => true,
  result: {
    data: {
      downloadDBGaPLoadSheet: "https://example.com/mock-sheet-url",
    },
  },
  maxUsageCount: Infinity,
};

const errorDownloadMock: MockedResponse<DownloadDbGaPSheetResp, DownloadDbGaPSheetInput> = {
  request: {
    query: DOWNLOAD_DB_GAP_SHEET,
  },
  variableMatcher: () => true,
  error: new Error("Mock download error"),
  maxUsageCount: Infinity,
};

type CustomStoryProps = DbGaPSheetExportProps & {
  dataCommons: string;
  submissionId: string;
};

const meta: Meta<CustomStoryProps> = {
  title: "Data Submissions / dbGaP Sheets Button",
  tags: ["autodocs"],
  component: Button,
  args: {
    submissionId: "mock-submission-id",
    dataCommons: DataCommons[0].name,
  },
  argTypes: {
    dataCommons: {
      description: "The data commons associated with the submission",
      control: "select",
      options: DataCommons.map((dc) => dc.name),
    },
  },
  beforeEach: () => {
    window.open = fn(window.open).mockImplementation(
      (_) =>
        ({
          close: () => {},
        }) as Window
    );
  },
  decorators: [
    (Story, context) => (
      <SubmissionContext.Provider
        value={{
          data: {
            getSubmission: {
              _id: context.args.submissionId,
              dataCommons: context.args.dataCommons,
            } as GetSubmissionResp["getSubmission"],
            getSubmissionAttributes: {
              submissionAttributes: {
                hasOrphanError: false,
                isBatchUploading: false,
              },
            },
            submissionStats: null,
          },
          status: SubmissionCtxStatus.LOADED,
          error: null,
        }}
      >
        <Story />
      </SubmissionContext.Provider>
    ),
  ],
} satisfies Meta<CustomStoryProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...meta.args,
  },
  parameters: {
    apolloClient: {
      mocks: [successDownloadMock],
    },
  },
};

export const Disabled: Story = {
  args: {
    ...meta.args,
    disabled: true,
  },
  parameters: {
    apolloClient: {
      mocks: [successDownloadMock],
    },
  },
};

export const Hidden: Story = {
  args: {
    ...meta.args,
    dataCommons: "UNSUPPORTED_DC",
  },
  parameters: {
    apolloClient: {
      mocks: [successDownloadMock],
    },
  },
};

export const DownloadError: Story = {
  args: {
    ...meta.args,
  },
  parameters: {
    apolloClient: {
      mocks: [errorDownloadMock],
    },
  },
};
