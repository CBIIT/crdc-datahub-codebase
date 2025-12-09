import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import {
  GET_SUBMISSION_NODES,
  GetSubmissionNodesInput,
  GetSubmissionNodesResp,
} from "../../graphql";
import { render, fireEvent, waitFor } from "../../test-utils";

import { ExportNodeDataButton } from "./ExportNodeDataButton";

type ParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ mocks, children }: ParentProps) => (
  <MockedProvider mocks={mocks} showWarnings>
    {children}
  </MockedProvider>
);

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

describe("Accessibility", () => {
  it("should not have accessibility violations", async () => {
    const { container, getByTestId } = render(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "example-sub-id", name: "test-accessibility" }}
          nodeType={null}
        />
      </TestParent>
    );

    expect(getByTestId("export-node-data-button")).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "example-sub-id", name: "test-accessibility" }}
          nodeType={null}
          disabled
        />
      </TestParent>
    );

    expect(getByTestId("export-node-data-button")).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should only execute the GET_SUBMISSION_NODES query onClick", async () => {
    const submissionID = "example-execute-test-sub-id";
    const nodeType = "participant";

    let called = false;
    const mocks: MockedResponse<GetSubmissionNodesResp>[] = [
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: () => {
          called = true;

          return {
            data: {
              getSubmissionNodes: {
                total: 1,
                IDPropName: null,
                properties: [],
                nodes: [{ nodeType, nodeID: "example-node-id", props: "", status: null }],
              },
            },
          };
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "test-onclick" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    expect(called).toBe(false);

    // NOTE: This must be separate from the expect below to ensure its not called multiple times
    userEvent.click(getByTestId("export-node-data-button"));
    await waitFor(() => {
      expect(called).toBe(true);
    });
  });

  it("should handle network errors when fetching the QC Results without crashing", async () => {
    const submissionID = "random-010101-sub-id";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        error: new Error("Simulated network error"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "network-error-test" }}
          nodeType="abc"
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There is no data to export for the selected node.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle GraphQL errors when fetching the QC Results without crashing", async () => {
    const submissionID = "example-GraphQL-level-errors-id";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
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

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "graphql-error-test" }}
          nodeType="abc"
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There is no data to export for the selected node.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should alert the user if there is no Node Data to export", async () => {
    const submissionID = "example-no-results-to-export-id";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
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
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "no-nodes-test" }}
          nodeType="sample"
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "There is no data to export for the selected node.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should handle invalid datasets without crashing", async () => {
    const submissionID = "example-dataset-level-errors-id";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: () => true,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "x",
              properties: ["some prop"],
              nodes: [
                {
                  nodeType: ["aaaa"] as unknown as string,
                  nodeID: 123 as unknown as string,
                  status: null,
                  props: "this is not JSON",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "invalid-data" }}
          nodeType="aaaa"
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to export TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });
  });
});

describe("Batching Behavior (CRDCDH-3374)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should fetch metadata with first: 1 parameter initially", async () => {
    const submissionID = "batch-metadata-test-id";
    const nodeType = "participant";
    let metadataCallMade = false;

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => {
          if (vars.first === 1 && vars.offset === 0) {
            metadataCallMade = true;
            return true;
          }
          return false;
        },
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "id",
              properties: ["id", "name"],
              nodes: [
                {
                  nodeType,
                  nodeID: "node-1",
                  props: JSON.stringify({ id: 1, name: "Test" }),
                  status: "Passed",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "batch-test" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(metadataCallMade).toBe(true);
    });
  });

  it("should use pageSize of 5000 when batching data", async () => {
    const submissionID = "batch-pagesize-test-id";
    const nodeType = "sample";
    const batchCallsMade: number[] = [];

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 1 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 10000,
              IDPropName: "id",
              properties: ["id"],
              nodes: [{ nodeType, nodeID: "node-1", props: '{"id":1}', status: "Passed" }],
            },
          },
        },
      },
      // First batch query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => {
          if (vars.first === 5000 && vars.offset === 0) {
            batchCallsMade.push(0);
            return true;
          }
          return false;
        },
        result: {
          data: {
            getSubmissionNodes: {
              total: 10000,
              IDPropName: "id",
              properties: ["id"],
              nodes: Array.from({ length: 5000 }, (_, i) => ({
                nodeType,
                nodeID: `node-${i}`,
                props: `{"id":${i}}`,
                status: "Passed",
              })),
            },
          },
        },
      },
      // Second batch query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => {
          if (vars.first === 5000 && vars.offset === 5000) {
            batchCallsMade.push(5000);
            return true;
          }
          return false;
        },
        result: {
          data: {
            getSubmissionNodes: {
              total: 10000,
              IDPropName: "id",
              properties: ["id"],
              nodes: Array.from({ length: 5000 }, (_, i) => ({
                nodeType,
                nodeID: `node-${i + 5000}`,
                props: `{"id":${i + 5000}}`,
                status: "Passed",
              })),
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "batch-pagesize" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(
      () => {
        expect(batchCallsMade).toEqual([0, 5000]);
      },
      { timeout: 5000 }
    );

    expect(mockDownloadBlob).toHaveBeenCalled();
  });

  it("should handle multiple batches of data correctly", async () => {
    const submissionID = "multi-batch-test-id";
    const nodeType = "genomic_info";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 1,
        result: {
          data: {
            getSubmissionNodes: {
              total: 7500,
              IDPropName: "sample_id",
              properties: ["sample_id", "data"],
              nodes: [
                {
                  nodeType,
                  nodeID: "node-0",
                  props: '{"sample_id":"S0","data":"test"}',
                  status: "Passed",
                },
              ],
            },
          },
        },
      },
      // First batch (5000 records)
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 7500,
              IDPropName: "sample_id",
              properties: ["sample_id", "data"],
              nodes: Array.from({ length: 5000 }, (_, i) => ({
                nodeType,
                nodeID: `node-${i}`,
                props: `{"sample_id":"S${i}","data":"batch1"}`,
                status: "Passed",
              })),
            },
          },
        },
      },
      // Second batch (2500 records)
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 5000,
        result: {
          data: {
            getSubmissionNodes: {
              total: 7500,
              IDPropName: "sample_id",
              properties: ["sample_id", "data"],
              nodes: Array.from({ length: 2500 }, (_, i) => ({
                nodeType,
                nodeID: `node-${i + 5000}`,
                props: `{"sample_id":"S${i + 5000}","data":"batch2"}`,
                status: "Passed",
              })),
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "multi-batch" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(
      () => {
        expect(mockDownloadBlob).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Verify the downloaded data contains all records
    const downloadedContent = mockDownloadBlob.mock.calls[0][0];
    expect(downloadedContent).toContain("S0");
    expect(downloadedContent).toContain("S4999");
    expect(downloadedContent).toContain("S5000");
    expect(downloadedContent).toContain("S7499");
  });

  it("should handle errors during batch fetching gracefully", async () => {
    const submissionID = "batch-error-test-id";
    const nodeType = "participant";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query succeeds
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 1,
        result: {
          data: {
            getSubmissionNodes: {
              total: 10000,
              IDPropName: "id",
              properties: ["id"],
              nodes: [{ nodeType, nodeID: "node-1", props: '{"id":1}', status: "Passed" }],
            },
          },
        },
      },
      // First batch succeeds
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 10000,
              IDPropName: "id",
              properties: ["id"],
              nodes: Array.from({ length: 5000 }, (_, i) => ({
                nodeType,
                nodeID: `node-${i}`,
                props: `{"id":${i}}`,
                status: "Passed",
              })),
            },
          },
        },
      },
      // Second batch fails
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 5000,
        error: new Error("Network error during batch fetch"),
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "batch-error" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to export TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });

    // Should not have called downloadBlob
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it("should aggregate all batched data before generating TSV", async () => {
    const submissionID = "batch-aggregate-test-id";
    const nodeType = "sample";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 1,
        result: {
          data: {
            getSubmissionNodes: {
              total: 6,
              IDPropName: "id",
              properties: ["id", "value"],
              nodes: [
                { nodeType, nodeID: "node-1", props: '{"id":"A","value":"1"}', status: "Passed" },
              ],
            },
          },
        },
      },
      // First batch (5 records)
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 6,
              IDPropName: "id",
              properties: ["id", "value"],
              nodes: [
                { nodeType, nodeID: "node-1", props: '{"id":"A","value":"1"}', status: "Passed" },
                { nodeType, nodeID: "node-2", props: '{"id":"B","value":"2"}', status: "Passed" },
                { nodeType, nodeID: "node-3", props: '{"id":"C","value":"3"}', status: "Error" },
                { nodeType, nodeID: "node-4", props: '{"id":"D","value":"4"}', status: "Passed" },
                { nodeType, nodeID: "node-5", props: '{"id":"E","value":"5"}', status: "Passed" },
              ],
            },
          },
        },
      },
      // Second batch (1 record)
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 5000,
        result: {
          data: {
            getSubmissionNodes: {
              total: 6,
              IDPropName: "id",
              properties: ["id", "value"],
              nodes: [
                {
                  nodeType,
                  nodeID: "node-6",
                  props: '{"id":"F","value":"6"}',
                  status: "Warning",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: submissionID, name: "batch-aggregate" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    fireEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    const downloadedContent = mockDownloadBlob.mock.calls[0][0];

    // Verify all 6 records are in the final TSV
    expect(downloadedContent).toContain("A\t1\tPassed");
    expect(downloadedContent).toContain("B\t2\tPassed");
    expect(downloadedContent).toContain("C\t3\tError");
    expect(downloadedContent).toContain("D\t4\tPassed");
    expect(downloadedContent).toContain("E\t5\tPassed");
    expect(downloadedContent).toContain("F\t6\tWarning");
  });
});

describe("Implementation Requirements", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have a tooltip present on the button for Metadata", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "example-tooltip-id", name: "test-tooltip" }}
          nodeType="sample"
        />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-node-data-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export submitted metadata for selected node type");
  });

  it("should have a tooltip present on the button for Data Files", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "data-file-tooltip-id", name: "test-tooltip" }}
          nodeType="Data File"
        />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-node-data-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Export a list of all uploaded data files");
  });

  it("should change the tooltip when the nodeType prop changes", async () => {
    const { getByTestId, findByRole, rerender } = render(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "example-tooltip-id", name: "test-tooltip" }}
          nodeType="sample"
        />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-node-data-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Export submitted metadata for selected node type");

    rerender(
      <TestParent mocks={[]}>
        <ExportNodeDataButton
          submission={{ _id: "example-tooltip-id", name: "test-tooltip" }}
          nodeType="Data File"
        />
      </TestParent>
    );

    userEvent.hover(getByTestId("export-node-data-button"));

    expect(tooltip).toHaveTextContent("Export a list of all uploaded data files");
  });

  it.each<{ name: string; nodeType: string; date: Date; expected: string }>([
    {
      name: "Brain",
      nodeType: "participant",
      date: new Date("2024-05-25T15:20:01Z"),
      expected: "Brain_participant_202405251520.tsv",
    },
    {
      name: "long name".repeat(100),
      nodeType: "sample",
      date: new Date("2007-11-13T13:01:01Z"),
      expected: `${"long-name".repeat(100)}_sample_200711131301.tsv`,
    },
    {
      name: "",
      nodeType: "genomic_info",
      date: new Date("2019-01-13T01:12:00Z"),
      expected: "_genomic_info_201901130112.tsv",
    },
    {
      name: "non $alpha name $@!819",
      nodeType: "sample",
      date: new Date("2015-02-27T23:23:19Z"),
      expected: "non-alpha-name-819_sample_201502272323.tsv",
    },
    {
      name: "  ",
      nodeType: "sample",
      date: new Date("2018-01-01T01:01:01Z"),
      expected: "_sample_201801010101.tsv",
    },
    {
      name: "_-'a-b+c=d",
      nodeType: "sample",
      date: new Date("2031-07-04T18:22:15Z"),
      expected: "-a-bcd_sample_203107041822.tsv",
    },
    {
      name: "CRDCDH-1234",
      nodeType: "sample",
      date: new Date("2023-05-22T07:02:01Z"),
      expected: "CRDCDH-1234_sample_202305220702.tsv",
    },
    {
      name: "SPACE-AT-END ",
      nodeType: "sample",
      date: new Date("1999-03-13T04:04:03Z"),
      expected: "SPACE-AT-END_sample_199903130404.tsv",
    },
  ])(
    "should safely create the TSV filename using Submission Name, Node Type, and Exported Date",
    async ({ name, nodeType, date, expected }) => {
      vi.useFakeTimers().setSystemTime(date);

      const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
        // Initial metadata query with first: 1
        {
          request: {
            query: GET_SUBMISSION_NODES,
          },
          variableMatcher: (vars) => vars.first === 1 && vars.offset === 0,
          result: {
            data: {
              getSubmissionNodes: {
                total: 1,
                IDPropName: "a",
                properties: ["a"],
                nodes: [
                  {
                    nodeType,
                    nodeID: "example-node-id",
                    props: JSON.stringify({ a: 1 }),
                    status: null,
                  },
                ],
              },
            },
          },
        },
        // Batch query with first: 5000
        {
          request: {
            query: GET_SUBMISSION_NODES,
          },
          variableMatcher: (vars) => vars.first === 5000 && vars.offset === 0,
          result: {
            data: {
              getSubmissionNodes: {
                total: 1,
                IDPropName: "a",
                properties: ["a"],
                nodes: [
                  {
                    nodeType,
                    nodeID: "example-node-id",
                    props: JSON.stringify({ a: 1 }),
                    status: null,
                  },
                ],
              },
            },
          },
        },
      ];

      const { getByTestId } = render(
        <TestParent mocks={mocks}>
          <ExportNodeDataButton
            submission={{ _id: "test-export-filename", name }}
            nodeType={nodeType}
          />
        </TestParent>
      );

      fireEvent.click(getByTestId("export-node-data-button"));

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

  it("should include the `type` column in the TSV export", async () => {
    const nodeType = "a_unique_node_type";

    const metadataMatcher = vi.fn().mockReturnValue(true);
    const batchMatcher = vi.fn().mockReturnValue(true);

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: metadataMatcher,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "a",
              properties: ["a"],
              nodes: [
                {
                  nodeType,
                  nodeID: "example-node-id",
                  props: JSON.stringify({ a: 1 }),
                  status: "Passed",
                },
              ],
            },
          },
        },
      },
      // Batch query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: batchMatcher,
        result: {
          data: {
            getSubmissionNodes: {
              total: 1,
              IDPropName: "a",
              properties: ["a"],
              nodes: [
                {
                  nodeType,
                  nodeID: "example-node-id",
                  props: JSON.stringify({ a: 1 }),
                  status: "Passed",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: "mock-type-test", name: "test-type-column" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    expect(mockDownloadBlob.mock.calls[0][0]).toContain(
      `type\ta\tstatus\r\n${nodeType}\t1\tPassed`
    );
  });

  // NOTE: This tests a scenario where the first row does not contain all possible properties
  // but other rows do. This ensures that the export includes all properties across all nodes.
  it("should include every property in the TSV export", async () => {
    const nodeType = "a_prop_with_varying_data";

    const mocks: MockedResponse<GetSubmissionNodesResp, GetSubmissionNodesInput>[] = [
      // Initial metadata query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 1 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 2,
              IDPropName: "dev.property",
              properties: ["dev.property", "another.property", "abc123", "pdx.pdx_id"],
              nodes: [
                // This only has 2 of the 4 props
                {
                  nodeType,
                  nodeID: "example-node-id",
                  props: JSON.stringify({ "dev.property": "yes", abc123: 5 }),
                  status: "Passed",
                },
              ],
            },
          },
        },
      },
      // Batch query
      {
        request: {
          query: GET_SUBMISSION_NODES,
        },
        variableMatcher: (vars) => vars.first === 5000 && vars.offset === 0,
        result: {
          data: {
            getSubmissionNodes: {
              total: 2,
              IDPropName: "dev.property",
              properties: ["dev.property", "another.property", "abc123", "pdx.pdx_id"],
              nodes: [
                // This only has 2 of the 4 props
                {
                  nodeType,
                  nodeID: "example-node-id",
                  props: JSON.stringify({ "dev.property": "yes", abc123: 5 }),
                  status: "Passed",
                },
                // This has all props
                {
                  nodeType,
                  nodeID: "another-example",
                  props: JSON.stringify({
                    "dev.property": "no",
                    "another.property": "here",
                    abc123: 10,
                    "pdx.pdx_id": "PD1234",
                  }),
                  status: "Error",
                },
              ],
            },
          },
        },
      },
    ];

    const { getByTestId } = render(
      <TestParent mocks={mocks}>
        <ExportNodeDataButton
          submission={{ _id: "mock-type-test", name: "test-type-column" }}
          nodeType={nodeType}
        />
      </TestParent>
    );

    userEvent.click(getByTestId("export-node-data-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalled();
    });

    expect(mockDownloadBlob.mock.calls[0][0]).toContain(
      // HEADER ROW
      `type\tdev.property\tanother.property\tabc123\tpdx.pdx_id\tstatus\r\n` +
        // FIRST DATA ROW
        `a_prop_with_varying_data\tyes\t\t5\t\tPassed\r\n` +
        // SECOND DATA ROW
        `a_prop_with_varying_data\tno\there\t10\tPD1234\tError`
    );
  });
});
