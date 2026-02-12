import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { TestRouter, fireEvent, render, waitFor, within } from "../../test-utils";

import UploaderConfigDialog from "./index";

type ParentProps = {
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ children }) => (
  <TestRouter basename="">{children}</TestRouter>
);

describe("Accessibility", () => {
  const mockDownload = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should have no violations", async () => {
    const { container } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  const mockDownload = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(getByTestId("uploader-config-dialog")).toBeVisible();
  });

  it("should close the dialog when the 'Close' button is clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-config-dialog-close-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-config-dialog-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-config-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should call the onDownload function when the 'Download' button is clicked with a valid form", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockDownload).not.toHaveBeenCalled();

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledTimes(1);
    });
  });

  it("should clear the form when reopening the dialog", async () => {
    const { rerender, getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    const dataFolderInput = within(
      getByTestId("uploader-config-dialog-input-data-folder")
    ).getByRole("textbox");

    fireEvent.input(dataFolderInput, { target: { value: "test-folder" } });
    await waitFor(() => expect(dataFolderInput).toHaveValue("test-folder"));

    const manifestInput = within(getByTestId("uploader-config-dialog-input-manifest")).getByRole(
      "textbox"
    );

    fireEvent.input(manifestInput, { target: { value: "test-manifest" } });
    await waitFor(() => expect(manifestInput).toHaveValue("test-manifest"));

    const archiveManifestInput = within(
      getByTestId("uploader-config-dialog-input-archive-manifest")
    ).getByRole("textbox");

    fireEvent.input(archiveManifestInput, { target: { value: "test-archive-manifest" } });
    await waitFor(() => expect(archiveManifestInput).toHaveValue("test-archive-manifest"));

    // Simulate closing dialog
    rerender(
      <TestParent>
        <UploaderConfigDialog open={false} onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    // Simulate reopening dialog
    rerender(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    await waitFor(() => {
      expect(dataFolderInput).toHaveValue("");
      expect(manifestInput).toHaveValue("");
      expect(archiveManifestInput).toHaveValue("");
    });
  });

  it("should trim whitespace from the input fields before submitting", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.type(
      getByTestId("uploader-config-dialog-input-data-folder"),
      "C:/Users/me/my-data-folder   "
    );
    userEvent.type(
      getByTestId("uploader-config-dialog-input-manifest"),
      "C:/Users/me/my-manifest.tsv   "
    );
    userEvent.type(
      getByTestId("uploader-config-dialog-input-archive-manifest"),
      "C:/Users/me/my-archive-manifest.tsv   "
    );

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        dataFolder: "C:/Users/me/my-data-folder",
        manifest: "C:/Users/me/my-manifest.tsv",
        archive_manifest: "C:/Users/me/my-archive-manifest.tsv",
      });
    });
  });
});

describe("Implementation Requirements", () => {
  const mockDownload = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should not submit the form if any of the inputs are invalid", async () => {
    const { getByTestId, queryAllByText } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(queryAllByText(/This field is required/)).toHaveLength(2);
    });

    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("should not accept whitespace-only input for the Data Files Folder", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), " ".repeat(10));
    userEvent.type(
      getByTestId("uploader-config-dialog-input-manifest"),
      "C:/someUser/someFolder/someManifest.tsv"
    );

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(getByTestId("uploader-config-dialog-error-data-folder")).toBeVisible();
      expect(getByTestId("uploader-config-dialog-error-data-folder")).toHaveTextContent(
        /This field is required/
      );
    });

    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("should not accept whitespace-only input for the Manifest File", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.type(
      getByTestId("uploader-config-dialog-input-data-folder"),
      "C:/someUser/someFolder/someDataFolder"
    );
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), " ".repeat(10));

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(getByTestId("uploader-config-dialog-error-manifest")).toBeVisible();
      expect(getByTestId("uploader-config-dialog-error-manifest")).toHaveTextContent(
        /This field is required/
      );
    });

    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("should have a tooltip on the Data Files Folder input", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.hover(getByTestId("data-folder-input-tooltip"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Enter the full path for the Data Files folder on your local machine or S3 bucket"
    );

    userEvent.unhover(getByTestId("data-folder-input-tooltip"));

    await waitFor(() => {
      expect(tooltip).not.toBeVisible();
    });
  });

  it("should have a tooltip on the Manifest File input", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.hover(getByTestId("manifest-input-tooltip"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Enter the full path for the File Manifest on your local machine or S3 bucket"
    );

    userEvent.unhover(getByTestId("manifest-input-tooltip"));

    await waitFor(() => {
      expect(tooltip).not.toBeVisible();
    });
  });

  it("should have a tooltip on the Archive Manifest File input", async () => {
    const { getByTestId, findByRole } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.hover(getByTestId("archive-manifest-input-tooltip"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(
      "Enter the full path for the Archive Manifest file on your local machine or S3 bucket."
    );

    userEvent.unhover(getByTestId("archive-manifest-input-tooltip"));

    await waitFor(() => {
      expect(tooltip).not.toBeVisible();
    });
  });

  it("should submit with archive_manifest field when provided", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");
    userEvent.type(
      getByTestId("uploader-config-dialog-input-archive-manifest"),
      "test-archive-manifest"
    );

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        dataFolder: "test-folder",
        manifest: "test-manifest",
        archive_manifest: "test-archive-manifest",
      });
    });
  });

  it("should submit with undefined archive_manifest field when not provided", async () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    userEvent.type(getByTestId("uploader-config-dialog-input-data-folder"), "test-folder");
    userEvent.type(getByTestId("uploader-config-dialog-input-manifest"), "test-manifest");

    userEvent.click(getByTestId("uploader-config-dialog-download-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith({
        dataFolder: "test-folder",
        manifest: "test-manifest",
        archive_manifest: "",
      });
    });
  });

  it("should have the correct placeholder text for the Archive Manifest File input", () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderConfigDialog open onDownload={mockDownload} onClose={mockOnClose} />
      </TestParent>
    );

    const archiveManifestInput = within(
      getByTestId("uploader-config-dialog-input-archive-manifest")
    ).getByRole("textbox");

    expect(archiveManifestInput).toHaveAttribute(
      "placeholder",
      "/Users/me/my-metadata-folder/my-archive-manifest.tsv"
    );
  });
});
