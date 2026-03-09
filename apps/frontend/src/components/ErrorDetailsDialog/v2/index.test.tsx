import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, waitFor } from "../../../test-utils";

import Dialog, { ErrorDetailsDialogV2Props, ErrorDetailsIssue } from "./index";

const baseProps: ErrorDetailsDialogV2Props = {
  open: true,
  header: "Error Details",
  issues: [],
  onClose: vi.fn(),
};

describe("Accessibility", () => {
  it("should have no violations (no issues)", async () => {
    const { container } = render(<Dialog {...baseProps} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (with issues)", async () => {
    const mockIssues: ErrorDetailsIssue[] = new Array(3).fill(null).map((_, index) => ({
      severity: "error",
      message: `Error description ${index + 1}`,
    }));

    const { container } = render(<Dialog {...baseProps} issues={mockIssues} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<Dialog {...baseProps} />)).not.toThrow();
  });

  it("should close the dialog when the 'Close' button is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(<Dialog {...baseProps} onClose={mockOnClose} />);

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-close-button"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(<Dialog {...baseProps} onClose={mockOnClose} />);

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-close-icon"));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(<Dialog {...baseProps} onClose={mockOnClose} />);

    expect(mockOnClose).not.toHaveBeenCalled();

    userEvent.click(getByTestId("error-details-dialog").firstChild as HTMLElement);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it("should render the dialog with the correct preHeader", () => {
    const { getByTestId } = render(<Dialog {...baseProps} preHeader="A-MOCK-HEADER" />);

    expect(getByTestId("error-details-pre-header")).toHaveTextContent(/A-MOCK-HEADER/i);
  });

  it("should render the dialog with the correct header", () => {
    const { getByTestId } = render(<Dialog {...baseProps} header="A-MOCK-DIALOG-HEADER" />);

    expect(getByTestId("error-details-title")).toHaveTextContent(/A-MOCK-DIALOG-HEADER/i);
  });

  it("should render the dialog with the correct postHeader", () => {
    const { getByTestId } = render(<Dialog {...baseProps} postHeader="A-MOCK-POST-HEADER" />);

    expect(getByTestId("error-details-node-info")).toHaveTextContent(/A-MOCK-POST-HEADER/i);
  });

  it.each<[number, string]>([
    [0, "0 ISSUES:"],
    [1, "1 ISSUE:"],
    [2, "2 ISSUES:"],
  ])(
    "should use the correct pluralization for the automatic error count of %p",
    (count, expected) => {
      const mockIssues: ErrorDetailsIssue[] = new Array(count).fill(null).map((_, index) => ({
        code: "M018",
        severity: "error",
        message: `Error description ${index + 1}`,
      }));

      const { getByTestId } = render(<Dialog {...baseProps} issues={mockIssues} />);

      expect(getByTestId("error-details-error-count")).toHaveTextContent(expected);
    }
  );

  it("should render the associated action for each issue when provided", () => {
    const mockIssues: ErrorDetailsIssue[] = [
      {
        severity: "error",
        message: "Error description 1",
        action: "SOME-MOCK-ACTION",
      },
      {
        severity: "warning",
        message: "Warning description 2",
        action: <button type="button">MOCK-ACTION-BUTTON</button>,
      },
    ];

    const { getByTestId } = render(<Dialog {...baseProps} issues={mockIssues} />);

    expect(getByTestId("error-details-issue-0")).toHaveTextContent("SOME-MOCK-ACTION");
    expect(getByTestId("error-details-issue-1")).toHaveTextContent("MOCK-ACTION-BUTTON");
  });
});
