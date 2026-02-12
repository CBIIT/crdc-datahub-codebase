import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { batchFactory } from "@/factories/submission/BatchFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { submissionStatisticFactory } from "@/factories/submission/SubmissionStatisticFactory";

import {
  LIST_BATCHES,
  SUBMISSION_STATS,
  ListBatchesInput,
  ListBatchesResp,
  SubmissionStatsInput,
  SubmissionStatsResp,
} from "../../graphql";
import { render, waitFor, within } from "../../test-utils";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import Filters from "./CrossValidationFilters";

type ParentProps = {
  submissionId?: string;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ submissionId, mocks, children }: ParentProps) => {
  const ctxValue: SubmissionCtxState = useMemo<SubmissionCtxState>(
    () => ({
      status: SubmissionCtxStatus.LOADED,
      data: {
        getSubmission: submissionFactory.build({ _id: submissionId }),
        getSubmissionAttributes: null,
        submissionStats: { stats: [] },
      },
      error: null,
    }),
    [submissionId]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <SubmissionContext.Provider value={ctxValue}>{children}</SubmissionContext.Provider>
    </MockedProvider>
  );
};

describe("CrossValidationFilters cases", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should not have accessibility violations", async () => {
    const { container } = render(
      <TestParent mocks={[]} submissionId={undefined}>
        <Filters />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should handle empty nodes and batches without issues", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: null,
          },
        },
      },
    };

    expect(() =>
      render(
        <TestParent mocks={[nodesMock, batchesMock]} submissionId="empty-result-test">
          <Filters />
        </TestParent>
      )
    ).not.toThrow();
  });

  it("should handle GraphQL errors when fetching nodes without issues", async () => {
    const graphqlErrorNodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("GraphQL Error")],
      },
    };

    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: null,
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[graphqlErrorNodesMock, batchesMock]} submissionId="graphql-nodes-test">
        <Filters />
      </TestParent>
    );

    expect(getByTestId("cross-validation-nodeType-filter")).toBeInTheDocument();
  });

  it("should handle network errors when fetching nodes without issues", async () => {
    const networkErrorNodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      error: new Error("Network Error"),
    };

    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: null,
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[networkErrorNodesMock, batchesMock]} submissionId="network-node-test">
        <Filters />
      </TestParent>
    );

    expect(getByTestId("cross-validation-nodeType-filter")).toBeInTheDocument();
  });

  it("should handle GraphQL errors when fetching batches without issues", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const graphErrorBatchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("GraphQL Error")],
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[nodesMock, graphErrorBatchesMock]} submissionId="graphql-batch-test">
        <Filters />
      </TestParent>
    );

    expect(getByTestId("cross-validation-batchID-filter")).toBeInTheDocument();
  });

  it("should handle network errors when fetching batches without issues", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const networkErrorBatchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      error: new Error("Network Error"),
    };

    const { getByTestId } = render(
      <TestParent mocks={[nodesMock, networkErrorBatchesMock]} submissionId="network-batch-test">
        <Filters />
      </TestParent>
    );

    expect(getByTestId("cross-validation-batchID-filter")).toBeInTheDocument();
  });

  it("should sort the batch filter by displayID in ascending order", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 4,
            batches: [
              batchFactory.build({ displayID: 4, _id: "batch-4" }).withTypename("Batch"),
              batchFactory.build({ displayID: 3, _id: "batch-3" }).withTypename("Batch"),
              batchFactory.build({ displayID: 1, _id: "batch-1" }).withTypename("Batch"),
              batchFactory.build({ displayID: 2, _id: "batch-2" }).withTypename("Batch"),
            ],
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[nodesMock, batchesMock]} submissionId="sort-by-batch-id">
        <Filters />
      </TestParent>
    );

    const muiSelectBox = within(getByTestId("cross-validation-batchID-filter")).getByRole("button");

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-batchID-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(muiSelectList).toBeInTheDocument();

      // The order of the batches should be 1, 2, 3, 4
      expect(muiSelectList.innerHTML.search("batch-1")).toBeLessThan(
        muiSelectList.innerHTML.search("batch-2")
      );
      expect(muiSelectList.innerHTML.search("batch-2")).toBeLessThan(
        muiSelectList.innerHTML.search("batch-3")
      );
      expect(muiSelectList.innerHTML.search("batch-3")).toBeLessThan(
        muiSelectList.innerHTML.search("batch-4")
      );
    });
  });

  it("should sort the node names alphabetically in descending order", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              submissionStatisticFactory.build({ nodeName: "node-3" }),
              submissionStatisticFactory.build({ nodeName: "node-1" }),
              submissionStatisticFactory.build({ nodeName: "node-2" }),
            ],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: null,
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[nodesMock, batchesMock]} submissionId="sorted-node-names">
        <Filters />
      </TestParent>
    );

    const muiSelectBox = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
      "button"
    );

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      // The order of the nodes should be N-1 < N-2 < N-3
      expect(muiSelectList).toBeInTheDocument();
      expect(muiSelectList.innerHTML.search("node-1")).toBeLessThan(
        muiSelectList.innerHTML.search("node-2")
      );
      expect(muiSelectList.innerHTML.search("node-2")).toBeLessThan(
        muiSelectList.innerHTML.search("node-3")
      );
    });
  });

  it("should always visually render the nodeName as lowercase", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              submissionStatisticFactory.build({ nodeName: "NODE_NAME" }),
              submissionStatisticFactory.build({ nodeName: "Upper_Case" }),
              submissionStatisticFactory.build({ nodeName: "lower_case" }),
            ],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: null,
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[batchesMock, nodesMock]} submissionId="test-lowercase-enforcement">
        <Filters />
      </TestParent>
    );

    const muiSelectBox = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
      "button"
    );

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      expect(getByTestId("nodeType-NODE_NAME")).toHaveTextContent("node_name");
      expect(getByTestId("nodeType-Upper_Case")).toHaveTextContent("upper_case");
      expect(getByTestId("nodeType-lower_case")).toHaveTextContent("lower_case");
    });
  });

  it("should immediately dispatch Batch ID filter changes", async () => {
    const mockOnChange = vi.fn();
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 2,
            batches: [
              batchFactory.build({ displayID: 4, _id: "batch-4" }).withTypename("Batch"),
              batchFactory.build({ displayID: 1, _id: "batch-1" }).withTypename("Batch"),
            ],
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[batchesMock, nodesMock]} submissionId="test-immediate-dispatch">
        <Filters onChange={mockOnChange} />
      </TestParent>
    );

    vi.useFakeTimers();

    const batchBox = within(getByTestId("cross-validation-batchID-filter")).getByRole("button");

    userEvent.click(batchBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-batchID-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByTestId("batch-1")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("batch-1"));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchIDs: ["batch-1"],
      })
    ); // Called without advancing timers
  });

  it("should immediately dispatch NodeID ID filter changes", async () => {
    const mockOnChange = vi.fn();
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              submissionStatisticFactory.build({ nodeName: "study" }),
              submissionStatisticFactory.build({ nodeName: "enrollment" }),
            ],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: [],
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[batchesMock, nodesMock]} submissionId="test-immediate-dispatch">
        <Filters onChange={mockOnChange} />
      </TestParent>
    );

    vi.useFakeTimers();

    const nodeBox = within(getByTestId("cross-validation-nodeType-filter")).getByRole("button");

    userEvent.click(nodeBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByTestId("nodeType-study")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("nodeType-study"));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeTypes: ["study"],
      })
    ); // Called without advancing timers
  });

  it("should immediately dispatch Severity filter changes", async () => {
    const mockOnChange = vi.fn();
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: [],
          },
        },
      },
    };

    const { getByTestId, getByText } = render(
      <TestParent mocks={[batchesMock, nodesMock]} submissionId="test-immediate-dispatch">
        <Filters onChange={mockOnChange} />
      </TestParent>
    );

    vi.useFakeTimers();

    const severityBox = within(getByTestId("cross-validation-status-filter")).getByRole("button");

    userEvent.click(severityBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-status-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByText(/Warning/)).toBeInTheDocument();
    });

    userEvent.click(getByText(/Warning/));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        severities: "Warning",
      })
    ); // Called without advancing timers
  });

  it("should filter out the 'Data File' node type if present", async () => {
    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              submissionStatisticFactory.build({ nodeName: "study" }),
              submissionStatisticFactory.build({ nodeName: "enrollment" }),
              submissionStatisticFactory.build({ nodeName: "data file" }),
            ],
          },
        },
      },
    };
    const batchesMock: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 0,
            batches: [],
          },
        },
      },
    };

    const { getByTestId, queryByTestId } = render(
      <TestParent mocks={[batchesMock, nodesMock]} submissionId="test-immediate-dispatch">
        <Filters />
      </TestParent>
    );

    const muiSelectBox = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
      "button"
    );

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      expect(getByTestId("nodeType-study")).toBeInTheDocument();
      expect(getByTestId("nodeType-enrollment")).toBeInTheDocument();
      expect(queryByTestId("nodeType-data file")).not.toBeInTheDocument();
    });
  });
});
