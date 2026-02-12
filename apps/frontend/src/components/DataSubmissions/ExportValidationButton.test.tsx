import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import React, { FC } from "react";
import { axe } from "vitest-axe";

import { aggregatedQCResultFactory } from "@/factories/submission/AggregatedQCResultFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { qcResultFactory } from "@/factories/submission/QCResultFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  SUBMISSION_QC_RESULTS,
  SubmissionQCResultsResp,
  AGGREGATED_SUBMISSION_QC_RESULTS,
  AggregatedSubmissionQCResultsResp,
} from "../../graphql";
import { render, fireEvent, waitFor } from "../../test-utils";

import { ExportValidationButton } from "./ExportValidationButton";

const mockDownloadBlob = vi.fn();

vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}));

type ParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ mocks, children }: ParentProps) => (
  <MockedProvider mocks={mocks} showWarnings>
    {children}
  </MockedProvider>
);

const baseAggregatedQCResult: AggregatedQCResult = aggregatedQCResultFactory.build({
  code: "ERROR-001",
  title: "Fake Aggregated Error",
  severity: "Error",
  count: 25,
});

describe("ExportValidationButton (Expanded View) tests", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not have accessibility violations", async () => {
    const { container } = render(
      <TestParent mocks={[]}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: "example-sub-id" })}
          fields={{}}
        />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have a tooltip present on the button", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent mocks={[]}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: "test-tooltip-id" })}
          fields={{}}
        />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-validation-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Export all validation issues for this data submission to a CSV file"
    );
  });

  it("should execute the SUBMISSION_QC_RESULTS query onClick", async () => {
    const submissionID = "example-execute-test-sub-id";

    let called = false;
    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
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
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={{}}
        />
      </TestParent>
    );

    expect(called).toBe(false);

    // NOTE: This must be separate from the expect below to ensure its not called multiple times
    userEvent.click(getByTestId("export-validation-button"));
    await waitFor(() => {
      expect(called).toBe(true);
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

      const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
        {
          request: {
            query: SUBMISSION_QC_RESULTS,
            variables: {
              partial: false,
              id: "example-dynamic-filename-id",
              sortDirection: "asc",
              orderBy: "displayID",
              first: -1,
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

      const fields = {
        ID: vi.fn().mockImplementation((result: QCResult) => result.submissionID),
      };

      const { getByTestId } = render(
        <TestParent mocks={mocks}>
          <ExportValidationButton
            submission={submissionFactory.build({
              _id: "example-dynamic-filename-id",
              name: original,
            })}
            fields={fields}
          />
        </TestParent>
      );

      fireEvent.click(getByTestId("export-validation-button"));

      await waitFor(() => {
        const filename = `${expected}-2021-01-19T145401.csv`;
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          expect.any(String),
          filename,
          expect.any(String)
        );
      });

      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  );

  it("should alert the user if there are no QC Results to export", async () => {
    const submissionID = "example-no-results-to-export-id";

    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
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
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={{}}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There are no validation results to export.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should call the field value callback function for each field", async () => {
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

    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
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

    const fields = {
      DisplayID: vi.fn().mockImplementation((result: QCResult) => result.displayID),
      ValidationType: vi.fn().mockImplementation((result: QCResult) => result.validationType),
      // Testing the fallback of falsy values
      NullValueField: vi.fn().mockImplementation(() => null),
    };

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={fields}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      // NOTE: The results are unpacked, 3 QCResults with 2 errors and 2 warnings each = 12 calls
      expect(fields.DisplayID).toHaveBeenCalledTimes(12);
      expect(fields.ValidationType).toHaveBeenCalledTimes(12);
    });
  });

  it("should handle network errors when fetching the QC Results without crashing", async () => {
    const submissionID = "random-010101-sub-id";

    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
            offset: 0,
            severities: "All",
          },
        },
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={{}}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission quality control results.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the QC Results without crashing", async () => {
    const submissionID = "example-GraphQL-level-errors-id";

    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
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
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={{}}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission quality control results.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle invalid datasets without crashing", async () => {
    const submissionID = "example-dataset-level-errors-id";

    const mocks: MockedResponse<SubmissionQCResultsResp>[] = [
      {
        request: {
          query: SUBMISSION_QC_RESULTS,
          variables: {
            partial: false,
            id: submissionID,
            sortDirection: "asc",
            orderBy: "displayID",
            first: -1,
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
      <TestParent mocks={mocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: submissionID })}
          fields={{}}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export validation results. Error:"),
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
            partial: false,
            first: -1,
            orderBy: "title",
            sortDirection: "asc",
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
      <TestParent mocks={aggregatorMocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: aggregatorID })}
          fields={{}}
          isAggregated
        />
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
            partial: false,
            first: -1,
            orderBy: "title",
            sortDirection: "asc",
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
      <TestParent mocks={aggregatorMocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: aggregatorID })}
          fields={{}}
          isAggregated
        />
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

  it("should create a valid CSV filename and call downloadBlob for aggregated results", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2025-01-01T08:30:00Z"));
    const aggregatorID = "aggregated-filename-test";

    const aggregatorMocks: MockedResponse<AggregatedSubmissionQCResultsResp>[] = [
      {
        request: {
          query: AGGREGATED_SUBMISSION_QC_RESULTS,
          variables: {
            submissionID: aggregatorID,
            partial: false,
            first: -1,
            orderBy: "title",
            sortDirection: "asc",
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

    const fields = {
      "Issue Type": (row: AggregatedQCResult) => row.title ?? "",
      Severity: (row: AggregatedQCResult) => row.severity ?? "",
      Count: (row: AggregatedQCResult) => String(row.count ?? 0),
    };

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: aggregatorID, name: "my aggregator" })}
          fields={fields}
          isAggregated
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("export-validation-button")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      const filename = "my-aggregator-2025-01-01T083000.csv";
      expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(String), filename, "text/csv");
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
            partial: false,
            first: -1,
            orderBy: "title",
            sortDirection: "asc",
          },
        },
        error: new Error("Simulated aggregator network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: aggregatorID })}
          fields={{}}
          isAggregated
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission aggregated quality control results.",
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
            partial: false,
            first: -1,
            orderBy: "title",
            sortDirection: "asc",
          },
        },
        result: {
          errors: [new GraphQLError("Fake aggregator GraphQL error")],
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={aggregatorMocks}>
        <ExportValidationButton
          submission={submissionFactory.build({ _id: aggregatorID })}
          fields={{}}
          isAggregated
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission aggregated quality control results.",
        { variant: "error" }
      );
    });
  });
});
