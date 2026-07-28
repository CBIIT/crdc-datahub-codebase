import { MockedResponse } from "@apollo/client/testing";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "@storybook/test";
import type { MutableRefObject } from "react";

import type { QualityControlFilterForm } from "@/content/dataSubmissions/QualityControl";
import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  RETRIEVE_SUBMISSION_QC_COMPARISONS,
  RetrieveSubmissionQCComparisonsInput,
  RetrieveSubmissionQCComparisonsResp,
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsInput,
  SubmissionQCResultsResp,
} from "@/graphql";

import { SubmissionContext, SubmissionCtxStatus } from "../Contexts/SubmissionContext";

import ExportValidationButton from "./index";

type CustomStoryProps = React.ComponentProps<typeof ExportValidationButton>;

const defaultFilters: QualityControlFilterForm = {
  issueType: "All",
  batchID: "All",
  nodeType: "All",
  severity: "All",
};

const defaultFiltersRef: MutableRefObject<QualityControlFilterForm> = {
  current: defaultFilters,
};

const expandedResultsMock: MockedResponse<SubmissionQCResultsResp, SubmissionQCResultsInput> = {
  request: {
    query: SUBMISSION_QC_RESULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      submissionQCResults: {
        total: 1,
        results: [
          qcResultFactory.build({
            displayID: 101,
            type: "participant",
            submittedID: "participant_01",
            severity: "Warning",
            errors: [],
            warnings: [
              errorMessageFactory.build({
                code: "M018",
                title: "Update Existing Data",
                description: "Incoming data will update an existing record",
              }),
            ],
          }),
        ],
      },
    },
  },
  maxUsageCount: Infinity,
};

const mockQCComparisons: MockedResponse<
  RetrieveSubmissionQCComparisonsResp,
  RetrieveSubmissionQCComparisonsInput
> = {
  request: {
    query: RETRIEVE_SUBMISSION_QC_COMPARISONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrieveSubmissionQCComparisons: {
        total: 3,
        skipped: 0,
        comparisons: [
          {
            submittedID: "participant_01",
            nodeType: "participant",
            existingProps: JSON.stringify({
              firstName: "John",
              lastName: "Doe",
              age: 30,
            }),
            incomingProps: JSON.stringify({
              firstName: "John",
              lastName: "Doe",
              age: 31,
            }),
          },
          {
            submittedID: "sample_01",
            nodeType: "sample",
            existingProps: JSON.stringify({
              sample_type: "Blood",
              volume: 5,
              collection_location: "Clinic A",
              participant_id: "participant_01",
            }),
            incomingProps: JSON.stringify({
              sample_type: "Blood",
              volume: "<delete>",
              collection_location: "<delete>",
              participant_id: "participant_01",
            }),
          },
          {
            submittedID: "study_phs00001",
            nodeType: "study",
            existingProps: JSON.stringify({
              title: "Study Title",
              description: "Study Description",
              lead_investigator: "Dr. Smith",
              participant_count: 100,
            }),
            incomingProps: JSON.stringify({
              title: "",
              description: "",
              lead_investigator: "",
              participant_count: "",
            }),
          },
        ],
      },
    },
  },
  maxUsageCount: Infinity,
};

const aggregatedResultsMock: MockedResponse<
  AggregatedSubmissionQCResultsResp,
  AggregatedSubmissionQCResultsInput
> = {
  request: {
    query: AGGREGATED_SUBMISSION_QC_RESULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      aggregatedSubmissionQCResults: {
        total: 2,
        results: aggregatedQCResultFactory.build(2, (idx) => ({
          code: `WARN-${idx + 1}`,
          title: `Validation warning ${idx + 1}`,
          severity: "Warning",
          count: idx + 1,
        })),
      },
    },
  },
  maxUsageCount: Infinity,
};

const withSubmissionContext: Decorator<CustomStoryProps> = (Story) => (
  <SubmissionContext.Provider
    value={submissionCtxStateFactory.build({
      status: SubmissionCtxStatus.LOADED,
      data: {
        getSubmission: submissionFactory.build({
          _id: "storybook-export-validation-submission",
          name: "Validation Export Story Submission",
        }),
        getSubmissionAttributes: null,
        submissionStats: { stats: [] },
      },
      error: null,
    })}
  >
    <Story />
  </SubmissionContext.Provider>
);

const meta: Meta<CustomStoryProps> = {
  title: "Data Submissions / Export Validation Button",
  component: ExportValidationButton,
  tags: ["autodocs"],
  decorators: [withSubmissionContext],
  args: {
    filtersRef: defaultFiltersRef,
  },
  argTypes: {},
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<typeof meta>;

export const ExpandedResults: Story = {
  parameters: {
    apolloClient: {
      mocks: [expandedResultsMock, mockQCComparisons],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("export-validation-button");

    await userEvent.hover(button);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Export filtered validation issues to Excel");
  },
};

export const AggregatedResults: Story = {
  args: {
    ...meta.args,
    isAggregated: true,
  },
  parameters: {
    apolloClient: {
      mocks: [aggregatedResultsMock],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("export-validation-button");

    await userEvent.hover(button);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Export filtered validation issues to Excel");
  },
};

export default meta;
