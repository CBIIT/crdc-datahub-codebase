import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC } from "react";

import { GET_NODE_DETAIL } from "../../graphql";
import { TestRouter, render } from "../../test-utils";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import DataViewDetailsDialog from "./DataViewDetailsDialog";

const mocks = [
  {
    request: {
      query: GET_NODE_DETAIL,
      variables: {
        submissionID: "12345",
        nodeType: "Node1",
        nodeID: "ID1",
      },
    },
    result: {
      data: {
        getNodeDetail: {
          parents: [],
          children: [],
          IDPropName: "id",
        },
      },
    },
  },
];

type ParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ mocks, children }: ParentProps) => (
  <MockedProvider mocks={mocks} showWarnings>
    <TestRouter basename="">
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </TestRouter>
  </MockedProvider>
);

describe("DataViewDetailsDialog via BaseComponent", () => {
  const mockOnClose = vi.fn();
  const props = {
    submissionID: "12345",
    nodeType: "Node1",
    nodeID: "ID1",
    open: true,
    onClose: mockOnClose,
    closeText: "Close Dialog",
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly when open", () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} />
      </TestParent>
    );
    expect(getByTestId("data-view-dialog-close-icon-button")).toBeInTheDocument();
    expect(getByTestId("data-view-dialog-cancel-button")).toHaveTextContent(props.closeText);
  });

  it("does not render when `open` is false", () => {
    const { queryByText } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} open={false} />
      </TestParent>
    );
    expect(queryByText("Child Content")).not.toBeInTheDocument();
  });

  it("calls onClose when the close icon is clicked", () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} />
      </TestParent>
    );
    userEvent.click(getByTestId("data-view-dialog-close-icon-button"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} />
      </TestParent>
    );
    userEvent.click(getByTestId("data-view-dialog-cancel-button"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders with default close text when `closeText` is not provided", () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} closeText={undefined} />
      </TestParent>
    );
    expect(getByTestId("data-view-dialog-cancel-button")).toHaveTextContent("Close");
  });

  it("renders without crashing when optional props are missing", () => {
    const minimalProps = { ...props, closeText: undefined, nodeType: undefined, nodeID: undefined };
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...minimalProps} />
      </TestParent>
    );
    expect(getByTestId("data-view-dialog-close-icon-button")).toBeInTheDocument();
    expect(getByTestId("data-view-dialog-cancel-button")).toHaveTextContent("Close");
  });

  it("has appropriate aria-labels for accessibility", () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <DataViewDetailsDialog {...props} />
      </TestParent>
    );
    expect(getByTestId("data-view-dialog-close-icon-button")).toHaveAttribute(
      "aria-label",
      "close"
    );
    expect(getByTestId("data-view-dialog-cancel-button")).toHaveAttribute(
      "aria-label",
      "Cancel button"
    );
  });
});
