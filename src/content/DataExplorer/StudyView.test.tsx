import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import React, { FC } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { axe } from "vitest-axe";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";

import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  GET_APPROVED_STUDY,
  GET_RELEASED_NODE_TYPES,
  GetApprovedStudyInput,
  GetApprovedStudyResp,
  GetReleasedNodeTypesInput,
  GetReleasedNodeTypesResp,
} from "../../graphql";
import { TestRouter, render, waitFor } from "../../test-utils";

import StudyView from "./StudyView";

const basePartialStudy: GetApprovedStudyResp<true>["getApprovedStudy"] = approvedStudyFactory
  .pick([
    "_id",
    "studyName",
    "studyAbbreviation",
    "dbGaPID",
    "controlledAccess",
    "openAccess",
    "createdAt",
  ])
  .build()
  .withTypename("ApprovedStudy");

vi.mock("../../components/GenericTable", () => ({
  __esModule: true,
  default: React.forwardRef(() => <div>MOCK-TABLE</div>),
}));

vi.mock("../../components/DataExplorerFilters", () => ({
  __esModule: true,
  default: React.forwardRef(() => <div>MOCK-FILTERS</div>),
}));

/**
 * This component is used to test the StudyView component.
 * It will automatically pull the studyId from the URL parameters
 */
const TestChild: FC = () => {
  const { studyId } = useParams<{ studyId: string }>();

  return <StudyView _id={studyId || ""} />;
};

const TestListView: FC = () => {
  const { state } = useLocation();

  return <div>{state?.error ?? "MOCK-LIST-VIEW"}</div>;
};

type MockParentProps = {
  mocks: MockedResponse[];
  initialEntries?: string[];
};

/**
 * This component mocks the testing setup for the StudyView component.
 *
 * To set the studyId, pass it in the initialEntries prop like so:
 * initialEntries={["/data-explorer/test-study-id?dataCommonsDisplayName=mock-dc"]}
 */
const TestParent: FC<MockParentProps> = ({ mocks = [], initialEntries = [] }: MockParentProps) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    <TestRouter initialEntries={initialEntries}>
      <SearchParamsProvider>
        <Routes>
          <Route path="/data-explorer/:studyId" element={<TestChild />} />
          <Route path="/data-explorer" element={<TestListView />} />
        </Routes>
      </SearchParamsProvider>
    </TestRouter>
  </MockedProvider>
);

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "accessibility-test-id",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [
              { name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" },
              { name: "mock-type-01", count: 9, IDPropName: "mock-id-prop" },
              { name: "mock-type-03", count: 3, IDPropName: "mock-id-prop" },
            ],
          },
        },
      },
    };

    const { container, getByTestId } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/accessibility-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(getByTestId("study-view-container")).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "crash-test-id",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [
              { name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" },
              { name: "mock-type-01", count: 9, IDPropName: "mock-id-prop" },
              { name: "mock-type-03", count: 3, IDPropName: "mock-id-prop" },
            ],
          },
        },
      },
    };

    expect(() =>
      render(
        <TestParent
          mocks={[getNodeTypesMock, getStudyMock]}
          initialEntries={["/data-explorer/crash-test-id?dataCommonsDisplayName=mock-dc"]}
        />
      )
    ).not.toThrow();
  });

  it("should render a loader while study data is being fetched", async () => {
    vi.useFakeTimers();

    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: null, // data will never resolve
        },
      },
      delay: 10_000,
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: null, // data will never resolve
        },
      },
      delay: 1_000, // shorter delay for node types
    };

    const { getByTestId } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/loading-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    expect(getByTestId("study-view-loader")).toBeInTheDocument(); // Loading all data

    vi.advanceTimersByTime(2_000); // Fast-forward time to simulate loading

    await waitFor(() => {
      expect(getByTestId("study-view-loader")).toBeInTheDocument(); // Still loading study data
    });

    vi.useRealTimers();
  });

  it("should render a loader while node types are being fetched", async () => {
    vi.useFakeTimers();

    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: null, // data will never resolve
        },
      },
      delay: 1_000, // shorter delay for study data
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: null, // data will never resolve
        },
      },
      delay: 10_000,
    };

    const { getByTestId } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/loading-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    expect(getByTestId("study-view-loader")).toBeInTheDocument(); // Loading all data

    vi.advanceTimersByTime(2_000); // Fast-forward time to simulate loading

    await waitFor(() => {
      expect(getByTestId("study-view-loader")).toBeInTheDocument(); // Still loading study data
    });

    vi.useRealTimers();
  });

  it("should redirect to the list view page if an error occurs while fetching study data (API Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: null, // API Issue
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [{ name: "mock-type-01", count: 10, IDPropName: "mock-id-prop" }],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/loading-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it("should redirect to the list view page if an error occurs while fetching study data (Network Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      error: new Error("mock network error"),
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [{ name: "mock-type-01", count: 10, IDPropName: "mock-id-prop" }],
          },
        },
      },
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/loading-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it("should redirect to the list view page if an error occurs while fetching study data (GraphQL Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      error: new Error("mock network error"),
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("some graphql error")],
      },
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/loading-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it("should redirect to the list view page if an error occurs while fetching node types (API Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "node-types-error-test-id",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: null, // API Issue
        },
      },
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/node-types-error-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it("should redirect to the list view page if an error occurs while fetching node types (Network Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "node-types-network-error-test-id",
          },
        },
      },
    };

    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      error: new Error("mock network error"),
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={[
          "/data-explorer/node-types-network-error-test-id?dataCommonsDisplayName=mock-dc",
        ]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it("should redirect to the list view page if an error occurs while fetching node types (GraphQL Error)", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "node-types-graphql-error-test-id",
          },
        },
      },
    };

    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("some graphql error")],
      },
    };

    const { getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={[
          "/data-explorer/node-types-graphql-error-test-id?dataCommonsDisplayName=mock-dc",
        ]}
      />
    );

    await waitFor(() => {
      expect(
        getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
      ).toBeInTheDocument();
    });
  });

  it.each<string>([
    // EMPTY DC
    "/data-explorer/node-types-invalid-data-commons-test-id?dataCommonsDisplayName=",
    // UNDEFINED DC
    "/data-explorer/node-types-invalid-data-commons-test-id",
  ])(
    "should redirect to the list view page if an invalid dataCommonsDisplayName is provided",
    async (entry) => {
      const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
        request: {
          query: GET_APPROVED_STUDY,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getApprovedStudy: {
              ...basePartialStudy,
              _id: "node-types-invalid-data-commons-test-id",
            },
          },
        },
      };

      const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> =
        {
          request: {
            query: GET_RELEASED_NODE_TYPES,
          },
          variableMatcher: () => true,
          result: {
            data: {
              getReleaseNodeTypes: {
                nodes: [
                  {
                    name: "this does not matter",
                    count: 0,
                    IDPropName: "mock-id-prop",
                  },
                ],
              },
            },
          },
        };

      const { getByText } = render(
        <TestParent mocks={[getStudyMock, getNodeTypesMock]} initialEntries={[entry]} />
      );

      await waitFor(() => {
        expect(
          getByText(/Oops! Unable to display metadata for the selected study or data commons./i)
        ).toBeInTheDocument();
      });
    }
  );
});

describe("Implementation Requirements", () => {
  it("should set the page header title to 'Data Explorer for Study - {abbreviation}'", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "header-test-id",
            studyAbbreviation: "mock-abbreviation",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [{ name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" }],
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/header-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(getByTestId("study-view-container")).toBeInTheDocument();
    });

    expect(getByTestId("page-container-header-title")).toHaveTextContent(
      "Data Explorer for Study - mock-abbreviation"
    );
  });

  it("should have the window title 'Data Explorer - {ID}'", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "header-test-id",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [{ name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" }],
          },
        },
      },
    };

    const { getByTestId } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/header-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(getByTestId("study-view-container")).toBeInTheDocument();
    });

    expect(document.title).toBe("Data Explorer - header-test-id");
  });

  it("should have a relevant page description", async () => {
    const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
      request: {
        query: GET_APPROVED_STUDY,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getApprovedStudy: {
            ...basePartialStudy,
            _id: "description-test-id",
          },
        },
      },
    };
    const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> = {
      request: {
        query: GET_RELEASED_NODE_TYPES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getReleaseNodeTypes: {
            nodes: [{ name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" }],
          },
        },
      },
    };

    const { getByTestId, getByText } = render(
      <TestParent
        mocks={[getStudyMock, getNodeTypesMock]}
        initialEntries={["/data-explorer/header-test-id?dataCommonsDisplayName=mock-dc"]}
      />
    );

    await waitFor(() => {
      expect(getByTestId("study-view-container")).toBeInTheDocument();
    });

    expect(
      getByText(
        /Select a node type to view metadata associated with the selected study. The table below displays all available metadata for the chosen node type./
      )
    ).toBeVisible();
  });

  it.each(["", null])(
    "should fallback to the Study Name if the Study Abbreviation is not available",
    async (abbreviation) => {
      const getStudyMock: MockedResponse<GetApprovedStudyResp<true>, GetApprovedStudyInput> = {
        request: {
          query: GET_APPROVED_STUDY,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getApprovedStudy: {
              ...basePartialStudy,
              _id: "header-test-id",
              studyName: "a-valid-fallback-name",
              studyAbbreviation: abbreviation,
            },
          },
        },
      };
      const getNodeTypesMock: MockedResponse<GetReleasedNodeTypesResp, GetReleasedNodeTypesInput> =
        {
          request: {
            query: GET_RELEASED_NODE_TYPES,
          },
          variableMatcher: () => true,
          result: {
            data: {
              getReleaseNodeTypes: {
                nodes: [{ name: "mock-type-02", count: 5, IDPropName: "mock-id-prop" }],
              },
            },
          },
        };

      const { getByTestId } = render(
        <TestParent
          mocks={[getStudyMock, getNodeTypesMock]}
          initialEntries={["/data-explorer/header-test-id?dataCommonsDisplayName=mock-dc"]}
        />
      );

      await waitFor(() => {
        expect(getByTestId("study-view-container")).toBeInTheDocument();
      });

      expect(getByTestId("page-container-header-title")).toHaveTextContent(
        "Data Explorer for Study - a-valid-fallback-name"
      );
    }
  );

  it.todo("should sort by the Key Property column by default");
});
