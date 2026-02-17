import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { batchFactory } from "@/factories/submission/BatchFactory";
import { batchFileInfoFactory } from "@/factories/submission/BatchFileInfoFactory";

import {
  DownloadMetadataFileResp,
  DownloadMetadataFileInput,
  DOWNLOAD_METADATA_FILE,
} from "../../graphql";
import { TestRouter, render, waitFor, within } from "../../test-utils";
import { SearchParamsProvider } from "../Contexts/SearchParamsContext";

import Dialog from "./index";

type ParentProps = {
  mocks?: MockedResponse[];
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ mocks = [], children }) => (
  <TestRouter basename="">
    <MockedProvider mocks={mocks}>
      <SearchParamsProvider>{children}</SearchParamsProvider>
    </MockedProvider>
  </TestRouter>
);

describe("Accessibility", () => {
  it("should have no violations (no files)", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table")).toBeVisible();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (with files)", async () => {
    const { container, getByTestId } = render(
      <TestParent>
        <Dialog
          open
          batch={batchFactory.build({
            fileCount: 3,
            files: [
              batchFileInfoFactory.build({ fileName: "file1" }),
              batchFileInfoFactory.build({ fileName: "file2" }),
              batchFileInfoFactory.build({ fileName: "file3" }),
            ],
          })}
        />
      </TestParent>
    );

    await waitFor(() => {
      expect(getByTestId("generic-table")).toBeVisible();
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} />
      </TestParent>
    );

    expect(getByTestId("file-list-dialog")).toBeVisible();
  });

  it("should close the dialog when the 'Close' button is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("file-list-close-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("file-list-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("file-list-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should handle the 'onClose' prop being undefined", async () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build()} />
      </TestParent>
    );

    expect(() => userEvent.click(getByTestId("file-list-close-button"))).not.toThrow();
  });

  it("should disable the file download buttons when downloading is in progress", async () => {
    const mock: MockedResponse<DownloadMetadataFileResp, DownloadMetadataFileInput> = {
      request: {
        query: DOWNLOAD_METADATA_FILE,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadMetadataFile: null,
        },
      },
      delay: 3000,
    };

    const batch: Batch = batchFactory.build({
      fileCount: 2,
      files: [
        batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" }),
        batchFileInfoFactory.build({ fileName: "file2", nodeType: "sample" }),
      ],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("generic-table")).toBeVisible();
    });

    vi.useFakeTimers();

    userEvent.click(getByTestId("download-file2-button"));

    expect(getByTestId("download-file2-button")).toBeDisabled();
    expect(getByTestId("download-file1-button")).toBeDisabled();
    expect(getByTestId("download-all-button")).toBeDisabled();

    vi.advanceTimersByTime(3001); // Simulate the delay for the download to complete

    await waitFor(() => {
      expect(getByTestId("download-file2-button")).toBeEnabled();
    });

    expect(getByTestId("download-file1-button")).toBeEnabled();
    expect(getByTestId("download-all-button")).toBeEnabled();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should disable the download all button when there are no files to download", async () => {
    const batch: Batch = batchFactory.build({
      fileCount: 0,
      files: [],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent>{children}</TestParent>,
    });

    expect(getByTestId("download-all-button")).toBeDisabled();
  });

  it.each<BatchStatus>(["Failed", "Uploading", "catch-all" as BatchStatus])(
    "should disable the download all button when the batch is not 'Uploaded'",
    async (status) => {
      const batch: Batch = batchFactory.build({
        status,
        fileCount: 2,
        files: [
          batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" }),
          batchFileInfoFactory.build({ fileName: "file2", nodeType: "sample" }),
        ],
      });

      const { getByTestId } = render(<Dialog open batch={batch} />, {
        wrapper: ({ children }) => <TestParent>{children}</TestParent>,
      });

      expect(getByTestId("download-all-button")).toBeDisabled();
    }
  );

  // NOTE: Currently, the batch can't be uploaded if any file is not uploaded successfully,
  // but this is just future-proofing for any API changes
  it.each<BatchFileInfo["status"]>(["Failed", "New", "catch-all" as BatchFileInfo["status"]])(
    "should disable the individual download button when the status is not 'Uploaded'",
    async (status) => {
      const batch: Batch = batchFactory.build({
        status: "Uploaded",
        fileCount: 1,
        files: [batchFileInfoFactory.build({ status, fileName: "file1", nodeType: "participant" })],
      });

      const { getByLabelText } = render(<Dialog open batch={batch} />, {
        wrapper: ({ children }) => <TestParent>{children}</TestParent>,
      });

      expect(getByLabelText(/Download/i)).toBeDisabled();
    }
  );
});

describe("Implementation Requirements", () => {
  it("should indicate the batch displayID in the dialog title", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build({ displayID: 123 })} />
      </TestParent>
    );

    expect(within(getByTestId("file-list-dialog")).getByText(/batch 123 file list/i)).toBeVisible();
  });

  it("should format the batch createdAt date in the dialog subtitle", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog open batch={batchFactory.build({ createdAt: "2024-06-26T18:11:57.484Z" })} />
      </TestParent>
    );

    expect(
      within(getByTestId("file-list-dialog")).getByText(/Uploaded on 6\/26\/2024 at 06:11 PM/)
    ).toBeVisible();
  });

  it("should display the correct number of files in the dialog", () => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog
          open
          batch={batchFactory.build({
            fileCount: 3,
            files: [
              batchFileInfoFactory.build({ fileName: "file1" }),
              batchFileInfoFactory.build({ fileName: "file2" }),
              batchFileInfoFactory.build({ fileName: "file3" }),
            ],
          })}
        />
      </TestParent>
    );

    expect(within(getByTestId("file-list-dialog")).getByText("3 FILES")).toBeVisible();
  });

  it.each<[number, string]>([
    [0, "0 FILES"],
    [1, "1 FILE"],
    [2, "2 FILES"],
  ])("should use the correct pluralization for the file count", (count, expected) => {
    const { getByTestId } = render(
      <TestParent>
        <Dialog
          open
          batch={batchFactory.build({
            fileCount: count,
            files: batchFileInfoFactory.build(count),
          })}
        />
      </TestParent>
    );

    expect(within(getByTestId("file-list-dialog")).getByText(expected)).toBeVisible();
  });

  it("should render the placeholder text when there are no files (metadata)", () => {
    const { getByText } = render(
      <Dialog open batch={batchFactory.build({ type: "metadata", files: [], fileCount: 0 })} />,
      { wrapper: TestParent }
    );

    expect(getByText(/No files were uploaded./)).toBeInTheDocument();
  });

  it("should render an explanation for successful but empty 'data file' batches", () => {
    const { getByText } = render(
      <Dialog
        open
        batch={batchFactory.build({
          type: "data file",
          status: "Uploaded",
          files: [],
          fileCount: 0,
        })}
      />,
      { wrapper: TestParent }
    );

    expect(
      getByText(
        /All files in this manifest have been previously uploaded. No files were uploaded in this batch./i
      )
    ).toBeInTheDocument();
  });

  it("should render the 'No files uploaded' message for unsuccessful 'data file' batches", () => {
    const { getByText } = render(
      <Dialog
        open
        batch={batchFactory.build({
          type: "data file",
          status: "Failed",
          files: [],
          fileCount: 0,
        })}
      />,
      { wrapper: TestParent }
    );

    expect(getByText(/No files were uploaded./)).toBeInTheDocument();
  });

  it("should show a snackbar when download fails (GraphQL)", async () => {
    const mock: MockedResponse<DownloadMetadataFileResp, DownloadMetadataFileInput> = {
      request: {
        query: DOWNLOAD_METADATA_FILE,
      },
      variableMatcher: () => true,
      result: {
        errors: [new GraphQLError("An error occurred.")],
      },
    };

    const batch: Batch = batchFactory.build({
      fileCount: 1,
      files: [batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" })],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("download-all-button")).toBeEnabled();
    });

    userEvent.click(getByTestId("download-all-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Download Failed: There was an issue with the download.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when download fails (Network)", async () => {
    const mock: MockedResponse<DownloadMetadataFileResp, DownloadMetadataFileInput> = {
      request: {
        query: DOWNLOAD_METADATA_FILE,
      },
      variableMatcher: () => true,
      error: new Error("Network error"),
    };

    const batch: Batch = batchFactory.build({
      fileCount: 1,
      files: [batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" })],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("download-all-button")).toBeEnabled();
    });

    userEvent.click(getByTestId("download-all-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Download Failed: There was an issue with the download.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should show a snackbar when download fails (API)", async () => {
    const mock: MockedResponse<DownloadMetadataFileResp, DownloadMetadataFileInput> = {
      request: {
        query: DOWNLOAD_METADATA_FILE,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadMetadataFile: null, // Some non-expected response indicating failure
        },
      },
    };

    const batch: Batch = batchFactory.build({
      fileCount: 1,
      files: [batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" })],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("download-all-button")).toBeEnabled();
    });

    userEvent.click(getByTestId("download-all-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Download Failed: There was an issue with the download.",
        {
          variant: "error",
        }
      );
    });
  });

  it("should open the presigned URL in a new tab", async () => {
    vi.spyOn(global, "open").mockImplementation(() => null);

    const mock: MockedResponse<DownloadMetadataFileResp, DownloadMetadataFileInput> = {
      request: {
        query: DOWNLOAD_METADATA_FILE,
      },
      variableMatcher: () => true,
      result: {
        data: {
          downloadMetadataFile: "https://example-url-here.com/file.xxz",
        },
      },
    };

    const batch: Batch = batchFactory.build({
      fileCount: 1,
      files: [batchFileInfoFactory.build({ fileName: "file1", nodeType: "participant" })],
    });

    const { getByTestId } = render(<Dialog open batch={batch} />, {
      wrapper: ({ children }) => <TestParent mocks={[mock]}>{children}</TestParent>,
    });

    await waitFor(() => {
      expect(getByTestId("download-all-button")).toBeEnabled();
    });

    userEvent.click(getByTestId("download-all-button"));

    await waitFor(() => {
      expect(global.open).toHaveBeenCalledWith(
        "https://example-url-here.com/file.xxz",
        "_blank",
        "noopener"
      );
      expect(global.open).toHaveBeenCalledTimes(1);
    });
  });

  it.each<UploadType>(["data file", "mock-type" as UploadType])(
    "should not render the download buttons for non-metadata batches",
    (uploadType) => {
      const batch: Batch = batchFactory.build({
        type: uploadType,
        fileCount: 1,
        files: [batchFileInfoFactory.build({ fileName: "datafile.zip", nodeType: "data file" })],
      });

      const { queryByTestId, queryAllByLabelText } = render(
        <TestParent>
          <Dialog open batch={batch} />
        </TestParent>
      );

      expect(queryByTestId("download-all-button")).toBeNull(); // Download all button
      expect(queryAllByLabelText(/Download/i).length).toBe(0); // Individual download buttons
    }
  );
});
