import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import * as SubmissionCtx from "../../components/Contexts/SubmissionContext";
import { SubmissionCtxStatus } from "../../components/Contexts/SubmissionContext";
import { LIST_BATCHES, ListBatchesResp } from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";

import DataActivity from "./DataActivity";

type ParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ mocks, children }: ParentProps) => (
  <TestRouter basename="">
    <MockedProvider mocks={mocks} showWarnings>
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </MockedProvider>
  </TestRouter>
);

describe("General", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not have any accessibility violations", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADING,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
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
      },
    ];

    const { container } = render(<DataActivity ref={null} />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it.todo("should refetch data when the submission ID changes");

  it("should show an error message when the batches cannot be fetched (network)", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build({
            _id: "simulated-network-error",
          }),
          submissionStats: null,
          getSubmissionAttributes: null,
        },
        error: null,
        refetch: null,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
        request: {
          query: LIST_BATCHES,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    render(<DataActivity />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve batch data.", {
        variant: "error",
      });
    });
  });

  it("should show an error message when the batches cannot be fetched (GraphQL)", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build({
            _id: "simulated-graphql-error",
          }),
          submissionStats: null,
          getSubmissionAttributes: null,
        },
        error: null,
        refetch: null,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
        request: {
          query: LIST_BATCHES,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    render(<DataActivity />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve batch data.", {
        variant: "error",
      });
    });
  });

  it("should not crash when no submission is available", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue({
      status: SubmissionCtxStatus.LOADED,
      data: null,
      error: null,
    });

    const { container } = render(<DataActivity />, {
      wrapper: ({ children }) => <TestParent>{children}</TestParent>,
    });

    expect(container).toBeInTheDocument();
  });
});

describe("Table", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render the placeholder text when no data is available", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build(),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: {
            submissionAttributes: {
              isBatchUploading: false,
              hasOrphanError: false,
            },
          },
        },
        error: null,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
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
      },
    ];

    const { getByText } = render(<DataActivity ref={null} />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByText(/No existing data was found/i)).toBeInTheDocument();
    });
  });

  it.todo("should have an interactive file count column");

  it.todo("should display an interactive upload errors column");

  it.todo("should use the correct pluralization for the error count of %p");

  it("should not refetch the submission if the submission is already polling", async () => {
    const mockRefetch = vi.fn();
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.POLLING,
        data: {
          getSubmission: submissionFactory.build({
            _id: "refetching-submission-test",
          }),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: {
            submissionAttributes: {
              isBatchUploading: true,
              hasOrphanError: false,
            },
          },
        },
        error: null,
        refetch: mockRefetch,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
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
      },
    ];

    render(<DataActivity ref={null} />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  it("should have a default pagination count of 20 rows per page", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build(),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: {
            submissionAttributes: {
              isBatchUploading: false,
              hasOrphanError: false,
            },
          },
        },
        error: null,
      })
    );

    const mocks: MockedResponse<ListBatchesResp>[] = [
      {
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
      },
    ];

    const { getByTestId } = render(<DataActivity ref={null} />, {
      wrapper: ({ children }) => <TestParent mocks={mocks}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("generic-table-rows-per-page-bottom")).toHaveValue("20");
    });
  });
});
