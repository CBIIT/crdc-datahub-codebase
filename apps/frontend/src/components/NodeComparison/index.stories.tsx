import { MockedResponse } from "@apollo/client/testing";
import type { Meta, StoryObj } from "@storybook/react";

import {
  RETRIEVE_RELEASED_DATA,
  RetrieveReleasedDataInput,
  RetrieveReleasedDataResp,
} from "../../graphql";

import NodeComparison from "./index";

const nominalMock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
  request: {
    query: RETRIEVE_RELEASED_DATA,
  },
  variableMatcher: () => true,
  result: {
    data: {
      retrieveReleasedDataByID: [
        // New node
        {
          nodeType: "participant",
          nodeID: "participant-123",
          props: JSON.stringify({
            col1: "xyz",
            equal_val: "we're equal",
            col2: "abc",
            unchanged_val: "",
            identical_delete: "<delete>",
            mock_col: "foo",
            delete_val: "<delete>",
          }),
        },
        // Existing node
        {
          nodeType: "participant",
          nodeID: "participant-123",
          props: JSON.stringify({
            col1: "123",
            equal_val: "we're equal",
            col2: "xyz",
            unchanged_val: "wont change",
            identical_delete: "<delete>",
            mock_col: "abc",
            delete_val: "some val to be deleted",
          }),
        },
      ],
    },
  },
};

const errorMock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
  request: {
    query: RETRIEVE_RELEASED_DATA,
  },
  variableMatcher: () => true,
  error: new Error("GraphQL error"),
};

const loadingMock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
  request: {
    query: RETRIEVE_RELEASED_DATA,
  },
  variableMatcher: () => true,
  result: null,
  delay: Infinity,
};

// --- Storybook Meta ---
const meta: Meta<typeof NodeComparison> = {
  title: "Miscellaneous / Node Comparison",
  component: NodeComparison,
  tags: ["autodocs"],
  args: {
    submissionID: "mock-submission-id",
    nodeType: "mock-node",
    submittedID: "mock-node-id",
  },
} satisfies Meta<typeof NodeComparison>;

export default meta;

type Story = StoryObj<typeof NodeComparison>;

/**
 * This story represents the default state of the component with mock data.
 */
export const DefaultState: Story = {
  name: "Default",
  parameters: {
    apolloClient: {
      mocks: [nominalMock],
    },
  },
};

/**
 * This story simulates a loading state for the component.
 */
export const LoadingState: Story = {
  name: "Loading",
  parameters: {
    apolloClient: {
      mocks: [loadingMock],
    },
  },
};

/**
 * This story simulates handling of an API error.
 */
export const ErrorState: Story = {
  name: "Error",
  parameters: {
    apolloClient: {
      mocks: [errorMock],
    },
  },
};
