import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, within } from "@storybook/test";

import { QualityControlFilterForm } from "@/content/dataSubmissions/QualityControl";
import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsInput,
  SubmissionQCResultsResp,
} from "@/graphql";

import { ExportValidationButton } from "./ExportValidationButton";

type CustomStoryProps = React.ComponentProps<typeof ExportValidationButton>;

const defaultFilters: QualityControlFilterForm = {
  issueType: "All",
  batchID: "All",
  nodeType: "All",
  severity: "All",
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

const aggregatedFields: CustomStoryProps["fields"] = {
  "Issue Type": (row: AggregatedQCResult) => row?.title ?? "",
  Severity: (row: AggregatedQCResult) => row?.severity ?? "",
  Count: (row: AggregatedQCResult) => row?.count ?? 0,
};

const meta: Meta<CustomStoryProps> = {
  title: "Data Submissions / Export Validation Button",
  component: ExportValidationButton,
  tags: ["autodocs"],
  args: {
    submission: submissionFactory.build({
      _id: "storybook-export-validation-submission",
      name: "Validation Export Story Submission",
    }),
    fields: {},
    filters: defaultFilters,
  },
  argTypes: {},
} satisfies Meta<CustomStoryProps>;

type Story = StoryObj<typeof meta>;

export const ExpandedResults: Story = {
  parameters: {
    apolloClient: {
      mocks: [expandedResultsMock],
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
    fields: aggregatedFields,
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
    expect(tooltip).toHaveTextContent("Export all validation issues for this data");
  },
};

export default meta;
