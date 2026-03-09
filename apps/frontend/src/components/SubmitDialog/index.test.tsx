import { MockedProvider, type MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { nodeTypeSummaryFactory } from "@/factories/submission/NodeTypeSummaryFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import {
  GET_SUBMISSION_SUMMARY,
  type GetSubmissionSummaryResp,
  type GetSubmissionSummaryInput,
} from "@/graphql";
import { render, waitFor, within } from "@/test-utils";

import { SubmissionContext, SubmissionCtxState } from "../Contexts/SubmissionContext";

import SubmitDialog from "./index";

const mock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
  request: {
    query: GET_SUBMISSION_SUMMARY,
  },
  variableMatcher: () => true,
  result: {
    data: {
      getSubmissionSummary: nodeTypeSummaryFactory.build(3, (index) => ({
        nodeType: `NodeType ${index + 1}`,
        new: 10,
        updated: 25,
        deleted: 50,
      })),
    },
  },
};

type TestParentProps = {
  submission?: Partial<Submission>;
  mocks?: ReadonlyArray<MockedResponse>;
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({ submission, children, mocks = [] }) => {
  const value = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        data: {
          getSubmission: submissionFactory.build({
            _id: "submission-1",
            submitterID: "current-user",
            intention: "New/Update",
            ...submission,
          }),
          getSubmissionAttributes: null,
          submissionStats: null,
        },
      }),
    [submission]
  );

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      <SubmissionContext.Provider value={value}>{children}</SubmissionContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  it("should have no violations (open)", async () => {
    const { getByTestId, queryByTestId, container } = render(
      <TestParent mocks={[mock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
      expect(queryByTestId("submit-summary-skeleton")).not.toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have no violations (closed)", async () => {
    const { queryByTestId, container } = render(
      <TestParent mocks={[mock]}>
        <SubmitDialog open={false} bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    expect(queryByTestId("submit-dialog-header")).not.toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("renders text and handles close + confirm actions", async () => {
    const basicMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionSummary: nodeTypeSummaryFactory.build(3, (i) => ({
            nodeType: `NodeType ${i + 1}`,
            new: 10,
            updated: 5,
            deleted: 0,
          })),
        },
      },
    };

    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { getByTestId, queryByTestId, findByTestId, getByText } = render(
      <TestParent mocks={[basicMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={onClose} onConfirm={onConfirm} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
      expect(queryByTestId("submit-summary-skeleton")).not.toBeInTheDocument();
    });

    expect(getByTestId("submit-dialog-title")).toHaveTextContent("Data Submission");
    expect(getByTestId("submit-dialog-header")).toHaveTextContent("Submit Data Submission");
    expect(getByTestId("submit-dialog-description")).toBeInTheDocument();

    userEvent.click(getByTestId("submit-dialog-close-icon-button"));
    expect(onClose).toHaveBeenCalledTimes(1);

    userEvent.click(getByTestId("submit-dialog-cancel-button"));
    expect(onClose).toHaveBeenCalledTimes(2);

    userEvent.click(getByTestId("submit-dialog-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const tbody = await findByTestId("submit-summary-table-body");
    expect(within(tbody).getByText("NodeType 1")).toBeInTheDocument();
    expect(getByText("New Nodes")).toBeInTheDocument();
    expect(getByText("Updated Nodes")).toBeInTheDocument();
  });

  it("shows a skeleton for intention when intention is not available", async () => {
    const skeletonMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionSummary: nodeTypeSummaryFactory.build(2),
        },
      },
    };

    const { getByTestId } = render(
      <TestParent mocks={[skeletonMock]} submission={{ intention: undefined }}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    const intentionEl = getByTestId("submit-dialog-intention");
    expect(intentionEl).toBeInTheDocument();
    expect(intentionEl).not.toHaveTextContent(/New\/Update|Delete/i);
  });

  it("should gracefully handle API errors when retrieving summary data (GraphQL)", async () => {
    const gqlErrorMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: { errors: [new GraphQLError("mock error")] },
    };

    const { getByTestId, getAllByTestId } = render(
      <TestParent mocks={[gqlErrorMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission summary data.",
        { variant: "error" }
      );
    });

    expect(getAllByTestId("submit-summary-skeleton").length).toBeGreaterThan(0);
    expect(getByTestId("submit-dialog-cancel-button")).toBeEnabled();
    expect(getByTestId("submit-dialog-confirm-button")).toBeEnabled();
  });

  it("should gracefully handle API errors when retrieving summary data (Network)", async () => {
    const networkErrorMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByTestId, getAllByTestId } = render(
      <TestParent mocks={[networkErrorMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission summary data.",
        { variant: "error" }
      );
    });

    expect(getAllByTestId("submit-summary-skeleton").length).toBeGreaterThan(0);
  });

  it("should gracefully handle API errors when retrieving summary data (Null Data)", async () => {
    const nullDataMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionSummary: null,
        },
      },
    };

    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { getByTestId, getAllByTestId } = render(
      <TestParent mocks={[nullDataMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={onClose} onConfirm={onConfirm} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Unable to retrieve submission summary data.",
        { variant: "error" }
      );
    });

    expect(getAllByTestId("submit-summary-skeleton").length).toBeGreaterThan(0);

    userEvent.click(getByTestId("submit-dialog-close-icon-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Implementation Requirements", () => {
  it("renders intention text and table data for New/Update", async () => {
    const newUpdateMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionSummary: nodeTypeSummaryFactory.build(3, (index) => ({
            nodeType: `NodeType ${index + 1}`,
            new: 50 + index,
            updated: 7 + index,
            deleted: 0,
          })),
        },
      },
    };

    const { findByText, findByTestId, getByTestId, queryByTestId } = render(
      <TestParent mocks={[newUpdateMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
      expect(queryByTestId("submit-summary-skeleton")).not.toBeInTheDocument();
    });

    expect(await findByText("New/Update")).toBeInTheDocument();

    const tbody = await findByTestId("submit-summary-table-body");
    expect(within(tbody).getByText("NodeType 1")).toBeInTheDocument();
    expect(within(tbody).getByText("50")).toBeInTheDocument();
    expect(within(tbody).getByText("7")).toBeInTheDocument();
  });

  it("renders delete-only table when intention is Delete", async () => {
    const deleteMock: MockedResponse<GetSubmissionSummaryResp, GetSubmissionSummaryInput> = {
      request: { query: GET_SUBMISSION_SUMMARY },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionSummary: nodeTypeSummaryFactory.build(2, (index) => ({
            nodeType: `NodeType ${index + 1}`,
            new: 0,
            updated: 0,
            deleted: 42 + index,
          })),
        },
      },
    };

    const { findByText, findByTestId, getByTestId, queryByTestId } = render(
      <TestParent submission={{ intention: "Delete" }} mocks={[deleteMock]}>
        <SubmitDialog open bodyText="Lorem Ipsum" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submit-dialog-header")).toBeVisible();
      expect(queryByTestId("submit-summary-skeleton")).not.toBeInTheDocument();
    });

    expect(await findByText("Delete")).toBeInTheDocument();

    const tbody = await findByTestId("submit-summary-table-body");
    expect(within(tbody).getByText("NodeType 1")).toBeInTheDocument();
    expect(within(tbody).getByText("42")).toBeInTheDocument();
    expect(await findByText("Deleted Nodes")).toBeInTheDocument();
  });

  it("renders the submit dialog with specified bodyText", async () => {
    const { getByText } = render(
      <TestParent mocks={[mock]}>
        <SubmitDialog open bodyText="Test Body Text" onClose={() => {}} onConfirm={() => {}} />
      </TestParent>
    );

    expect(getByText(/Test Body Text/i)).toBeInTheDocument();
  });
});
