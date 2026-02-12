import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { submissionNodeFactory } from "@/factories/submission/SubmissionNodeFactory";

import {
  RETRIEVE_RELEASED_DATA,
  RetrieveReleasedDataInput,
  RetrieveReleasedDataResp,
} from "../../graphql";
import { act, render, waitFor } from "../../test-utils";

import NodeComparison from "./index";

const mockTableRender = vi.fn().mockImplementation(() => <div>MOCK COMPARISON TABLE</div>);
vi.mock("./ComparisonTable", () => ({
  __esModule: true,
  default: (...p) => mockTableRender(...p),
}));

type MockParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks, children }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    {children}
  </MockedProvider>
);

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: [],
        },
      },
    };

    const { container } = render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await act(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});

describe("Basic Functionality", () => {
  it("should show an error message when nodes cannot be fetch (Network)", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      error: new Error("GraphQL error"),
    };

    render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to retrieve the data record comparison",
        { variant: "error" }
      );
    });
  });

  it("should show an error message when nodes cannot be fetch (GraphQL)", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("GraphQL mock error")],
      },
    };

    render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to retrieve the data record comparison",
        { variant: "error" }
      );
    });
  });

  it("should forward the node data to the ComparisonTable", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: [
            submissionNodeFactory.pick(["nodeType", "nodeID", "props"]).build({
              nodeType: "mock_node_type",
              nodeID: "mock_node_id",
              props: JSON.stringify({ mock_node_data_name: "foo", baz: 1 }),
            }),
            submissionNodeFactory.pick(["nodeType", "nodeID", "props"]).build({
              nodeType: "mock_node_type",
              nodeID: "mock_node_id",
              props: JSON.stringify({ mock_node_data_name: "bar", baz: 2 }),
            }),
          ],
        },
      },
    };

    render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      // Calls twice because of the loading state
      expect(mockTableRender).toHaveBeenCalledWith(
        expect.objectContaining({
          newNode: expect.objectContaining({
            nodeType: "mock_node_type",
            nodeID: "mock_node_id",
            props: JSON.stringify({ mock_node_data_name: "foo", baz: 1 }),
          }),
          existingNode: expect.objectContaining({
            nodeType: "mock_node_type",
            nodeID: "mock_node_id",
            props: JSON.stringify({ mock_node_data_name: "bar", baz: 2 }),
          }),
          loading: false,
        }),
        {}
      );
    });
  });

  it("should forward null, null to the ComparisonTable if the API returns a non-nominal array length (1)", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: [
            submissionNodeFactory.pick(["nodeType", "nodeID", "props"]).build({
              nodeType: "mock_node_type",
              nodeID: "mock_node_id",
              props: JSON.stringify({ mock_node_data_name: "foo", baz: 1 }),
            }),
          ],
        },
      },
    };

    render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(mockTableRender).toHaveBeenCalledWith(
        expect.objectContaining({
          newNode: null,
          existingNode: null,
          loading: false,
        }),
        {}
      );
    });
  });

  it("should forward null, null to the ComparisonTable if the API returns a non-nominal array length (3)", async () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: submissionNodeFactory
            .pick(["nodeType", "nodeID", "props"])
            .build(3, {
              nodeType: "mock_node_type",
              nodeID: "mock_node_id",
              props: JSON.stringify({ mock_node_data_name: "foo", baz: 1 }),
            }),
        },
      },
    };

    render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(mockTableRender).toHaveBeenCalledWith(
        expect.objectContaining({
          newNode: null,
          existingNode: null,
          loading: false,
        }),
        {}
      );
    });
  });
});

describe("Implementation Requirements", () => {
  it("should have a header describing the comparison", () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: [],
        },
      },
    };

    const { getByTestId } = render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    expect(getByTestId("node-comparison-header")).toBeInTheDocument();
    expect(getByTestId("node-comparison-header")).toHaveTextContent(
      /A record with this ID already exists. Review the existing and newly submitted data to decide whether to update the current record./
    );
  });

  it("should have a footer describing special values", () => {
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: () => true,
      result: {
        data: {
          retrieveReleasedDataByID: [],
        },
      },
    };

    const { getByTestId } = render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    expect(getByTestId("node-comparison-footer")).toBeInTheDocument();

    // NOTE: Each line is broken up to avoid dealing with whitespace issues by reading it as text
    // instead of HTML
    expect(getByTestId("node-comparison-footer")).toHaveTextContent(`Notes:`);
    expect(getByTestId("node-comparison-footer")).toHaveTextContent(
      `Columns with Empty values will leave existing data unchanged.`
    );
    expect(getByTestId("node-comparison-footer")).toHaveTextContent(
      `Columns with "<delete>" values will remove the existing data.`
    );
  });
});

describe("Snapshots", () => {
  it("should match the nominal state snapshot", async () => {
    const mockMatcher = vi.fn().mockReturnValue(true);
    const mock: MockedResponse<RetrieveReleasedDataResp, RetrieveReleasedDataInput> = {
      request: {
        query: RETRIEVE_RELEASED_DATA,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          retrieveReleasedDataByID: [],
        },
      },
    };

    const { container } = render(<NodeComparison submissionID="" nodeType="" submittedID="" />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    await waitFor(() => {
      expect(mockMatcher).toHaveBeenCalled(); // wait for the state to normalize
    });

    expect(container).toMatchSnapshot();
  });
});
