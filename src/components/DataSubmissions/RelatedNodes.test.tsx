import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC } from "react";

import { GET_RELATED_NODES } from "../../graphql";
import { TestRouter, queryByTestId, render, waitFor } from "../../test-utils";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import RelatedNodes from "./RelatedNodes";

const mocks = [
  {
    request: {
      query: GET_RELATED_NODES,
      variables: {
        submissionID: "fake-submission-id",
        nodeType: "file",
        nodeID: "fake-node-id",
        relationship: "parent",
        relatedNodeType: "sample",
        propertiesOnly: true,
      },
    },
    result: {
      data: {
        getRelatedNodes: {
          properties: [
            "sample_id",
            "sample_type",
            "sample_anatomic_site",
            "sample_tumor_status",
            "participant.study_participant_id",
          ],
          IDPropName: "sample_id",
          nodes: null,
          total: null,
        },
      },
    },
  },
  {
    request: {
      query: GET_RELATED_NODES,
      variables: {
        submissionID: "fake-submission-id",
        nodeType: "file",
        nodeID: "fake-node-id",
        relationship: "parent",
        relatedNodeType: "study",
        propertiesOnly: true,
      },
    },
    result: {
      data: {
        getRelatedNodes: {
          properties: [],
          IDPropName: "phs_accession",
          nodes: null,
          total: null,
        },
      },
    },
  },
  {
    request: {
      query: GET_RELATED_NODES,
      variables: {
        submissionID: "fake-submission-id",
        nodeType: "file",
        nodeID: "fake-node-id",
        relationship: "parent",
        relatedNodeType: "sample",
        first: 20,
        offset: 0,
        sortDirection: "asc",
        orderBy: "sample_id",
        propertiesOnly: false,
      },
    },
    result: {
      data: {
        getRelatedNodes: {
          nodes: [
            {
              nodeType: "sample",
              nodeID: "ABC1200_Blood Biospecimen Type",
              status: "New",
              props:
                '{"sample_id":"ABC1200_Blood Biospecimen Type","sample_type":"Blood Biospecimen Type","sample_anatomic_site":"Tumor","sample_tumor_status":"Tumor","participant.study_participant_id":"phs0123_ABC1200"}',
            },
          ],
          total: 1,
          properties: null,
          IDPropName: null,
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
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter>
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </TestRouter>
  </MockedProvider>
);

describe("RelatedNodes", () => {
  const props = {
    submissionID: "fake-submission-id",
    nodeType: "file",
    nodeID: "fake-node-id",
    parentNodes: [
      {
        nodeType: "sample",
        total: 1,
      },
      {
        nodeType: "study",
        total: 7,
      },
    ],
    childNodes: [],
  };

  it("renders tabs and initiates a query on tab selection", async () => {
    const { getByText, getByTestId } = render(
      <TestParent mocks={mocks}>
        <RelatedNodes {...props} />
      </TestParent>
    );

    expect(getByText("Sample (1)")).toBeInTheDocument();
    expect(getByText("Study (7)")).toBeInTheDocument();
    expect(getByTestId("generic-table")).toBeInTheDocument();
  });

  it("shows error via snackbar when data fetching fails", async () => {
    const newProps = {
      submissionID: "fake-submission-id",
      nodeType: "file",
      nodeID: "fake-node-id",
      parentNodes: [
        {
          nodeType: "sample",
          total: 1,
        },
        {
          nodeType: "study",
          total: 7,
        },
      ],
      childNodes: [],
    };
    const errorMocks = [
      mocks[0],
      {
        request: {
          query: GET_RELATED_NODES,
          variables: {
            submissionID: "fake-submission-id",
            nodeType: "file",
            nodeID: "fake-node-id",
            relationship: "parent",
            relatedNodeType: "sample",
            first: 20,
            offset: 0,
            sortDirection: "asc",
            orderBy: "sample_id",
            propertiesOnly: false,
          },
        },
        error: new Error("An error occurred"),
      },
    ];
    render(
      <TestParent mocks={errorMocks}>
        <RelatedNodes {...newProps} />
      </TestParent>
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to load related node details.", {
        variant: "error",
      });
    });
  });

  it("handles no data state for tabs", async () => {
    const { getByText } = render(
      <TestParent mocks={[]}>
        <RelatedNodes {...props} parentNodes={[]} childNodes={[]} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("No existing data was found")).toBeInTheDocument();
    });
  });

  it.each(mocks[0].result.data.getRelatedNodes.properties)(
    "properly handles column setup from properties",
    async (column: string) => {
      const { getByText, getByTestId } = render(
        <TestParent mocks={mocks}>
          <RelatedNodes {...props} />
        </TestParent>
      );

      const tab = getByTestId("related-nodes-parent-node-tab-0");
      userEvent.click(tab);

      await waitFor(() => {
        expect(getByTestId("generic-table")).toBeInTheDocument();
        expect(getByText(column)).toBeInTheDocument();
      });
    }
  );

  it("handles empty columns gracefully", async () => {
    const mocks = [
      {
        request: {
          query: GET_RELATED_NODES,
          variables: {
            submissionID: "fake-submission-id",
            nodeType: "file",
            nodeID: "fake-node-id",
            relationship: "parent",
            relatedNodeType: "sample",
            propertiesOnly: true,
          },
        },
        result: {
          data: {
            getRelatedNodes: {
              properties: [],
              IDPropName: "sample_id",
            },
          },
        },
      },
    ];
    const { container, getByText } = render(
      <TestParent mocks={mocks}>
        <RelatedNodes {...props} parentNodes={[]} childNodes={[]} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("No existing data was found")).toBeInTheDocument();
      expect(queryByTestId(container, /generic-table-header-/)).not.toBeInTheDocument();
    });
  });

  it("capitalizes the first letter of node types for tabs", async () => {
    const newProps = {
      ...props,
      parentNodes: [
        {
          nodeType: "sample",
          total: NaN,
        },
      ],
      childNodes: [
        {
          nodeType: "study",
          total: NaN,
        },
      ],
    };
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <RelatedNodes {...newProps} />
      </TestParent>
    );

    // Check that each tab's label is correctly capitalized
    await waitFor(() => {
      const parentTab = getByTestId(`related-nodes-parent-node-tab-0`);
      expect(parentTab.textContent).toBe("Sample (0)");
      const childTab = getByTestId(`related-nodes-child-node-tab-0`);
      expect(childTab.textContent).toBe("Study (0)");
    });
  });

  it("selects the first tab, prioritizing parent nodes", async () => {
    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <RelatedNodes {...props} />
      </TestParent>
    );

    await waitFor(() => {
      const parentTab = getByTestId(`related-nodes-parent-node-tab-0`);
      expect(parentTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("selects the first child tab if no parent nodes are available", async () => {
    const newMocks = [
      {
        request: {
          query: GET_RELATED_NODES,
          variables: {
            submissionID: "fake-submission-id",
            nodeType: "child-node-type",
            nodeID: "fake-node-id",
            relationship: "child",
            relatedNodeType: "child-node-type",
            propertiesOnly: true,
          },
        },
        result: {
          data: {
            getRelatedNodes: {
              properties: ["child_node_id", "child_node_type"],
              IDPropName: "sample_id",
              nodes: null,
              total: null,
            },
          },
        },
      },
      {
        request: {
          query: GET_RELATED_NODES,
          variables: {
            submissionID: "fake-submission-id",
            nodeType: "child-node-type",
            nodeID: "fake-node-id",
            relationship: "child",
            relatedNodeType: "child-node-type",
            first: 20,
            offset: 0,
            sortDirection: "asc",
          },
        },
        result: {
          data: {
            getRelatedNodes: {
              nodes: [],
              total: 1,
            },
          },
        },
      },
    ];
    const newProps = {
      submissionID: "fake-submission-id",
      nodeType: "child-node-type",
      nodeID: "fake-node-id",
      parentNodes: [],
      childNodes: [
        {
          nodeType: "child-node-type",
          total: 1,
        },
      ],
    };
    const { getByTestId } = render(
      <TestParent mocks={newMocks}>
        <RelatedNodes {...newProps} />
      </TestParent>
    );

    await waitFor(() => {
      const childTab = getByTestId(`related-nodes-child-node-tab-0`);
      expect(childTab).toHaveAttribute("aria-selected");
    });
  });
});
