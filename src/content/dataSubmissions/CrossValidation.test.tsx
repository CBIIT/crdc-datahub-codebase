import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { batchFactory } from "@/factories/submission/BatchFactory";
import { crossValidationResultFactory } from "@/factories/submission/CrossValidationResultFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../../components/Contexts/SubmissionContext";
import {
  CrossValidationResultsInput,
  CrossValidationResultsResp,
  LIST_BATCHES,
  SUBMISSION_STATS,
  ListBatchesInput,
  ListBatchesResp,
  SubmissionStatsInput,
  SubmissionStatsResp,
  SUBMISSION_CROSS_VALIDATION_RESULTS,
} from "../../graphql";
import { TestRouter, render, waitFor, within } from "../../test-utils";

import CrossValidation from "./CrossValidation";

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
          getSubmission: submissionFactory.build({ ...submission }),
          getSubmissionAttributes: null,
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
    const { container } = render(<CrossValidation />, {
      wrapper: ({ children }) => <TestParent mocks={[]}>{children}</TestParent>,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should show an error message when the cross validation results cannot be fetched (network)", async () => {
    const mocks: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };

    render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mocks, nodesMock, batchesMock]}
          submission={{ _id: "test-network-error" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to retrieve submission cross validation results."),
        {
          variant: "error",
        }
      );
    });
  });

  it("should show an error message when the cross validation results cannot be fetched (GraphQL)", async () => {
    const mocks: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };

    render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mocks, nodesMock, batchesMock]}
          submission={{ _id: "test-graphql-error" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to retrieve submission cross validation results."),
        {
          variant: "error",
        }
      );
    });
  });

  it("should not send batchIDs or nodeTypes when the filter is set to 'All'", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent mocks={[mock, batchesMock, nodesMock]} submission={{ _id: "test-filters-1" }}>
          {children}
        </TestParent>
      ),
    });

    // "All" is the default selection for all filters
    expect(mockMatcher).not.toHaveBeenCalledWith(
      expect.objectContaining({ batchIDs: expect.anything(), nodeTypes: expect.anything() })
    );
    expect(mockMatcher).toHaveBeenCalledWith(expect.objectContaining({ severities: "All" }));
  });

  // NOTE: This test heavily depends on CrossValidationFilters test-ids
  it("should send batchIDs or nodeTypes when the filter is set to anything but 'All'", async () => {
    const mockMatcher = vi.fn().mockImplementation(() => true);
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      maxUsageCount: 3, // Init + 2 Filter changes
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          submissionCrossValidationResults: {
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
            stats: [
              {
                nodeName: "node-xyz",
                total: 1,
                new: 0,
                passed: 1,
                warning: 0,
                error: 0,
              },
            ],
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

    const { getByTestId } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mock, batchesMockWithData, nodesMockWithData]}
          submission={{ _id: "test-filters-2" }}
        >
          {children}
        </TestParent>
      ),
    });

    const batchBox = within(getByTestId("cross-validation-batchID-filter")).getByRole("button");

    userEvent.click(batchBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-batchID-filter")).getByRole(
        "listbox",
        {
          hidden: true,
        }
      );

      expect(within(muiSelectList).getByTestId("batch-999")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("batch-999"));

    const nodeBox = within(getByTestId("cross-validation-nodeType-filter")).getByRole("button");

    userEvent.click(nodeBox);

    await waitFor(() => {
      const muiSelectList = within(getByTestId("cross-validation-nodeType-filter")).getByRole(
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

  it("should not crash when no submission is available", async () => {
    const { container } = render(<CrossValidation />, {
      wrapper: ({ children }) => <TestParent>{children}</TestParent>,
    });

    expect(container).toBeInTheDocument();
  });

  it("should have a tooltip and link for each conflicting submission ID", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 2,
            results: [
              crossValidationResultFactory.build({
                conflictingSubmission: "submission_ID_A32524X",
              }),
              crossValidationResultFactory.build({
                conflictingSubmission: "submission_ID_B291D34",
              }),
              crossValidationResultFactory.build({
                conflictingSubmission: "submission_ID_C181181",
              }),
            ],
          },
        },
      },
    };

    const { getByText, getByTestId, findByRole, queryByRole } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent mocks={[mock, batchesMock, nodesMock]} submission={{ _id: "test-placeholder" }}>
          {children}
        </TestParent>
      ),
    });

    // Wait for table to render
    await waitFor(() => {
      expect(getByTestId("conflicting-submission-submission_ID_A32524X")).toBeInTheDocument();
      expect(getByTestId("conflicting-submission-submission_ID_B291D34")).toBeInTheDocument();
      expect(getByTestId("conflicting-submission-submission_ID_C181181")).toBeInTheDocument();
    });

    // Scenario 1 – One conflicting submission
    const firstSub = getByTestId("conflicting-submission-submission_ID_A32524X");
    expect(getByText(/2524X/).parentElement).toBe(firstSub);
    expect(firstSub).toHaveTextContent("...2524X");

    const firstLink = getByTestId("conflicting-link-submission_ID_A32524X");
    expect(firstLink).toHaveAttribute("href", "/data-submission/submission_ID_A32524X");
    expect(firstLink).toHaveAttribute("target", "_blank");
    userEvent.hover(firstLink);
    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("submission_ID_A32524X");

    userEvent.unhover(firstLink);
    await waitFor(() => expect(queryByRole("tooltip")).not.toBeInTheDocument());

    // Scenario 2 – Multiple conflicting submissions
    const secondSub = getByTestId("conflicting-submission-submission_ID_B291D34");
    expect(getByText(/91D34/).parentElement).toBe(secondSub);
    expect(secondSub).toHaveTextContent("...91D34");

    const secondLink = getByTestId("conflicting-link-submission_ID_B291D34");
    expect(secondLink).toHaveAttribute("href", "/data-submission/submission_ID_B291D34");
    expect(secondLink).toHaveAttribute("target", "_blank");
    userEvent.hover(secondLink);
    const tooltip2 = await findByRole("tooltip");
    expect(tooltip2).toHaveTextContent("submission_ID_B291D34");

    userEvent.unhover(secondLink);
    await waitFor(() => expect(queryByRole("tooltip")).not.toBeInTheDocument());

    const thirdSub = getByTestId("conflicting-submission-submission_ID_C181181");
    expect(getByText(/81181/).parentElement).toBe(thirdSub);
    expect(thirdSub).toHaveTextContent("...81181");

    const thirdLink = getByTestId("conflicting-link-submission_ID_C181181");
    expect(thirdLink).toHaveAttribute("href", "/data-submission/submission_ID_C181181");
    expect(thirdLink).toHaveAttribute("target", "_blank");
    userEvent.hover(thirdLink);
    const tooltip3 = await findByRole("tooltip");
    expect(tooltip3).toHaveTextContent("submission_ID_C181181");
  });
});

describe("Table", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render the placeholder text when no data is available", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getByText } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent mocks={[mock, batchesMock, nodesMock]} submission={{ _id: "test-placeholder" }}>
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      expect(getByText(/No cross-validation issues found/i)).toBeInTheDocument();
    });
  });

  it("should have a default pagination count of 20 rows per page", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getByTestId } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mock, batchesMock, nodesMock]}
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
});

describe("Table Actions", () => {
  it("should enable the export button when there are results to export", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 1,
            results: [crossValidationResultFactory.build()],
          },
        },
      },
    };

    const { getAllByTestId } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mock, batchesMock, nodesMock]}
          submission={{ _id: "test-enabled-export" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      const buttons = getAllByTestId("export-cross-validation-button"); // Top and bottom action buttons

      expect(buttons[0]).toBeEnabled();
      expect(buttons[1]).toBeEnabled();
    });
  });

  it("should disable the export button when there are no results to export", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 0,
            results: [],
          },
        },
      },
    };

    const { getAllByTestId } = render(<CrossValidation />, {
      wrapper: ({ children }) => (
        <TestParent
          mocks={[mock, batchesMock, nodesMock]}
          submission={{ _id: "test-disabled-export" }}
        >
          {children}
        </TestParent>
      ),
    });

    await waitFor(() => {
      const buttons = getAllByTestId("export-cross-validation-button"); // Top and bottom action buttons

      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });
  });
});
