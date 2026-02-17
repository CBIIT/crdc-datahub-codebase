import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { crossValidationResultFactory } from "@/factories/submission/CrossValidationResultFactory";
import { errorMessageFactory } from "@/factories/submission/ErrorMessageFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import {
  CrossValidationResultsInput,
  CrossValidationResultsResp,
  SUBMISSION_CROSS_VALIDATION_RESULTS,
} from "../../graphql";
import { render, fireEvent, waitFor } from "../../test-utils";
import {
  SubmissionCtxState,
  SubmissionCtxStatus,
  SubmissionContext,
} from "../Contexts/SubmissionContext";

import { ExportCrossValidationButton } from "./ExportCrossValidationButton";

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

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

describe("ExportCrossValidationButton cases", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should not have accessibility violations", async () => {
    const { container, getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[]}>{children}</TestParent>,
    });

    expect(getByTestId("export-cross-validation-button")).not.toBeDisabled(); // Sanity check
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <ExportCrossValidationButton fields={{}} disabled />,
      {
        wrapper: ({ children }) => <TestParent mocks={[]}>{children}</TestParent>,
      }
    );

    expect(getByTestId("export-cross-validation-button")).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have a tooltip present on the button", async () => {
    const { getByTestId, findByRole } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[]}>{children}</TestParent>,
    });

    userEvent.hover(getByTestId("export-cross-validation-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export all cross validation issues to a CSV file");
  });

  it("should only execute the fetch query onClick", async () => {
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

    const { getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    expect(mockMatcher).not.toHaveBeenCalled();

    userEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalledTimes(1);
    });
  });

  it.each<{ name: string; date: Date; expected: string }>([
    {
      name: "Example Submission",
      date: new Date("2021-01-19T14:54:01Z"),
      expected: "Example-Submission-cross-validation-results-2021-01-19.csv",
    },
    {
      name: "long name".repeat(100),
      date: new Date("2007-11-13T13:01:01Z"),
      expected: `${"long-name".repeat(100)}-cross-validation-results-2007-11-13.csv`,
    },
    {
      name: "",
      date: new Date("2019-01-13T01:12:00Z"),
      expected: "-cross-validation-results-2019-01-13.csv",
    },
    {
      name: "non $alpha name $@!819",
      date: new Date("2015-02-27T23:23:19Z"),
      expected: "non-alpha-name-819-cross-validation-results-2015-02-27.csv",
    },
    {
      name: "  ",
      date: new Date("2018-01-01T01:01:01Z"),
      expected: "-cross-validation-results-2018-01-01.csv",
    },
    {
      name: "_-'a-b+c=d",
      date: new Date("2031-07-04T18:22:15Z"),
      expected: "-a-bcd-cross-validation-results-2031-07-04.csv",
    },
    {
      name: "CRDCDH-1234",
      date: new Date("2023-05-22T07:02:01Z"),
      expected: "CRDCDH-1234-cross-validation-results-2023-05-22.csv",
    },
    {
      name: "SPACE-AT-END ",
      date: new Date("1999-03-13T04:04:03Z"),
      expected: "SPACE-AT-END-cross-validation-results-1999-03-13.csv",
    },
  ])(
    "should generate the correct filename for the submission using the name and current date",
    async ({ name, date, expected }) => {
      vi.useFakeTimers({ now: date }).setSystemTime(date);

      const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
        request: {
          query: SUBMISSION_CROSS_VALIDATION_RESULTS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            submissionCrossValidationResults: {
              total: 1,
              results: crossValidationResultFactory.build(1),
            },
          },
        },
      };

      const fields = {
        ID: vi.fn().mockImplementation((result: QCResult) => result.submissionID),
      };

      const { getByTestId } = render(<ExportCrossValidationButton fields={fields} />, {
        wrapper: ({ children }) => (
          <TestParent mocks={[mock]} submission={submissionFactory.build({ name })}>
            {children}
          </TestParent>
        ),
      });

      // NOTE: Using fireEvent instead of userEvent to avoid the tooltip and act warning
      fireEvent.click(getByTestId("export-cross-validation-button"));

      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          expect.any(String),
          expected,
          expect.any(String)
        );
      });

      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  );

  it("should alert the user if there are no results to export", async () => {
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

    const { getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    fireEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There are no cross validation results to export.",
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

    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 3,
            results: crossValidationResultFactory.build(3, (index) => ({
              errors: qcErrors,
              warnings: qcWarnings,
              submissionID,
              displayID: index + 1,
            })),
          },
        },
      },
    };

    const fields = {
      DisplayID: vi.fn().mockImplementation((result: CrossValidationResult) => result.displayID),
      ValidationType: vi
        .fn()
        .mockImplementation((result: CrossValidationResult) => result.validationType),
      // Testing the fallback of falsy values
      NullValueField: vi.fn().mockImplementation(() => null),
    };

    const { getByTestId } = render(<ExportCrossValidationButton fields={fields} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    fireEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      // NOTE: The results are unpacked, 3 QCResults with 2 errors and 2 warnings each = 12 calls
      expect(fields.DisplayID).toHaveBeenCalledTimes(12);
      expect(fields.ValidationType).toHaveBeenCalledTimes(12);
    });
  });

  it("should handle network errors when fetching the data without crashing", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      error: new Error("Simulated network error"),
    };

    const { getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    fireEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve cross validation results.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the QC Results without crashing", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Simulated GraphQL error")],
      },
    };

    const { getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    fireEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve cross validation results.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle invalid datasets without crashing", async () => {
    const mock: MockedResponse<CrossValidationResultsResp, CrossValidationResultsInput> = {
      request: {
        query: SUBMISSION_CROSS_VALIDATION_RESULTS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          submissionCrossValidationResults: {
            total: 3,
            results: [
              { notReal: "true" } as unknown as CrossValidationResult,
              { badData: "agreed" } as unknown as CrossValidationResult,
              { 1: null } as unknown as CrossValidationResult,
            ],
          },
        },
      },
    };

    const { getByTestId } = render(<ExportCrossValidationButton fields={{}} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    fireEvent.click(getByTestId("export-cross-validation-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        expect.stringContaining("Unable to export cross validation results. Error:"),
        {
          variant: "error",
        }
      );
    });
  });
});
