import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { axe } from "vitest-axe";

import {
  DOWNLOAD_ALL_RELEASED_NODES,
  DownloadAllReleasedNodesResp,
  DownloadAllReleaseNodesInput,
  LIST_RELEASED_DATA_RECORDS,
  ListReleasedDataRecordsInput,
  ListReleasedDataRecordsResponse,
} from "../../graphql";
import { render, waitFor } from "../../test-utils";

import DataExplorerStudyExport, { DataExplorerStudyExportProps } from "./index";

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

type MockParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const MockParent: React.FC<MockParentProps> = ({ mocks = [], children }) => (
  <MockedProvider mocks={mocks} addTypename={false}>
    {children}
  </MockedProvider>
);

const BaseProps: DataExplorerStudyExportProps = {
  studyId: "mock-study-id",
  studyDisplayName: "Mock Study",
  nodeType: "participant",
  dataCommonsDisplayName: "MOCK-DC",
  columns: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container, getByTestId } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: MockParent,
    });

    expect(getByTestId("export-study-metadata-toggle")).toBeEnabled(); // Sanity check

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when open", async () => {
    const { container, getByTestId } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: MockParent,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    expect(getByTestId("export-study-metadata-popper")).toBeVisible(); // Sanity check

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations when disabled", async () => {
    const { container, getByTestId } = render(<DataExplorerStudyExport {...BaseProps} disabled />, {
      wrapper: MockParent,
    });

    expect(getByTestId("export-study-metadata-toggle")).toBeDisabled(); // Sanity check

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() =>
      render(<DataExplorerStudyExport {...BaseProps} />, { wrapper: MockParent })
    ).not.toThrow();
  });

  it("should notify the user when starting the download (Selected Metadata)", async () => {
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listReleasedDataRecords: null, // This never resolves anyway
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Downloading the requested metadata file. This may take a moment...",
        {
          variant: "default",
        }
      );
    });
  });

  it("should notify the user when starting the download (All Metadata)", async () => {
    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadAllReleasedNodes: null, // This never resolves anyway
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Downloading the requested metadata file. This may take a moment...",
        {
          variant: "default",
        }
      );
    });
  });

  it("should gracefully handle API errors (GraphQL) (Selected Metadata)", async () => {
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Mock error")],
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to generate the TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });

    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it("should gracefully handle API errors (GraphQL) (All Metadata)", async () => {
    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("Mock error")],
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Mock error", {
        variant: "error",
      });
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });
  });

  it("should gracefully handle API errors (Network) (Selected Metadata)", async () => {
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to generate the TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });

    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it("should gracefully handle API errors (Network) (All Metadata)", async () => {
    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith("Network error", {
        variant: "error",
      });
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });
  });

  it("should gracefully handle API errors (API) (Selected Metadata)", async () => {
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listReleasedDataRecords: null,
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to generate the TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });

    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it("should gracefully handle API errors (API) (All Metadata)", async () => {
    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadAllReleasedNodes: null,
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! The API did not return a download link.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should gracefully handle API errors (Empty response)", async () => {
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listReleasedDataRecords: {
            total: 0,
            nodes: [],
          },
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Failed to generate the TSV for the selected node.",
        {
          variant: "error",
        }
      );
    });

    await waitFor(() => {
      expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
    });

    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it("should group the API requests when there are more than 5000 records", async () => {
    const PAGE_SIZE = 5000; // Change this if the page size in the component changes

    const matcher1 = vi.fn().mockReturnValue(true);
    const matcher2 = vi.fn().mockReturnValue(true);
    const matcher3 = vi.fn().mockReturnValue(true);
    const mocks: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput>[] = [
      {
        request: {
          query: LIST_RELEASED_DATA_RECORDS,
        },
        variableMatcher: matcher1,
        result: {
          data: {
            listReleasedDataRecords: {
              total: 14999,
              nodes: Array.from({ length: PAGE_SIZE }, (_, i) => ({
                "some.property": `value-${i + 1}`,
              })),
            },
          },
        },
      },
      {
        request: {
          query: LIST_RELEASED_DATA_RECORDS,
        },
        variableMatcher: matcher2,
        result: {
          data: {
            listReleasedDataRecords: {
              total: 14999,
              nodes: Array.from({ length: PAGE_SIZE }, (_, i) => ({
                "some.property": `value-${i + PAGE_SIZE + 1}`,
              })),
            },
          },
        },
      },
      {
        request: {
          query: LIST_RELEASED_DATA_RECORDS,
        },
        variableMatcher: matcher3,
        result: {
          data: {
            listReleasedDataRecords: {
              total: 14999,
              nodes: Array.from({ length: PAGE_SIZE - 1 }, (_, i) => ({
                "some.property": `value-${i + PAGE_SIZE * 2 + 1}`,
              })),
            },
          },
        },
      },
    ];

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={mocks}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledOnce();
    });

    expect(matcher1).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 5000,
        offset: 0,
      })
    );
    expect(matcher2).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 5000,
        offset: 5000,
      })
    );
    expect(matcher3).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 5000,
        offset: 10000,
      })
    );
  });

  it("should be disabled when `disabled` prop is true", () => {
    const { rerender, getByTestId } = render(<DataExplorerStudyExport {...BaseProps} disabled />, {
      wrapper: MockParent,
    });

    expect(getByTestId("export-study-metadata-toggle")).toBeDisabled();

    rerender(
      <MockParent>
        <DataExplorerStudyExport {...BaseProps} disabled={false} />
      </MockParent>
    );

    expect(getByTestId("export-study-metadata-toggle")).toBeEnabled();
  });

  it("should be disabled when downloading the data (Selected Metadata)", async () => {
    vi.useFakeTimers();

    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: () => true,
      result: {
        data: {
          listReleasedDataRecords: null, // This never resolves anyway
        },
      },
      delay: 1000,
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    userEvent.click(getByTestId("export-study-metadata-toggle")); // Reopen the popper

    await waitFor(() => {
      expect(getByText("Download selected metadata")).toHaveAttribute("aria-disabled");
      expect(getByText("Download full study metadata")).toHaveAttribute("aria-disabled");
    });

    vi.useRealTimers();
  });

  it("should be disabled when downloading the data (All Metadata)", async () => {
    vi.useFakeTimers();

    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadAllReleasedNodes: null, // This never resolves anyway
        },
      },
      delay: 1000,
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    userEvent.click(getByTestId("export-study-metadata-toggle")); // Reopen the popper

    await waitFor(() => {
      expect(getByText("Download selected metadata")).toHaveAttribute("aria-disabled");
      expect(getByText("Download full study metadata")).toHaveAttribute("aria-disabled");
    });

    vi.useRealTimers();
  });

  it("should close the menu when pressing the close button", async () => {
    const { getByTestId, getByText, queryByText } = render(
      <DataExplorerStudyExport {...BaseProps} />,
      {
        wrapper: ({ children }) => <MockParent mocks={[]}>{children}</MockParent>,
      }
    );

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    expect(getByText("Available Downloads")).toBeVisible();

    userEvent.click(getByTestId("menu-popper-close-button"));

    expect(queryByText("Available Downloads")).toBeNull();
  });
});

describe("Implementation Requirements", () => {
  it.each<
    { expected: string; date: Date } & Pick<
      DataExplorerStudyExportProps,
      "studyDisplayName" | "nodeType"
    >
  >([
    {
      date: new Date("2025-05-21T09:30:00z"),
      studyDisplayName: "CMB",
      nodeType: "Participant",
      expected: "CMB_Participant_20250521093000.tsv",
    },
    {
      date: new Date("2023-11-03T14:01:11z"),
      studyDisplayName: "SOME_MOCK_STUDY",
      nodeType: "RANDOM_node_TYPE",
      expected: "SOME_MOCK_STUDY_RANDOM_node_TYPE_20231103140111.tsv",
    },
    {
      date: new Date("2025-06-27T10:50:00z"),
      studyDisplayName: "",
      nodeType: "",
      expected: "__20250627105000.tsv",
    },
    {
      date: new Date("1998-12-30T23:59:59z"),
      studyDisplayName: "GC",
      nodeType: "datafile",
      expected: "GC_datafile_19981230235959.tsv",
    },
    {
      date: new Date("2030-01-01T01:00:00z"),
      studyDisplayName: "$PEC!@L_CHARS-",
      nodeType: "*@(@14938124817318(!)@(3",
      expected: "$PEC!@L_CHARS-_*@(@14938124817318(!)@(3_20300101010000.tsv",
    },
  ])(
    "should correctly name the exported TSV as $expected",
    async ({ expected, studyDisplayName, nodeType, date }) => {
      vi.useFakeTimers().setSystemTime(date);

      const mockColumns: DataExplorerStudyExportProps["columns"] = [
        { label: "id", field: "id", renderValue: () => null },
        { label: "foo", field: "foo", renderValue: () => null },
      ];

      const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
        request: {
          query: LIST_RELEASED_DATA_RECORDS,
        },
        variableMatcher: () => true,
        result: {
          data: {
            listReleasedDataRecords: {
              total: 1,
              nodes: [{ id: "mock-id", foo: "bar" }],
            },
          },
        },
      };

      const { getByTestId, getByText } = render(
        <DataExplorerStudyExport
          {...BaseProps}
          studyDisplayName={studyDisplayName}
          nodeType={nodeType}
          columns={mockColumns}
        />,
        {
          wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
        }
      );

      userEvent.click(getByTestId("export-study-metadata-toggle"));

      userEvent.click(getByText("Download selected metadata"));

      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledOnce();
      });

      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(String),
        expected,
        expect.any(String)
      );

      vi.useRealTimers();
    }
  );

  it("should only export the current visible columns", async () => {
    const mockColumns: DataExplorerStudyExportProps["columns"] = [
      { label: "visible_col01", field: "visible_col01", renderValue: () => null },
      { label: "visible_col02", field: "visible_col02", renderValue: () => null },
    ];

    const mockMatcher = vi.fn().mockReturnValue(true);
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          listReleasedDataRecords: {
            total: 1,
            nodes: [
              {
                "HIDDEN-parent.id": "HIDDEN-mock-parent-id", // HIDDEN
                visible_col01: "value1",
                visible_col02: "value2",
                HIDDEN_col: "HIDDEN-should-not-be-included", // HIDDEN
              },
            ],
          },
        },
      },
    };

    const { getByTestId, getByText } = render(
      <DataExplorerStudyExport {...BaseProps} columns={mockColumns} />,
      {
        wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
      }
    );

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledOnce();
    });

    const downloadContent = mockDownloadBlob.mock.calls[0][0];
    expect(downloadContent).toContain("visible_col01\tvisible_col02");
    expect(downloadContent).toContain("value1\tvalue2");
    expect(downloadContent).not.toContain("HIDDEN-parent.id");
    expect(downloadContent).not.toContain("HIDDEN-should-not-be-included");
  });

  it("should handle columns not present in the data", async () => {
    const mockColumns: DataExplorerStudyExportProps["columns"] = [
      { label: "col1", field: "col1", renderValue: () => null },
      { label: "col2", field: "col2", renderValue: () => null },
    ];

    const mockMatcher = vi.fn().mockReturnValue(true);
    const mock: MockedResponse<ListReleasedDataRecordsResponse, ListReleasedDataRecordsInput> = {
      request: {
        query: LIST_RELEASED_DATA_RECORDS,
      },
      variableMatcher: mockMatcher,
      result: {
        data: {
          listReleasedDataRecords: {
            total: 1,
            nodes: [{ col1: "value1" }], // col2 is missing
          },
        },
      },
    };

    const { getByTestId, getByText } = render(
      <DataExplorerStudyExport {...BaseProps} columns={mockColumns} />,
      {
        wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
      }
    );

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download selected metadata"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledOnce();
    });

    const downloadContent = mockDownloadBlob.mock.calls[0][0].split("\r\n");
    expect(downloadContent[0]).toBe("col1\tcol2");
    expect(downloadContent[1]).toBe("value1\t");
  });

  it("should open the presigned download link returned by the API", async () => {
    vi.spyOn(window, "open").mockImplementation(() => null);

    const mock: MockedResponse<DownloadAllReleasedNodesResp, DownloadAllReleaseNodesInput> = {
      request: {
        query: DOWNLOAD_ALL_RELEASED_NODES,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadAllReleasedNodes: "https://localhost:4010/presigned-url-here",
        },
      },
    };

    const { getByTestId, getByText } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: ({ children }) => <MockParent mocks={[mock]}>{children}</MockParent>,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    userEvent.click(getByText("Download full study metadata"));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        "https://localhost:4010/presigned-url-here",
        expect.anything(),
        expect.anything()
      );
    });
  });
});

describe("Snapshots", () => {
  it("should match snapshot when enabled", () => {
    const { container } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: MockParent,
    });

    expect(container).toMatchSnapshot();
  });

  it("should match snapshot when disabled", () => {
    const { container } = render(<DataExplorerStudyExport {...BaseProps} disabled />, {
      wrapper: MockParent,
    });

    expect(container).toMatchSnapshot();
  });

  it("should match snapshot when open", async () => {
    const { container, getByTestId } = render(<DataExplorerStudyExport {...BaseProps} />, {
      wrapper: MockParent,
    });

    userEvent.click(getByTestId("export-study-metadata-toggle"));

    expect(container).toMatchSnapshot();
  });
});
