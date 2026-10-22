import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { Context as AuthContext } from "@/components/Contexts/AuthContext";
import { SubmissionContext, SubmissionCtxStatus } from "@/components/Contexts/SubmissionContext";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import {
  DOWNLOAD_DCF_MANIFEST,
  DownloadDCFManifestInput,
  DownloadDCFManifestResp,
  type GetSubmissionResp,
} from "@/graphql";

import Button, { DCFManifestExportProps } from "./index";

const successDownloadMock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
  request: {
    query: DOWNLOAD_DCF_MANIFEST,
  },
  variableMatcher: () => true,
  result: {
    data: {
      downloadDCFManifest: "https://example.com/mock-dcf-manifest-url",
    },
  },
  maxUsageCount: Infinity,
};

const errorDownloadMock: MockedResponse<DownloadDCFManifestResp, DownloadDCFManifestInput> = {
  request: {
    query: DOWNLOAD_DCF_MANIFEST,
  },
  variableMatcher: () => true,
  error: new Error("Mock download error"),
  maxUsageCount: Infinity,
};

type CustomStoryProps = DCFManifestExportProps & {
  submissionId: string;
};

const meta: Meta<CustomStoryProps> = {
  title: "Data Submissions / DCF Manifest Download Button",
  tags: ["autodocs"],
  component: Button,
  args: {
    submissionId: "mock-submission-id",
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
      <AuthContext.Provider
        value={authCtxStateFactory.build({
          isLoggedIn: true,
          user: userFactory.build({
            role: "Admin",
            permissions: ["data_submission:review"],
          }),
        })}
      >
        <SubmissionContext.Provider
          value={{
            data: {
              getSubmission: {
                _id: context.args.submissionId,
                status: "Submitted",
                dataType: "Metadata and Data Files",
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
      </AuthContext.Provider>
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
    submissionId: "",
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
