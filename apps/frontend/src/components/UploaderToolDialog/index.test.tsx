import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { TestRouter, render, waitFor } from "../../test-utils";

import UploaderToolDialog from "./index";

vi.mock(import("../../env"), async (importOriginal) => {
  const mod = await importOriginal();

  return {
    default: {
      ...mod.default,
      VITE_UPLOADER_CLI: "mocked-cli-download-link",
      VITE_UPLOADER_CLI_VERSION: "2.3-alpha-6",
    },
  };
});

type ParentProps = {
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ children }) => (
  <TestRouter basename="">{children}</TestRouter>
);

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(
      <TestParent>
        <UploaderToolDialog open />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderToolDialog open />
      </TestParent>
    );

    expect(getByTestId("uploader-cli-dialog")).toBeVisible();
  });

  it("should close the dialog when the 'Close' button is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <UploaderToolDialog open onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-cli-close-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <UploaderToolDialog open onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-cli-dialog-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <UploaderToolDialog open onClose={mockOnClose} />
      </TestParent>
    );

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("uploader-cli-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should render the CLI version", () => {
    const { getByTestId } = render(
      <TestParent>
        <UploaderToolDialog open />
      </TestParent>
    );

    expect(getByTestId("uploader-cli-version").textContent).toBe("Uploader CLI Version: v2.3");
  });
});
