import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";
import { batchFactory } from "@/factories/submission/BatchFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../../components/Contexts/SubmissionContext";
import {
  LIST_BATCHES,
  ListBatchesInput,
  ListBatchesResp,
  AGGREGATED_SUBMISSION_QC_RESULTS,
  SUBMISSION_QC_RESULTS,
  SUBMISSION_STATS,
  AggregatedSubmissionQCResultsInput,
  AggregatedSubmissionQCResultsResp,
  SubmissionQCResultsResp,
  SubmissionStatsInput,
  SubmissionStatsResp,
  SubmissionQCResultsInput,
  GetPendingPVsResponse,
  GetPendingPVsInput,
  GET_PENDING_PVS,
} from "../../graphql";
import { TestRouter, fireEvent, render, waitFor, within } from "../../test-utils";

import QualityControl from "./QualityControl";

const emptyPendingPVsMock: MockedResponse<GetPendingPVsResponse, GetPendingPVsInput> = {
  request: {
    query: GET_PENDING_PVS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      getPendingPVs: [],
    },
  },
};

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

const issueTypesMock: MockedResponse<
  AggregatedSubmissionQCResultsResp,
  AggregatedSubmissionQCResultsInput
> = {
  request: {
    query: AGGREGATED_SUBMISSION_QC_RESULTS,
    context: { clientName: "backend" },
  },
  variableMatcher: () => true,
  result: {
    data: {
      aggregatedSubmissionQCResults: {
        total: 1,
        results: [
          aggregatedQCResultFactory
            .build({
              code: "ISSUE1",
              title: "Issue Title 1",
              count: 100,
              severity: "Error",
            })
            .withTypename("AggregatedQCResult"),
        ],
      },
    },
  },
};

const aggSubmissionMock: MockedResponse<
  AggregatedSubmissionQCResultsResp,
  AggregatedSubmissionQCResultsInput
> = {
  request: {
    query: AGGREGATED_SUBMISSION_QC_RESULTS,
    context: { clientName: "backend" },
  },
  variableMatcher: () => true,
  result: {
    data: {
      aggregatedSubmissionQCResults: {
        total: 2,
        results: [
          aggregatedQCResultFactory
            .build({
              code: "ISSUE1",
              title: "Issue Title 1",
              count: 100,
              severity: "Error",
            })
            .withTypename("AggregatedQCResult"),
          aggregatedQCResultFactory
            .build({
              code: "ISSUE2",
              title: "Issue Title 2",
              count: 200,
              severity: "Warning",
            })
            .withTypename("AggregatedQCResult"),
        ],
      },
    },
  },
};

const submissionQCMock: MockedResponse<SubmissionQCResultsResp, SubmissionQCResultsInput> = {
  request: {
    query: SUBMISSION_QC_RESULTS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      submissionQCResults: {
        total: 0,
        results: [],
      },
    },
  },
};

type ParentProps = {
  submission?: Partial<Submission>;
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ submission = {}, mocks, children }: ParentProps) => {
  const ctxValue: SubmissionCtxState = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build({
            ...submission,
          }),
          getSubmissionAttributes: {
            submissionAttributes: submissionAttributesFactory
              .pick(["hasOrphanError", "isBatchUploading"])
              .build({
                hasOrphanError: false,
                isBatchUploading: false,
              }),
          },
          submissionStats: { stats: [] },
        },
        error: null,
      }),
    [submission]
  );

  return (
    <TestRouter basename="">
      <MockedProvider mocks={mocks} showWarnings>
        <SubmissionContext.Provider value={ctxValue}>
          <SearchParamsProvider>{children}</SearchParamsProvider>
        </SubmissionContext.Provider>
      </MockedProvider>
    </TestRouter>
  );
};

describe("General", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not have any accessibility violations", async () => {
    const { container } = render(<QualityControl />, {
      wrapper: ({ children }) => <TestParent mocks={[]}>{children}</TestParent>,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should show an error message when the QC results cannot be fetched (network)", async () => {
    const mocks: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };
    const aggMocks: MockedResponse<AggregatedSubmissionQCResultsResp, null> = {
      request: {
        query: AGGREGATED_SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[aggMocks, mocks, nodesMock, batchesMock, issueTypesMock, emptyPendingPVsMock]}
          submission={{ _id: "test-network-error" }}
        >
          {children}
        </TestParent>
      ),
    });

    expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
      "checked",
      false
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unable to retrieve submission aggregated quality control results."
        ),
        {
          variant: "error",
        }
      );
    });

    fireEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to retrieve submission quality control results."),
        {
          variant: "error",
        }
      );
    });
  });

  it("should show an error message when the QC results cannot be fetched (GraphQL)", async () => {
    const mocks: MockedResponse<SubmissionQCResultsResp> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };
    const aggMocks: MockedResponse<AggregatedSubmissionQCResultsResp> = {
      request: {
        query: AGGREGATED_SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggMocks,
            submissionQCMock,
            mocks,
            nodesMock,
            batchesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-graphql-error" }}
        >
          {children}
        </TestParent>
      ),
    });

    expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
      "checked",
      false
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unable to retrieve submission aggregated quality control results."
        ),
        {
          variant: "error",
        }
      );
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to retrieve submission quality control results."),
        {
          variant: "error",
        }
      );
    });
  });
});

describe("Filters", () => {
  it("should not send batchIDs or nodeTypes when the filter is set to 'All'", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-filters-1" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
      expect(getByTestId("generic-table")).toHaveTextContent("Submitted Identifier");
    });

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalled();
    });

    // "All" is the default selection for all filters
    expect(mockMatcher).not.toHaveBeenCalledWith(
      expect.objectContaining({ batchIDs: expect.anything(), nodeTypes: expect.anything() })
    );

    expect(mockMatcher).toHaveBeenCalledWith(expect.objectContaining({ severities: "All" }));
  });

  it("should include batchIDs or nodeTypes when the filter is set to anything but 'All'", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: Infinity, // Init + 2 Filter changes
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const nodesMockWithData: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [{ nodeName: "node-xyz", total: 1, new: 0, error: 1, warning: 0, passed: 0 }],
          },
        },
      },
    };

    const batchesMockWithData: MockedResponse<ListBatchesResp<true>, ListBatchesInput> = {
      request: {
        query: LIST_BATCHES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listBatches: {
            total: 1,
            batches: [
              batchFactory
                .build({
                  _id: "batch-999",
                  displayID: 999,
                })
                .withTypename("Batch"),
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMockWithData,
            nodesMockWithData,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-filters-2" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    const batchBox = within(getByTestId("quality-control-batchID-filter")).getByRole("button");

    userEvent.click(batchBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-batchID-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByTestId("batchID-batch-999")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("batchID-batch-999"));

    const nodeBox = within(getByTestId("quality-control-nodeType-filter")).getByRole("button");

    userEvent.click(nodeBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByTestId("nodeType-node-xyz")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("nodeType-node-xyz"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          batchIDs: ["batch-999"],
          nodeTypes: ["node-xyz"],
        })
      );
    });
  });

  it("should only include nodeTypes with Errors or Warnings", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: 1,
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              { nodeName: "node-new", total: 1, new: 1, error: 0, warning: 0, passed: 0 },
              { nodeName: "node-error", total: 1, new: 0, error: 1, warning: 0, passed: 0 },
              { nodeName: "node-warning", total: 1, new: 0, error: 0, warning: 1, passed: 0 },
              { nodeName: "node-passed", total: 1, new: 0, error: 0, warning: 0, passed: 1 },
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "filter-nodes" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    const muiSelectBox = within(getByTestId("quality-control-nodeType-filter")).getByRole("button");

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(muiSelectList).toBeInTheDocument();
      expect(within(muiSelectList).queryByTestId("nodeType-node-new")).not.toBeInTheDocument();
      expect(within(muiSelectList).queryByTestId("nodeType-node-passed")).not.toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("nodeType-node-error")).toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("nodeType-node-warning")).toBeInTheDocument();
    });
  });

  it("should sort the nodeTypes by total count (primary) and name (secondary)", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: 1,
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              { nodeName: "node-1", total: 1, new: 0, error: 1, warning: 0, passed: 0 },
              { nodeName: "node-3", total: 55, new: 0, error: 45, warning: 10, passed: 0 },
              { nodeName: "node-2", total: 20, new: 0, error: 0, warning: 20, passed: 0 },
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "sorting-nodeType" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    const muiSelectBox = within(getByTestId("quality-control-nodeType-filter")).getByRole("button");

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      // The order of the nodes should be node-1, node-2, node-3
      expect(muiSelectList).toBeInTheDocument();
      expect(muiSelectList.innerHTML.search("node-1")).toBeLessThan(
        muiSelectList.innerHTML.search("node-2")
      );
      expect(muiSelectList.innerHTML.search("node-2")).toBeLessThan(
        muiSelectList.innerHTML.search("node-3")
      );
    });
  });

  it("should render the node name visually as lowercase", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: 1,
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const nodesMock: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
      request: {
        query: SUBMISSION_STATS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionStats: {
            stats: [
              { nodeName: "node-UPPER", total: 1, new: 0, error: 0, warning: 1, passed: 0 },
              { nodeName: "node-lower", total: 1, new: 0, error: 0, warning: 1, passed: 0 },
              { nodeName: "node-MiXeD", total: 1, new: 0, error: 0, warning: 1, passed: 0 },
              { nodeName: "111111", total: 1, new: 0, error: 0, warning: 1, passed: 0 },
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "filter-nodes" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    const muiSelectBox = within(getByTestId("quality-control-nodeType-filter")).getByRole("button");

    userEvent.click(muiSelectBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-nodeType-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(muiSelectList).toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("nodeType-node-UPPER")).toHaveTextContent(
        "node-upper"
      );
      expect(within(muiSelectList).getByTestId("nodeType-node-lower")).toHaveTextContent(
        "node-lower"
      );
      expect(within(muiSelectList).getByTestId("nodeType-node-MiXeD")).toHaveTextContent(
        "node-mixed"
      );
      expect(within(muiSelectList).getByTestId("nodeType-111111")).toHaveTextContent("111111");
    });
  });

  it("should contain the displayID and formatted createdAt date for each batch", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: 1,
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
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
            total: 3,
            batches: [
              batchFactory
                .build({
                  _id: "batch01",
                  displayID: 1,
                  createdAt: "2023-05-22T00:00:00Z",
                })
                .withTypename("Batch"),
              batchFactory
                .build({
                  _id: "batch02",
                  displayID: 55,
                  createdAt: "2024-07-31T00:00:00Z",
                })
                .withTypename("Batch"),
              batchFactory
                .build({
                  _id: "batch03",
                  displayID: 94,
                  createdAt: "2024-12-12T00:00:00Z",
                })
                .withTypename("Batch"),
              batchFactory
                .build({
                  _id: "batch04",
                  displayID: 1024,
                  createdAt: "2028-10-03T00:00:00Z",
                })
                .withTypename("Batch"),
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "format-batches" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    userEvent.click(within(getByTestId("quality-control-batchID-filter")).getByRole("button"));

    await waitFor(() => {
      const muiSelectList = within(getByTestId("quality-control-batchID-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(muiSelectList).toBeInTheDocument();
      expect(within(muiSelectList).getByTestId("batchID-batch01")).toHaveTextContent(
        "1 (05/22/2023)"
      );
      expect(within(muiSelectList).getByTestId("batchID-batch02")).toHaveTextContent(
        "55 (07/31/2024)"
      );
      expect(within(muiSelectList).getByTestId("batchID-batch03")).toHaveTextContent(
        "94 (12/12/2024)"
      );
      expect(within(muiSelectList).getByTestId("batchID-batch04")).toHaveTextContent(
        "1024 (10/03/2028)"
      );
    });
  });
});

describe("Table", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // NOTE: This is just a sanity check for the column rendering
  it("should render the table with the correct data", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      maxUsageCount: 1,
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 2,
            results: [
              qcResultFactory.build({
                displayID: 1,
                type: "1-fake-long-node-01",
                submittedID: "1-submitted-id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                warnings: [
                  {
                    code: null,
                    title: "mock-very-very-long-warning-title-1",
                    description: "mock-very-very-long-warning-description-1",
                  },
                ],
              }),
              qcResultFactory.build({
                displayID: 2,
                type: "2-fake-long-node-02",
                submittedID: "2-submitted-id-002",
                severity: "Warning",
                validatedDate: "2024-07-31T11:27:00Z",
                errors: [
                  {
                    code: null,
                    title: "mock-error-1",
                    description: "mock-error-description-1",
                  },
                ],
              }),
            ],
          },
        },
      },
    };

    const { getByText, getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "format-batches" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    await waitFor(() => {
      expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
        "checked",
        true
      );
    });

    await waitFor(() => {
      expect(getByText("1-submitted-id-...")).toBeInTheDocument();
      expect(getByText("1-fake-long-...")).toBeInTheDocument();
    });

    expect(getByText("mock-very-very-long-warning-ti...")).toBeInTheDocument();
    expect(getByText(/mock-error-1/)).toBeInTheDocument();
    expect(getByText("2-fake-long-...")).toBeInTheDocument();
    expect(getByText("5/22/2023")).toBeInTheDocument();
    expect(getByText("7/31/2024")).toBeInTheDocument();
  });

  it("should render the placeholder text when no data is available", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getByText } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-placeholder" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(
        getByText(
          /No validation issues found. Either no validation has been conducted yet, or all issues have been resolved./i
        )
      ).toBeInTheDocument();
    });
  });

  it("should have a default pagination count of 20 rows per page", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-pagination-count" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(getByTestId("generic-table-rows-per-page-top")).toHaveValue("20");
      expect(getByTestId("generic-table-rows-per-page-bottom")).toHaveValue("20");
    });
  });

  it("should enable the export button when there are results to export", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 1,
            results: [qcResultFactory.build()],
          },
        },
      },
    };

    const { getAllByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-enabled-export" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      const buttons = getAllByTestId("export-validation-button"); // Top and bottom action buttons

      expect(buttons[0]).toBeEnabled();
      expect(buttons[1]).toBeEnabled();
    });
  });

  it("should disable the export button when there are no results to export", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getAllByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            aggSubmissionMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "test-disabled-export" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      const buttons = getAllByTestId("export-validation-button"); // Top and bottom action buttons

      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });
  });
});

describe("Implementation Requirements", () => {
  it("should display 'Record Count' column in Aggregated view with correct values", async () => {
    const { getByTestId, findByText } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "agg-view-record-count" }}
        >
          {children}
        </TestParent>
      ),
    });

    expect(within(getByTestId("table-view-switch")).getByRole("checkbox")).toHaveProperty(
      "checked",
      false
    );

    expect(await findByText("Record Count")).toBeInTheDocument();

    expect(await findByText("100")).toBeInTheDocument();
    expect(await findByText("200")).toBeInTheDocument();
  });

  it("should display 'Issue Count' column in Expanded view with correct values", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
      request: {
        query: SUBMISSION_QC_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionQCResults: {
            total: 2,
            results: [
              qcResultFactory.build({
                displayID: 1,
                type: "node-01",
                submittedID: "id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                errors: errorMessageFactory.build(2, (index) => ({
                  title: `error-${index}`,
                  description: `desc-${index}`,
                })),
                warnings: [errorMessageFactory.build({ title: "warn-1", description: "desc-3" })],
                issueCount: 3,
              }),
              qcResultFactory.build({
                displayID: 2,
                type: "node-02",
                submittedID: "id-002",
                severity: "Warning",
                validatedDate: "2024-07-31T11:27:00Z",
                errors: [],
                warnings: [
                  errorMessageFactory.build({ code: null, title: "warn-2", description: "desc-4" }),
                ],
                issueCount: 10003,
              }),
            ],
          },
        },
      },
    };

    const { getByTestId, findByText } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "expanded-view-issue-count" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    expect(await findByText("Issue Count")).toBeInTheDocument();

    expect(await findByText("3")).toBeInTheDocument();
    expect(await findByText("10,003")).toBeInTheDocument();
  });

  it("should contain 'Issue(s)' column in Expanded view", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
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
                displayID: 1,
                type: "node-01",
                submittedID: "id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                errors: [
                  errorMessageFactory.build({
                    code: null,
                    title: "error-1",
                    description: "desc-1",
                  }),
                ],
                warnings: [],
                issueCount: 1,
              }),
            ],
          },
        },
      },
    };

    const { getByTestId, findByText } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "expanded-view-issues-col" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    expect(await findByText("Issue(s)")).toBeInTheDocument();
  });

  it("should display only the first issue message, truncated, and append 'and other #' if multiple issues exist in Expanded view", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
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
                displayID: 1,
                type: "node-01",
                submittedID: "id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                errors: [
                  errorMessageFactory.build({
                    title: "A very long error message that should be truncated for display",
                    description: "desc-1",
                  }),
                  errorMessageFactory.build({
                    title: "error-2",
                    description: "desc-2",
                  }),
                ],
                warnings: [
                  errorMessageFactory.build({ code: null, title: "warn-1", description: "desc-3" }),
                ],
                issueCount: 3,
              }),
            ],
          },
        },
      },
    };

    const { getByTestId, findByText, findByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "expanded-view-issue-trunc" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    expect(await findByText(/A very long error message that.../)).toBeInTheDocument();

    expect(await findByTestId("others-text")).toHaveTextContent("other 2");
  });

  it("should show tooltip on 'other #' with correct message in Expanded view", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
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
                displayID: 1,
                type: "node-01",
                submittedID: "id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                errors: errorMessageFactory.build(2, (index) => ({
                  title: `error-${index}`,
                  description: `desc-${index}`,
                })),
                warnings: [],
                issueCount: 2,
              }),
            ],
          },
        },
      },
    };

    const { getByTestId, findByText, findByTestId } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "expanded-view-others-tooltip" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    const others = await findByTestId("others-text");
    userEvent.hover(others);

    expect(await findByText("Click to view all issues for this record.")).toBeInTheDocument();
  });

  it("should open the error details dialog when clicking on 'other #'", async () => {
    const mock: MockedResponse<SubmissionQCResultsResp, null> = {
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
                displayID: 1,
                type: "node-01",
                submittedID: "id-001",
                severity: "Error",
                validatedDate: "2023-05-22T12:52:00Z",
                errors: errorMessageFactory.build(3, (index) => ({
                  title: `error-${index}`,
                  description: `desc-${index}`,
                })),
                warnings: [],
                issueCount: 3,
              }),
            ],
          },
        },
      },
    };

    const { getByTestId, findByTestId, findByText } = render(<QualityControl />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[
            aggSubmissionMock,
            submissionQCMock,
            mock,
            batchesMock,
            nodesMock,
            issueTypesMock,
            emptyPendingPVsMock,
          ]}
          submission={{ _id: "expanded-view-others-dialog" }}
        >
          {children}
        </TestParent>
      ),
    });

    userEvent.click(within(getByTestId("table-view-switch")).getByRole("checkbox"));

    const others = await findByTestId("others-text");
    userEvent.click(others);

    expect(await findByText("Validation Issues")).toBeInTheDocument();
    expect(await findByText(/For Node-01 Node ID id-001/i)).toBeInTheDocument();
  });
});
