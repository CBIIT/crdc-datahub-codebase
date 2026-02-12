import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SnackbarProvider } from "notistack";
import { useMemo } from "react";

import { nodeTypeSummaryFactory } from "@/factories/submission/NodeTypeSummaryFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  GET_SUBMISSION_SUMMARY,
  type GetSubmissionSummaryResp,
  type GetSubmissionSummaryInput,
} from "@/graphql";

import { SubmissionContext } from "../Contexts/SubmissionContext";

import SubmitDialog from "./index";

type ProviderProps = {
  submission?: Submission;
  mocks?: ReadonlyArray<MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput>>;
  children: React.ReactNode;
};

const Provider = ({ submission, mocks = [], children }: ProviderProps) => {
  const ctxValue = useMemo(
    () =>
      submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({
            _id: submission?._id || "",
            intention: submission?.intention,
            submitterID: "demo-user",
          }),
          getSubmissionAttributes: null,
          submissionStats: null,
        },
      }),
    [submission]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <SnackbarProvider maxSnack={1}>
        <SubmissionContext.Provider value={ctxValue}>{children}</SubmissionContext.Provider>
      </SnackbarProvider>
    </MockedProvider>
  );
};

const mockSummary = (
  rows: NodeTypeSummary[]
): MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> => ({
  request: { query: GET_SUBMISSION_SUMMARY },
  variableMatcher: () => true,
  result: { data: { getSubmissionSummary: rows } },
});

const meta: Meta<typeof SubmitDialog> = {
  title: "Data Submissions / Submit Dialog",
  component: SubmitDialog,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, ctx) => {
      const { submission, mocks } = ctx.parameters as {
        submission?: Submission;
        mocks?: ReadonlyArray<MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput>>;
      };
      return (
        <Provider submission={submission} mocks={mocks}>
          <Story />
        </Provider>
      );
    },
  ],
  args: {
    open: true,
    onClose: fn(),
    onConfirm: fn(),
    bodyText:
      "Once submitted, your submission will be locked and will no longer accept updates. Are you sure you want to proceed?",
  },
};
export default meta;

type Story = StoryObj<typeof SubmitDialog>;

export const Skeleton: Story = {
  parameters: {
    submission: submissionFactory.build({ _id: null, intention: undefined }),
    mocks: [],
  },
};

export const NewUpdateLoadingBody: Story = {
  parameters: {
    submission: { _id: null, intention: "New/Update" },
    mocks: [],
  },
};

export const NewUpdateWithData: Story = {
  parameters: {
    submission: { _id: "submission-1", intention: "New/Update" },
    mocks: [
      mockSummary(
        nodeTypeSummaryFactory.build(3, (i) => ({
          nodeType: `NodeType ${i + 1}`,
          new: 10 + i,
          updated: 5 + i,
          deleted: 50 + i,
        }))
      ),
    ],
  },
};

export const DeleteLoadingBody: Story = {
  parameters: {
    submission: { _id: null, intention: "Delete" },
    mocks: [],
  },
};

export const DeleteWithData: Story = {
  parameters: {
    submission: { _id: "submission-2", intention: "Delete" },
    mocks: [
      mockSummary(
        nodeTypeSummaryFactory.build(2, (i) => ({
          nodeType: `NodeType ${i + 1}`,
          new: 10 + i,
          updated: 5 + i,
          deleted: 50 + i,
        }))
      ),
    ],
  },
};
