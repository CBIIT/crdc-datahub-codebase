import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import React, { FC, MutableRefObject, useMemo } from "react";
import { axe } from "vitest-axe";

import type { QualityControlFilterForm } from "@/content/dataSubmissions/QualityControl";
import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  SUBMISSION_QC_RESULTS,
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsResp,
  RETRIEVE_SUBMISSION_QC_COMPARISONS,
  RetrieveSubmissionQCComparisonsResp,
  RetrieveSubmissionQCComparisonsInput,
} from "@/graphql";
import { render, fireEvent, waitFor } from "@/test-utils";
import * as utils from "@/utils";

import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../Contexts/SubmissionContext";

import ExportValidationButton from "./index";

const mockDownloadBlob = vi.fn();

vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}));

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
    <MockedProvider mocks={mocks} showWarnings>
      <SubmissionContext.Provider value={ctxValue}>{children}</SubmissionContext.Provider>
    </MockedProvider>
  );
};

const baseAggregatedQCResult: AggregatedQCResult = aggregatedQCResultFactory.build({
  code: "ERROR-001",
  title: "Fake Aggregated Error",
  severity: "Error",
  count: 25,
});

const defaultFilters: QualityControlFilterForm = {
  issueType: "All",
  batchID: "All",
  nodeType: "All",
  severity: "All",
};

const defaultFiltersRef: MutableRefObject<QualityControlFilterForm> = {
  current: defaultFilters,
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
        total: 0,
        skipped: 0,
        comparisons: [],
      },
    },
  },
  maxUsageCount: Infinity,
};

describe("ExportValidationButton (Expanded View) tests", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not have accessibility violations", async () => {
    const { container } = render(
      <TestParent mocks={[]} submission={{ _id: "example-sub-id" }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have a tooltip present on the button", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent mocks={[]} submission={{ _id: "test-tooltip-id" }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-validation-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export filtered validation issues to Excel");
  });

  it("should execute the SUBMISSION_QC_RESULTS query onClick", async () => {
    const submissionID = "example-execute-test-sub-id";

    let called = false;
    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        result: () => {
          called = true;

          return {
            data: {
              submissionQCResults: {
                total: 1,
                results: [qcResultFactory.build({ submissionID })],
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    expect(called).toBe(false);

    // NOTE: This must be separate from the expect below to ensure its not called multiple times
    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(called).toBe(true);
    });
  });

  it("should pass expanded filters into recursive export query variables", async () => {
    const submissionID = "expanded-filtered-export-sub-id";
    let called = false;

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            issueCode: "M018",
            nodeTypes: ["participant"],
            batchIDs: [101],
            severities: "Warning",
            first: 5000,
            offset: 0,
          },
        },
        result: () => {
          called = true;
          return {
            data: {
              submissionQCResults: {
                total: 1,
                results: [
                  qcResultFactory.build({
                    submissionID,
                    type: "participant",
                    errors: [],
                    warnings: [
                      {
                        code: "M018",
                        title: "Updated value differs from released",
                        description: "Simulated warning for filtered export",
                        offendingProperty: "some_property",
                        offendingValue: "new value",
                      },
                    ],
                  }),
                ],
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton
          filtersRef={{
            current: {
              issueType: "M018",
              nodeType: "participant",
              batchID: 101,
              severity: "Warning",
            },
          }}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(called).toBe(true);
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(".xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });

  it("should pass expanded filters into comparisons query variables", async () => {
    const submissionID = "expanded-filtered-comparison-sub-id";
    let comparisonCalled = false;

    const mocks: MockedResponse[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            issueCode: "M018",
            nodeTypes: ["participant"],
            batchIDs: [101],
            severities: "Warning",
            first: 5000,
            offset: 0,
          },
        },
        result: {
          data: {
            submissionQCResults: {
              total: 1,
              results: [
                qcResultFactory.build({
                  submissionID,
                  type: "participant",
                  errors: [],
                  warnings: [
                    {
                      code: "M018",
                      title: "Updated value differs from released",
                      description: "Simulated warning for comparison export",
                      offendingProperty: "some_property",
                      offendingValue: "new value",
                    },
                  ],
                }),
              ],
            },
          },
        },
      },
      {
        request: {
          query: RETRIEVE_SUBMISSION_QC_COMPARISONS,
        },
        variableMatcher: (variables) =>
          variables?.id === submissionID &&
          variables?.issueCode === "M018" &&
          variables?.severities === "Warning" &&
          Array.isArray(variables?.nodeTypes) &&
          variables.nodeTypes[0] === "participant" &&
          Array.isArray(variables?.batchIDs) &&
          variables.batchIDs[0] === 101,
        result: () => {
          comparisonCalled = true;
          return {
            data: {
              retrieveSubmissionQCComparisons: {
                total: 1,
                skipped: 0,
                comparisons: [
                  {
                    submittedID: "participant_1",
                    nodeType: "participant",
                    existingProps: JSON.stringify({ program_name: "old" }),
                    incomingProps: JSON.stringify({ program_name: "new" }),
                  },
                ],
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton
          filtersRef={{
            current: {
              issueType: "M018",
              nodeType: "participant",
              batchID: 101,
              severity: "Warning",
            },
          }}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(comparisonCalled).toBe(true);
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(".xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });

  it.each<{ original: string; expected: string }>([
    { original: "A B C 1 2 3", expected: "A-B-C-1-2-3" },
    { original: "long name".repeat(100), expected: "long-name".repeat(100) },
    { original: "", expected: "" },
    { original: `non $alpha name $@!819`, expected: "non-alpha-name-819" },
    { original: "  ", expected: "" },
    { original: `_-"a-b+c=d`, expected: "-a-bcd" },
    { original: "CRDCDH-1234", expected: "CRDCDH-1234" },
    { original: "SPACE-AT-END ", expected: "SPACE-AT-END" },
  ])(
    "should safely create the CSV filename using submission name and export date",
    async ({ original, expected }) => {
      vi.useFakeTimers().setSystemTime(new Date("2021-01-19T14:54:01Z"));

      const mocks: MockedResponse[] = [
        mockQCComparisons,
        {
          request: {
            query: SUBMISSION_QC_RESULTS,
            variables: {
              partial: false,
              id: "example-dynamic-filename-id",
              sortDirection: "asc",
              orderBy: "displayID",
              first: 5000,
              offset: 0,
              severities: "All",
            },
          },
          result: {
            data: {
              submissionQCResults: {
                total: 1,
                results: [
                  qcResultFactory.build({
                    submissionID: "example-dynamic-filename-id",
                    errors: [
                      {
                        code: null,
                        title: "Error 01",
                        description: "Error 01 description",
                      },
                    ],
                  }),
                ],
              },
            },
          },
        },
      ];

      const { getByTestId } = render(
        <TestParent
          mocks={mocks}
          submission={{ _id: "example-dynamic-filename-id", name: original }}
        >
          <ExportValidationButton filtersRef={defaultFiltersRef} />
        </TestParent>
      );

      fireEvent.click(getByTestId("export-validation-button"));

      await waitFor(() => {
        const filename = `${expected}-2021-01-19T145401.xlsx`;
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          expect.anything(),
          filename,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      });

      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  );

  it("should alert the user if there are no QC Results to export", async () => {
    const submissionID = "example-no-results-to-export-id";

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        result: {
          data: {
            submissionQCResults: {
              total: 0,
              results: [],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Generating the validation results file. This may take a moment...",
        {
          variant: "default",
        }
      );
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There are no validation results matching the selected filters.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should create an xlsx download for expanded results", async () => {
    const submissionID = "formatter-callback-sub-id";

    const qcErrors = errorMessageFactory.build(2, (index) => ({
      code: null,
      title: `Error 0${index + 1}`,
      description: `Error 0${index + 1} description`,
    }));
    const qcWarnings = errorMessageFactory.build(2, (index) => ({
      code: null,
      title: `Warning 0${index + 1}`,
      description: `Warning 0${index + 1} description`,
    }));

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        result: {
          data: {
            submissionQCResults: {
              total: 3,
              results: qcResultFactory.build(3, (index) => ({
                errors: qcErrors,
                warnings: qcWarnings,
                submissionID,
                displayID: index + 1,
              })),
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(".xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });

  it("should handle network errors when fetching the QC Results without crashing", async () => {
    const submissionID = "random-010101-sub-id";

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export expanded validation results. Error:"),
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the QC Results without crashing", async () => {
    const submissionID = "example-GraphQL-level-errors-id";

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export expanded validation results. Error:"),
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle invalid datasets without crashing", async () => {
    const submissionID = "example-dataset-level-errors-id";

    const mocks: MockedResponse[] = [
      mockQCComparisons,
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: 5000,
            offset: 0,
            severities: "All",
          },
        },
        result: {
          data: {
            submissionQCResults: {
              total: 1,
              results: [
                { notReal: "true" } as unknown as QCResult,
                { badData: "agreed" } as unknown as QCResult,
                { 1: null } as unknown as QCResult,
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submission={{ _id: submissionID }}>
        <ExportValidationButton filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export expanded validation results. Error:"),
        {
          variant: "error",
        }
      );
    });
  });
});

describe("ExportValidationButton (Aggregated View) tests", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should execute the AGGREGATED_SUBMISSION_QC_RESULTS query onClick if isAggregated is true", async () => {
    const aggregatorID = "test-aggregated-sub-id";

    let called = false;
    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        result: () => {
          called = true;
          return {
            data: {
              aggregatedSubmissionQCResults: {
                total: 2,
                results: [
                  { ...baseAggregatedQCResult, code: "E001" },
                  { ...baseAggregatedQCResult, code: "W002" },
                ],
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(called).toBe(true);
    });
  });

  it("should alert the user if there are no aggregated validation results to export", async () => {
    const aggregatorID = "aggregated-no-results";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        result: {
          data: {
            aggregatedSubmissionQCResults: {
              total: 0,
              results: [],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There are no aggregated validation results to export.",
        { variant: "error" }
      );
    });
  });

  it("should create a valid xlsx filename and call downloadBlob for aggregated results", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2025-01-01T08:30:00Z"));
    const aggregatorID = "aggregated-filename-test";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        result: {
          data: {
            aggregatedSubmissionQCResults: {
              total: 2,
              results: [
                { ...baseAggregatedQCResult, title: "Duplicate Errors" },
                { ...baseAggregatedQCResult, code: "WARN-999" },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID, name: "my aggregator" }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("export-validation-button")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      const filename = "my-aggregator-2025-01-01T083000.xlsx";
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });

  it("should handle aggregator network errors", async () => {
    const aggregatorID = "aggregated-network-error";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        error: new Error("Simulated aggregator network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export aggregated validation results. Error:"),
        { variant: "error" }
      );
    });
  });

  it("should handle aggregator GraphQL errors", async () => {
    const aggregatorID = "aggregated-graphql-error";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        result: {
          errors: [new GraphQLError("Fake aggregator GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export aggregated validation results. Error:"),
        { variant: "error" }
      );
    });
  });

  it("should show a friendly snackbar when aggregated export setup fails", async () => {
    const aggregatorID = "aggregated-setup-throws";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            severity: "all",
            partial: false,
            first: 10_000,
            offset: 0,
            orderBy: "count",
            sortDirection: "desc",
          },
        },
        result: {
          data: {
            aggregatedSubmissionQCResults: {
              total: 1,
              results: [{ ...baseAggregatedQCResult }],
            },
          },
        },
      },
    ];

    vi.spyOn(utils, "filterAlphaNumeric").mockImplementation(() => {
      throw new Error("filename normalization failed"); // Mock a failure in filename generation
    });

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks} submission={{ _id: aggregatorID }}>
        <ExportValidationButton isAggregated filtersRef={defaultFiltersRef} />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export aggregated validation results. Error:"),
        { variant: "error" }
      );
    });
  });
});
