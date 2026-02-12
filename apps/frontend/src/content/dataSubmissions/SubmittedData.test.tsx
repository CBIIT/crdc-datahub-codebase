import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { submissionAttributesFactory } from "@/factories/submission/SubmissionAttributesFactory";
import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { submissionStatisticFactory } from "@/factories/submission/SubmissionStatisticFactory";

import { Context as AuthContext } from "../../components/Contexts/AuthContext";
import { SearchParamsProvider } from "../../components/Contexts/SearchParamsContext";
import {
  SubmissionContext,
  SubmissionCtxState,
  SubmissionCtxStatus,
} from "../../components/Contexts/SubmissionContext";
import {
  GET_SUBMISSION_NODES,
  GetSubmissionNodesInput,
  GetSubmissionNodesResp,
  SUBMISSION_STATS,
  SubmissionStatsInput,
  SubmissionStatsResp,
} from "../../graphql";
import { TestRouter, render, waitFor, within } from "../../test-utils";

import SubmittedData from "./SubmittedData";

type ParentProps = {
  mocks?: MockedResponse[];
  submissionId?: string;
  submissionName?: string;
  submitterID?: string;
  collaborators?: Collaborator[];
  deletingData?: boolean;
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  mocks,
  submissionId,
  submissionName,
  submitterID,
  collaborators = [],
  deletingData = false,
  children,
}: ParentProps) => {
  const value = useMemo<SubmissionCtxState>(
    () =>
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        error: null,
        data: {
          getSubmission: submissionFactory.build({
            _id: submissionId,
            name: submissionName,
            submitterID,
            collaborators,
            deletingData,
          }),
          submissionStats: {
            stats: [],
          },
          getSubmissionAttributes: {
            submissionAttributes: submissionAttributesFactory
              .pick(["hasOrphanError", "isBatchUploading"])
              .build({
                hasOrphanError: false,
                isBatchUploading: false,
              }),
          },
        },
      }),
    [submissionId, submissionName, deletingData]
  );

  return (
    <MockedProvider mocks={mocks} showWarnings>
      <TestRouter basename="">
        <AuthContext.Provider
          value={authCtxStateFactory.build({
            user: userFactory.build({
              _id: "current-user",
              permissions: ["data_submission:create"],
            }),
          })}
        >
          <SubmissionContext.Provider value={value}>
            <SearchParamsProvider>{children}</SearchParamsProvider>
          </SubmissionContext.Provider>
        </AuthContext.Provider>
      </TestRouter>
    </MockedProvider>
  );
};

describe("SubmittedData > General", () => {
  const mockSubmissionQuery: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
    request: {
      query: SUBMISSION_STATS,
    },
    variableMatcher: () => true,
    result: {
      data: {
        submissionStats: {
          stats: [submissionStatisticFactory.build({ nodeName: "example-node", total: 1 })],
        },
      },
    },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not have any high level accessibility violations", async () => {
    const { container } = render(
      <TestParent mocks={[]} submissionId={undefined} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should show an error message when the nodes cannot be fetched (network)", async () => {
    const submissionID = "example-sub-id-1";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve node data.", {
        variant: "error",
      });
    });
  });

  it("should show an error message when the nodes cannot be fetched (GraphQL)", async () => {
    const submissionID = "example-sub-id-2";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          errors: [new GraphQLError("Simulated GraphQL error")],
        },
      },
    ];

    render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Unable to retrieve node data.", {
        variant: "error",
      });
    });
  });

  // NOTE: With inverse selection, "Select All" no longer fetches all nodes.
  // The functionality now uses deleteAll with exclusiveIDs instead of fetching all nodeIDs.
  // These tests for error handling on fetch are no longer applicable.

  it("should toggle all rows to selected when clicking 'Select All' checkbox", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 200,
            IDPropName: "col-xyz",
            properties: ["col-xyz"],
            nodes: Array(20).fill({
              nodeType: "example-node",
              nodeID: "example-node-id",
              props: JSON.stringify({
                "col-xyz": "value-for-column-xyz",
              }),
              status: "New",
            }),
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-select-all-id"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(21);
    });

    // Click 'Select All' - should now check header and all visible rows
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      // Header checkbox should be checked
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      // All row checkboxes should be checked
      getAllByRole("checkbox")
        .slice(1)
        .forEach((checkbox) => {
          expect(checkbox).toBeChecked();
        });
    });
  });

  // NOTE: We handle this separately by simply clearing the data and columns
  // This is to support the deletion functionality, where the user may have selected
  // to delete all rows.
  it("should not show an error message when the selected node has 0 results", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp<false>, GetSubmissionNodesInput> = {
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 0,
            IDPropName: "",
            properties: [],
            nodes: [],
          },
        },
      },
    };

    render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="zero-results-id"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(
      () => {
        expect(global.mockEnqueue).toHaveBeenCalledTimes(0);
      },
      { timeout: 1000 }
    );
  });

  // NOTE: This test was for the old "Select All" behavior that fetched all nodes.
  // With the new inverse selection approach, "Select All" no longer fetches all nodes,
  // so this test is no longer applicable and has been removed.

  it("should show a alert box when a data deletion is ongoing", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 20,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(20).fill({
              nodeType: "example-node",
              nodeID: "example-node-id",
              props: JSON.stringify({
                "col-xyz": "value-for-column-xyz",
              }),
              status: "New",
            }),
          },
        },
      },
    };

    const { getByTestId, rerender } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="sub-delete-alert"
        deletingData
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submitted-data-deletion-alert")).toBeVisible();
    });

    expect(getByTestId("submitted-data-deletion-alert")).toHaveTextContent(
      "All selected nodes are currently being deleted. Please wait..."
    );

    rerender(
      <TestParent mocks={[]} submissionId="sub-delete-alert" deletingData={false}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("submitted-data-deletion-alert")).not.toBeVisible();
    });
  });
});

describe("SubmittedData > Table", () => {
  const mockSubmissionQuery: MockedResponse<SubmissionStatsResp, SubmissionStatsInput> = {
    request: {
      query: SUBMISSION_STATS,
    },
    variableMatcher: () => true,
    result: {
      data: {
        submissionStats: {
          stats: [submissionStatisticFactory.build({ nodeName: "example-node", total: 1 })],
        },
      },
    },
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render the placeholder text when no data is available", async () => {
    const submissionID = "example-placeholder-test-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 0,
              IDPropName: null,
              properties: [],
              nodes: [],
            },
          },
        },
      },
    ];

    const { getByText } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByText("No existing data was found")).toBeInTheDocument();
    });
  });

  it("should render dynamic columns based on the selected node properties", async () => {
    const submissionID = "example-dynamic-columns-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        maxUsageCount: 2, // initial query + orderBy bug
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "col.2",
              properties: ["col.1", "col.2", "col.3"],
              nodes: [
                {
                  nodeType: "example-node",
                  nodeID: "example-node-id",
                  props: JSON.stringify({
                    "col.1": "value-1",
                    "col.2": "value-2",
                    "col.3": "value-3",
                  }),
                  status: "New",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-header-col.1")).toBeInTheDocument();
    });

    expect(getByTestId("generic-table-header-col.2")).toBeInTheDocument();
    expect(getByTestId("generic-table-header-col.3")).toBeInTheDocument();
  });

  it("should arrange columns correctly for 'data file' nodeType", async () => {
    const submissionID = "example-dynamic-columns-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        maxUsageCount: 2, // initial query + orderBy bug
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "File Name",
              properties: ["Orphaned", "File Size", "Uploaded Date/Time", "File Name"],
              nodes: [
                {
                  nodeType: "data file",
                  nodeID: "example-node-id",
                  props: JSON.stringify({
                    Orphaned: "value-1",
                    "File Size": "value-2",
                    "File Name": "value-3",
                    "Uploaded Date/Time": "value-4",
                  }),
                  status: "New",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId, getAllByTestId } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-header-File Name")).toBeInTheDocument();
    });

    const headers = [
      "Select All", // visually hidden
      "File Name",
      "Status",
      "Orphaned",
      "File Size",
      "Uploaded Date/Time",
    ];

    const allHeaders = getAllByTestId(/generic-table-header-/);
    allHeaders.forEach((header, idx) => {
      expect(header).toHaveTextContent(headers[idx]);
    });
  });

  it("should arrange columns correctly for all other nodeTypes", async () => {
    const submissionID = "example-dynamic-columns-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        maxUsageCount: 2, // initial query + orderBy bug
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "col.2",
              properties: ["col.1", "col.2", "col.3"],
              nodes: [
                {
                  nodeType: "example-node",
                  nodeID: "example-node-id",
                  props: JSON.stringify({
                    "col.1": "value-1",
                    "col.2": "value-2",
                    "col.3": "value-3",
                  }),
                  status: "New",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId, getAllByTestId } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-header-col.1")).toBeInTheDocument();
    });

    const headers = [
      "Select All", // visually hidden
      "col.2",
      "Status",
      "col.1",
      "col.3",
    ];

    const allHeaders = getAllByTestId(/generic-table-header-/);
    allHeaders.forEach((header, idx) => {
      expect(header).toHaveTextContent(headers[idx]);
    });
  });

  it("should add the 'Status' column to any node type", async () => {
    const submissionID = "example-status-column-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        maxUsageCount: 2, // initial query + orderBy bug
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 2,
              IDPropName: "col-xyz",
              properties: ["col-xyz"],
              nodes: [
                {
                  nodeType: "example-node",
                  nodeID: "example-node-id",
                  props: JSON.stringify({
                    "col-xyz": "value-1",
                  }),
                  status: "New",
                },
                {
                  nodeType: "example-node",
                  nodeID: "example-node-id2",
                  props: JSON.stringify({
                    "col-xyz": "value-2",
                  }),
                  status: null,
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-header-Status")).toBeInTheDocument();
    });
  });

  it("should append an interactive Checkbox column to the table", async () => {
    const submissionID = "example-checkbox-column-id";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "example-node-id",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: null,
              },
            ],
          },
        },
      },
    };

    const { getByTestId, getByLabelText, getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, mocks]}
        submissionId={submissionID}
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-header-checkbox")).toBeInTheDocument();
    });

    expect(getByLabelText("Select All")).toBeInTheDocument();

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3); // header + 2 rows
    });
  });

  it("should enable the checkboxes when user is a collaborator", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 200,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(20).fill({
              nodeType: "example-node",
              nodeID: "example-node-id",
              props: JSON.stringify({
                "col-xyz": "value-for-column-xyz",
              }),
              status: "New",
            }),
          },
        },
      },
    };

    const { getAllByRole, getAllByTestId, getByTestId } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-select-all-id"
        submissionName={undefined}
        submitterID="some-other-user"
        collaborators={[
          {
            collaboratorID: "current-user",
            collaboratorName: "",
            permission: "Can Edit",
          },
        ]}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      const headerCheckbox = within(getByTestId("header-checkbox")).getByRole("checkbox");
      const rowCheckbox = getAllByTestId("row-checkbox");

      expect(headerCheckbox).toBeEnabled();
      rowCheckbox.forEach((checkbox) =>
        expect(within(checkbox).getByRole("checkbox")).toBeEnabled()
      );

      const checkboxes = getAllByRole("checkbox");
      checkboxes.forEach((checkbox) => expect(checkbox).toBeEnabled());
    });
  });

  // NOTE: With the new inverse selection approach, "Select All" no longer fetches all nodes.
  // Instead, it toggles a selectAllActive flag that is used with deleteAll and exclusiveIDs.
  // This test has been updated to verify the new behavior.
  it("should activate select all mode when the 'Select All' checkbox is clicked", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 200,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(20).fill({
              nodeType: "example-node",
              nodeID: "example-node-id",
              props: JSON.stringify({
                "col-xyz": "value-for-column-xyz",
              }),
              status: "New",
            }),
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-select-all-id"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      // NOTE: Default pagination is 20 rows, if that drops below 20, this test will need to be updated
      expect(getAllByRole("checkbox")).toHaveLength(21); // header + 20 rows
    });

    userEvent.click(getAllByRole("checkbox")[0]); // click 'Select All' checkbox

    // All checkboxes (header + rows) should now be checked without fetching all nodes
    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toBeChecked(); // header should be checked
      // All row checkboxes should be checked (inverse selection mode - no exclusions)
      getAllByRole("checkbox")
        .slice(1)
        .forEach((checkbox) => {
          expect(checkbox).toBeChecked();
        });
    });
  });

  it("should toggle to 'select all' mode when the 'Select All' checkbox is clicked in the 'indeterminate' state", async () => {
    const submissionID = "example-deselect-all-id";

    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "example-node-id",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: null,
              },
            ],
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId={submissionID}
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    // Wait for the table to render
    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    userEvent.click(getAllByRole("checkbox")[1]); // click 1st row

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true");
    });

    userEvent.click(getAllByRole("checkbox")[0]); // click 'Select All' checkbox

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).not.toBeChecked();
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "false");
      // All row checkboxes should be unchecked
      expect(getAllByRole("checkbox")[1]).not.toBeChecked();
      expect(getAllByRole("checkbox")[2]).not.toBeChecked();
    });
  });

  it("should deselect all rows when the 'Select All' checkbox is clicked in the 'checked' state", async () => {
    const submissionID = "example-deselect-all-id";

    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "example-node-id",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: null,
              },
            ],
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId={submissionID}
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    // Wait for the table to render
    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    // Click "Select All" to enter select all mode
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      // All row checkboxes should be checked
      expect(getAllByRole("checkbox")[1]).toBeChecked();
      expect(getAllByRole("checkbox")[2]).toBeChecked();
    });

    // Click "Select All" again to deselect all
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).not.toBeChecked();
      // All row checkboxes should be unchecked
      expect(getAllByRole("checkbox")[1]).not.toBeChecked();
      expect(getAllByRole("checkbox")[2]).not.toBeChecked();
    });
  });

  it("should check the header checkbox when all rows are manually selected", async () => {
    const submissionID = "example-manual-select-all-id";

    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 3,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "example-node-id-1",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id-2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id-3",
                props: JSON.stringify({
                  "col-xyz": "value-3",
                }),
                status: "New",
              },
            ],
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId={submissionID}
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    // Wait for the table to render
    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(4); // header + 3 rows
    });

    // Initially, header should not be checked
    expect(getAllByRole("checkbox")[0]).not.toBeChecked();

    // Manually select first row
    userEvent.click(getAllByRole("checkbox")[1]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[1]).toBeChecked();
      // Header should be indeterminate (partial selection)
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true");
    });

    // Manually select second row
    userEvent.click(getAllByRole("checkbox")[2]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[2]).toBeChecked();
      // Header should still be indeterminate
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true");
    });

    // Manually select third row (all rows now selected)
    userEvent.click(getAllByRole("checkbox")[3]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[3]).toBeChecked();
      // Header should now be checked (all rows manually selected)
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      expect(getAllByRole("checkbox")[0]).not.toHaveAttribute("data-indeterminate", "true");
    });
  });

  // NOTE: With inverse selection, "Select All" never fetches all nodes regardless of count.
  // This test verifies that behavior.
  it("should not fetch all nodes when 'Select All' is clicked (inverse selection)", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 19,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(19).fill({
              nodeType: "example-node",
              nodeID: "example-node-id",
              props: JSON.stringify({
                "col-xyz": "value-for-column-xyz",
              }),
              status: "New",
            }),
          },
        },
      },
    };

    const mockMatcherAllNodes = vi.fn().mockImplementation(() => true);
    const getAllNodesMock: MockedResponse<GetSubmissionNodesResp<true>, GetSubmissionNodesInput> = {
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: mockMatcherAllNodes,
      result: {
        data: {
          getSubmissionNodes: {
            total: 19,
            nodes: Array(200).fill({
              nodeID: "example-node-id",
            }),
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock, getAllNodesMock]}
        submissionId="example-select-all-id"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      // NOTE: Default pagination is 20 rows, if that drops below 20, this test will need to be updated
      expect(getAllByRole("checkbox")).toHaveLength(20); // header + 19 rows
    });

    userEvent.click(getAllByRole("checkbox")[0]);

    // With inverse selection, clicking "Select All" should NOT fetch all nodes
    // Instead, it just toggles the selectAllActive flag
    await waitFor(() => {
      expect(mockMatcherAllNodes).not.toHaveBeenCalled();
      // Header should be checked (select all mode active)
      expect(getAllByRole("checkbox")[0]).toBeChecked();
    });
  });

  it("should deselect all rows when any filter changes", async () => {
    const submissionID = "example-deselect-all-id";

    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 3, // initial query + orderBy bug + filter change
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "example-node-id",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "example-node-id2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: null,
              },
            ],
          },
        },
      },
    };

    const { getAllByRole, getByLabelText } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId={submissionID}
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3); // header + 2 rows
    });

    userEvent.click(getAllByRole("checkbox")[1]); // click 'Select All' checkbox

    await waitFor(() => {
      expect(getAllByRole("checkbox")[1]).toBeChecked();
    });

    userEvent.type(getByLabelText("Submitted ID"), "3 characters minimum");

    await waitFor(
      () => {
        expect(getAllByRole("checkbox")[1]).not.toBeChecked();
      },
      { timeout: 8000 }
    );
  });

  // NOTE: We're asserting that the columns ARE built using getSubmissionNodes.properties
  // instead of the keys of nodes.[x].props JSON object
  it("should NOT build the columns based off of the nodes.[X].props JSON object", async () => {
    const submissionID = "example-using-properties-dynamic-columns-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        maxUsageCount: 2, // initial query + orderBy bug
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 2,
              IDPropName: "good-col-1",
              properties: ["good-col-1", "good-col-2"],
              nodes: [
                {
                  nodeType: "example-node",
                  nodeID: "example-node-id",
                  props: JSON.stringify({
                    "good-col-1": "ok",
                    "good-col-2": "ok",
                    "bad-column": "bad",
                  }),
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId, getByText } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(() => getByTestId("generic-table-header-bad-column")).toThrow();
      expect(() => getByText("bad-column")).toThrow();
    });
  });

  it("should have a default pagination count of 20 rows per page", async () => {
    const submissionID = "example-pagination-default-test-id";

    const mocks: MockedResponse[] = [
      mockSubmissionQuery,
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 0,
              IDPropName: null,
              properties: [],
              nodes: [],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks} submissionId={submissionID} submissionName={undefined}>
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table-rows-per-page-top")).toHaveValue("20");
      expect(getByTestId("generic-table-rows-per-page-bottom")).toHaveValue("20");
    });
  });

  it("should use 'exclusion' mode when selecting all without filters", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 100,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(20)
              .fill(null)
              .map((_, idx) => ({
                nodeType: "example-node",
                nodeID: `example-node-id-${idx}`,
                props: JSON.stringify({
                  "col-xyz": `value-for-column-xyz-${idx}`,
                }),
                status: "New",
              })),
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-exclusion-mode"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(21); // header + 20 rows
    });

    // Click 'Select All' - should use exclusion mode (no filters applied)
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      // Header should be checked (exclusion mode with no exclusions)
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      // All visible row checkboxes should be checked
      getAllByRole("checkbox")
        .slice(1)
        .forEach((checkbox) => {
          expect(checkbox).toBeChecked();
        });
    });
  });

  it("should use 'explicit' mode when selecting all with filters applied", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 3, // initial query + orderBy bug + filter fetch
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: (vars) => !vars.partial,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "node-1",
                props: JSON.stringify({
                  "col-xyz": "value-1",
                }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "node-2",
                props: JSON.stringify({
                  "col-xyz": "value-2",
                }),
                status: "New",
              },
            ],
          },
        },
      },
    };

    const getAllNodesMock: MockedResponse<GetSubmissionNodesResp<true>, GetSubmissionNodesInput> = {
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: (vars) => vars.partial === true && vars.first === -1,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            nodes: [{ nodeID: "node-1" }, { nodeID: "node-2" }],
          },
        },
      },
    };

    const { getAllByRole, getByLabelText } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock, getAllNodesMock]}
        submissionId="example-explicit-mode"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3); // header + 2 rows
    });

    // Apply a filter to trigger explicit mode
    userEvent.type(getByLabelText("Submitted ID"), "test-filter");

    await waitFor(() => {
      expect(getByLabelText("Submitted ID")).toHaveValue("test-filter");
    });

    // Wait for data to load after filter
    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    // Click 'Select All' - should use explicit mode (filters applied)
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      // Header should be checked
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      // All row checkboxes should be checked
      expect(getAllByRole("checkbox")[1]).toBeChecked();
      expect(getAllByRole("checkbox")[2]).toBeChecked();
    });
  });

  it("should transition from 'exclusion' mode to no selection when header is clicked", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 100,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: Array(20)
              .fill(null)
              .map((_, idx) => ({
                nodeType: "example-node",
                nodeID: `example-node-id-${idx}`,
                props: JSON.stringify({
                  "col-xyz": `value-for-column-xyz-${idx}`,
                }),
                status: "New",
              })),
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-exclusion-deselect"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(21);
    });

    // Enter exclusion mode by clicking 'Select All'
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toBeChecked();
    });

    // Click again to deselect all (transition from exclusion to no selection)
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      // All checkboxes should be unchecked
      expect(getAllByRole("checkbox")[0]).not.toBeChecked();
      getAllByRole("checkbox")
        .slice(1)
        .forEach((checkbox) => {
          expect(checkbox).not.toBeChecked();
        });
    });
  });

  it("should maintain exclusion mode when unchecking individual rows", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 100,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "node-1",
                props: JSON.stringify({ "col-xyz": "value-1" }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "node-2",
                props: JSON.stringify({ "col-xyz": "value-2" }),
                status: "New",
              },
            ],
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-exclusion-uncheck"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3); // header + 2 rows
    });

    // Enter exclusion mode by clicking 'Select All'
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      expect(getAllByRole("checkbox")[1]).toBeChecked();
      expect(getAllByRole("checkbox")[2]).toBeChecked();
    });

    // Uncheck one row - should add to exclusion list
    userEvent.click(getAllByRole("checkbox")[1]);

    await waitFor(() => {
      // Header should be indeterminate (partial selection)
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true");
      // First row unchecked, second row still checked
      expect(getAllByRole("checkbox")[1]).not.toBeChecked();
      expect(getAllByRole("checkbox")[2]).toBeChecked();
    });
  });

  it("should transition from 'explicit' mode to no selection when last item is unchecked", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 2, // initial query + orderBy bug
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "node-1",
                props: JSON.stringify({ "col-xyz": "value-1" }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "node-2",
                props: JSON.stringify({ "col-xyz": "value-2" }),
                status: "New",
              },
            ],
          },
        },
      },
    };

    const { getAllByRole } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock]}
        submissionId="example-explicit-deselect"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    // Manually select one row (explicit mode)
    userEvent.click(getAllByRole("checkbox")[1]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[1]).toBeChecked();
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "true");
    });

    // Uncheck the selected row - should transition to no selection
    userEvent.click(getAllByRole("checkbox")[1]);

    await waitFor(() => {
      // All checkboxes should be unchecked
      expect(getAllByRole("checkbox")[0]).not.toBeChecked();
      expect(getAllByRole("checkbox")[0]).toHaveAttribute("data-indeterminate", "false");
      expect(getAllByRole("checkbox")[1]).not.toBeChecked();
    });
  });

  it("should skip fetching when all data is already visible with filters", async () => {
    const getNodesMock: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput> = {
      maxUsageCount: 3, // initial query + orderBy bug + filter fetch
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: (vars) => !vars.partial,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            properties: ["col-xyz"],
            IDPropName: "col-xyz",
            nodes: [
              {
                nodeType: "example-node",
                nodeID: "node-1",
                props: JSON.stringify({ "col-xyz": "value-1" }),
                status: "New",
              },
              {
                nodeType: "example-node",
                nodeID: "node-2",
                props: JSON.stringify({ "col-xyz": "value-2" }),
                status: "New",
              },
            ],
          },
        },
      },
    };

    const mockMatcherAllNodes = vi.fn().mockImplementation((vars) => vars.partial === true);
    const getAllNodesMock: MockedResponse<GetSubmissionNodesResp<true>, GetSubmissionNodesInput> = {
      request: {
        query: GET_SUBMISSION_NODES,
      },
      variableMatcher: mockMatcherAllNodes,
      result: {
        data: {
          getSubmissionNodes: {
            total: 2,
            nodes: [{ nodeID: "node-1" }, { nodeID: "node-2" }],
          },
        },
      },
    };

    const { getAllByRole, getByLabelText } = render(
      <TestParent
        mocks={[mockSubmissionQuery, getNodesMock, getAllNodesMock]}
        submissionId="example-skip-fetch"
        submissionName={undefined}
      >
        <SubmittedData />
      </TestParent>
    );

    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    // Apply a filter
    userEvent.type(getByLabelText("Submitted ID"), "test");

    await waitFor(() => {
      expect(getByLabelText("Submitted ID")).toHaveValue("test");
    });

    // Wait for filtered data
    await waitFor(() => {
      expect(getAllByRole("checkbox")).toHaveLength(3);
    });

    // Click 'Select All' - should NOT fetch because all data is visible (2 rows shown, 2 total)
    userEvent.click(getAllByRole("checkbox")[0]);

    await waitFor(() => {
      expect(getAllByRole("checkbox")[0]).toBeChecked();
      // Should not have called the partial fetch
      expect(mockMatcherAllNodes).not.toHaveBeenCalled();
    });
  });
});
