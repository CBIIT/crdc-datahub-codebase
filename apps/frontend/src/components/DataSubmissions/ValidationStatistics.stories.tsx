import type { Meta, StoryObj } from "@storybook/react";

import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionStatisticFactory } from "@/factories/submission/SubmissionStatisticFactory";

import { GetSubmissionResp } from "../../graphql";
import { SubmissionContext, SubmissionCtxStatus } from "../Contexts/SubmissionContext";

import ValidationStatistics from "./ValidationStatistics";

type CustomStoryProps = React.ComponentProps<typeof ValidationStatistics> & {
  submission: GetSubmissionResp["getSubmission"];
  status: SubmissionCtxStatus;
  statistics: SubmissionStatistic[];
};

const meta: Meta<CustomStoryProps> = {
  title: "Data Submissions / Validation Statistics",
  component: ValidationStatistics,
  tags: ["autodocs"],
  argTypes: {
    submission: { control: false },
    statistics: { control: false },
    status: {
      options: [
        SubmissionCtxStatus.LOADED,
        SubmissionCtxStatus.LOADING,
        SubmissionCtxStatus.POLLING,
        SubmissionCtxStatus.ERROR,
      ],
      control: {
        type: "radio",
      },
    },
  },
  args: {
    status: SubmissionCtxStatus.LOADED,
  },
  decorators: [
    (Story, context) => (
      <SubmissionContext.Provider
        value={submissionCtxStateFactory.build({
          data: {
            getSubmission: context.args.submission,
            submissionStats: { stats: context.args.statistics },
            getSubmissionAttributes: {
              submissionAttributes: submissionAttributesFactory
                .pick(["hasOrphanError", "isBatchUploading"])
                .build({
                  hasOrphanError: false,
                  isBatchUploading: false,
                }),
            },
          } as GetSubmissionResp,
          status: context.args.status,
          error: null,
        })}
      >
        <Story />
      </SubmissionContext.Provider>
    ),
  ],
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<CustomStoryProps>;

const mockData: SubmissionStatistic[] = [
  submissionStatisticFactory.build({
    nodeName: "mock-node",
    total: 200,
    new: 50,
    passed: 50,
    warning: 50,
    error: 50,
  }),
  submissionStatisticFactory.build({
    nodeName: "mock-node-2",
    total: 75,
    new: 10,
    passed: 50,
    warning: 15,
    error: 0,
  }),
  submissionStatisticFactory.build({
    nodeName: "mock-node-3",
    total: 300,
    new: 0,
    passed: 0,
    warning: 0,
    error: 300,
  }),
  submissionStatisticFactory.build({
    nodeName: "mock-node-4",
    total: 150,
    new: 125,
    passed: 25,
    warning: 0,
    error: 0,
  }),
  submissionStatisticFactory.build({
    nodeName: "mock-node-5",
    total: 400,
    new: 380,
    passed: 0,
    warning: 20,
    error: 0,
  }),
  submissionStatisticFactory.build({
    nodeName: "mock-node-6",
    total: 100,
    new: 50,
    passed: 50,
    warning: 0,
    error: 0,
  }),
];

export const Default: Story = {
  args: {
    submission: {
      _id: "mock id",
    } as Submission,
    statistics: [...mockData],
  },
};

export const NoData: Story = {
  args: {
    submission: {
      _id: "mock id",
    } as Submission,
    statistics: [],
  },
};

export const Loading: Story = {
  args: {
    submission: null,
    statistics: null,
    status: SubmissionCtxStatus.LOADING,
  },
};

export default meta;
