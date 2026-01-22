import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { FC } from "react";

import { GET_NODE_DETAIL, GET_RELATED_NODES } from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import DataViewDetails from "./DataViewDetails";

const mocks: MockedResponse[] = [
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
          parents: [{ nodeType: "ParentType", total: 1 }],
          children: [{ nodeType: "ChildType", total: 2 }],
          IDPropName: "id",
        },
      },
    },
  },
  {
    request: {
      query: GET_RELATED_NODES,
      variables: {
        submissionID: "12345",
        nodeType: "Node1",
        nodeID: "ID1",
        relationship: "parent",
        relatedNodeType: "ParentType",
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
        submissionID: "12345",
        nodeType: "Node1",
        nodeID: "ID1",
        relationship: "parent",
        relatedNodeType: "ParentType",
        first: 20,
        offset: 0,
        sortDirection: "asc",
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

describe("DataViewDetails", () => {
  const props = {
    submissionID: "12345",
    nodeType: "Node1",
    nodeID: "ID1",
  };

  it("renders node details correctly", async () => {
    const { getByText } = render(
      <TestParent mocks={mocks}>
        <DataViewDetails {...props} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText(props.nodeID)).toBeInTheDocument();
      expect(getByText(props.nodeType)).toBeInTheDocument();
      expect(getByText("Node1")).toBeInTheDocument();
      expect(getByText("ParentType")).toBeInTheDocument();
      expect(getByText("ChildType")).toBeInTheDocument();
    });
  });

  it("displays loading state correctly", () => {
    const { getByLabelText } = render(
      <TestParent mocks={mocks}>
        <DataViewDetails {...props} />
      </TestParent>
    );
    expect(getByLabelText("Content Loader")).toBeInTheDocument();
  });

  it("handles errors in data fetching", async () => {
    const errorMocks = [
      {
        request: {
          query: GET_NODE_DETAIL,
          variables: {
            submissionID: "12345",
            nodeType: "Node1",
            nodeID: "ID1",
          },
        },
        error: new Error("An error occurred"),
      },
    ];

    render(
      <TestParent mocks={errorMocks}>
        <DataViewDetails {...props} />
      </TestParent>
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to load node details.", {
        variant: "error",
      });
    });
  });

  it("renders multiple parents and children with capitalization and comma separation", async () => {
    const props = {
      submissionID: "12345",
      nodeType: "Node1",
      nodeID: "ID1",
    };

    const enhancedMocks = [
      {
        request: {
          query: GET_NODE_DETAIL,
          variables: props,
        },
        result: {
          data: {
            getNodeDetail: {
              parents: [
                { nodeType: "ParentType", total: 1 },
                { nodeType: "anotherParent", total: 2 },
              ],
              children: [
                { nodeType: "childType", total: 2 },
                { nodeType: "anotherChild", total: 3 },
              ],
              IDPropName: "sample_id",
            },
          },
        },
      },
    ];

    const { getByText } = render(
      <TestParent mocks={[mocks[1], mocks[2], ...enhancedMocks]}>
        <DataViewDetails {...props} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("Parent(s)")).toBeInTheDocument();
      expect(getByText("ParentType, AnotherParent")).toBeInTheDocument();
      expect(getByText("Child(ren)")).toBeInTheDocument();
      expect(getByText("ChildType, AnotherChild")).toBeInTheDocument();
    });
  });

  it("handles no parents or children correctly", async () => {
    const props = {
      submissionID: "12345",
      nodeType: "Node1",
      nodeID: "ID1",
    };

    const emptyMocks = [
      {
        request: {
          query: GET_NODE_DETAIL,
          variables: props,
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

    const { queryByText } = render(
      <TestParent mocks={emptyMocks}>
        <DataViewDetails {...props} />
      </TestParent>
    );

    await waitFor(() => {
      expect(queryByText("ParentType")).not.toBeInTheDocument();
      expect(queryByText("ChildType")).not.toBeInTheDocument();
    });
  });
});
