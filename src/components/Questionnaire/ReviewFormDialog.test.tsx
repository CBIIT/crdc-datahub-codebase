import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, waitFor, within } from "../../test-utils";

import ReviewFormDialog from "./ReviewFormDialog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(<ReviewFormDialog open header="Test" onSubmit={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (loading)", async () => {
    const { container } = render(<ReviewFormDialog open header="Test" loading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render the dialog with a custom header", () => {
    const { getByText } = render(<ReviewFormDialog open header="Approve Submission Request" />);

    expect(getByText("Approve Submission Request")).toBeInTheDocument();
  });

  it("should render the dialog with the review comment input field", () => {
    const { getByTestId } = render(<ReviewFormDialog open header="Test" />);

    expect(getByTestId("review-comment")).toBeInTheDocument();
  });

  it("should render a custom confirm button text", () => {
    const { getByText } = render(
      <ReviewFormDialog open header="Test" confirmText="Confirm to Approve" />
    );

    expect(getByText("Confirm to Approve")).toBeInTheDocument();
  });

  it("should disable the confirm button when loading is true", () => {
    const { getByTestId } = render(
      <ReviewFormDialog open header="Test" confirmText="Confirm" loading />
    );

    expect(getByTestId("review-form-dialog-confirm-button")).toBeDisabled();
  });

  it("should disable the cancel button when loading is true", () => {
    const { getByTestId } = render(
      <ReviewFormDialog open header="Test" confirmText="Confirm" loading />
    );

    expect(getByTestId("review-form-dialog-cancel-button")).toBeDisabled();
  });

  it("should call onSubmit with the review comment when the confirm button is clicked", async () => {
    const mockOnSubmit = vi.fn();

    const { getByTestId } = render(
      <ReviewFormDialog open header="Test" confirmText="Confirm" onSubmit={mockOnSubmit} />
    );

    userEvent.type(
      within(getByTestId("review-comment")).getByRole("textbox", { hidden: false }),
      "mock-comment"
    );

    userEvent.click(getByTestId("review-form-dialog-confirm-button"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith("mock-comment");
  });

  it("should call onCancel when the cancel button is clicked", () => {
    const mockOnCancel = vi.fn();

    const { getByTestId } = render(<ReviewFormDialog open header="Test" onCancel={mockOnCancel} />);

    userEvent.click(getByTestId("review-form-dialog-cancel-button"));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should render children content", () => {
    const { getByText } = render(
      <ReviewFormDialog open header="Test">
        <span>Custom child content</span>
      </ReviewFormDialog>
    );

    expect(getByText("Custom child content")).toBeInTheDocument();
  });

  it.each([
    { header: "Approve Submission Request", confirmText: "Confirm to Approve" },
    { header: "Request Additional Changes", confirmText: "Confirm to move to Inquired" },
    { header: "Reject Submission Request", confirmText: "Confirm to Reject" },
  ])(
    "should render with header '$header' and confirm text '$confirmText'",
    ({ header, confirmText }) => {
      const { getByText } = render(
        <ReviewFormDialog open header={header} confirmText={confirmText} />
      );

      expect(getByText(header)).toBeInTheDocument();
      expect(getByText(confirmText)).toBeInTheDocument();
    }
  );
});

describe("Implementation Requirements", () => {
  it("should disable the confirm button when no review comment is entered", () => {
    const { getByTestId } = render(<ReviewFormDialog open header="Test" confirmText="Confirm" />);

    expect(getByTestId("review-form-dialog-confirm-button")).toBeDisabled();

    userEvent.type(within(getByTestId("review-comment")).getByRole("textbox"), "mock-comment");

    expect(getByTestId("review-form-dialog-confirm-button")).not.toBeDisabled();
  });

  it("should not allow typing more than 10,000 characters in the review comment input field", async () => {
    const mockOnSubmit = vi.fn();

    const { getByTestId } = render(
      <ReviewFormDialog open header="Test" confirmText="Confirm" onSubmit={mockOnSubmit} />
    );

    const input = within(getByTestId("review-comment")).getByRole("textbox");
    userEvent.paste(input, "X".repeat(10_050));

    expect(input).toHaveValue("X".repeat(10_000));

    userEvent.click(getByTestId("review-form-dialog-confirm-button"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.stringMatching(/^X{10000}$/));
  });

  it("should display a character counter that updates as the user types", () => {
    const { getByTestId } = render(<ReviewFormDialog open header="Test" />);

    expect(getByTestId("review-comment-character-count")).toHaveTextContent("0 / 10,000");

    const input = within(getByTestId("review-comment")).getByRole("textbox");
    userEvent.type(input, "Hello");

    expect(getByTestId("review-comment-character-count")).toHaveTextContent("5 / 10,000");
  });

  it("should format the character count with commas", () => {
    const { getByTestId } = render(<ReviewFormDialog open header="Test" />);

    const input = within(getByTestId("review-comment")).getByRole("textbox");
    userEvent.paste(input, "X".repeat(1234));

    expect(getByTestId("review-comment-character-count")).toHaveTextContent("1,234 / 10,000");
  });

  it("should reset the review comment when the dialog is canceled and reopened", async () => {
    const mockOnCancel = vi.fn();

    const { getByTestId, rerender } = render(
      <ReviewFormDialog open header="Test" onCancel={mockOnCancel} />
    );

    const input = within(getByTestId("review-comment")).getByRole("textbox");
    userEvent.type(input, "some text");

    expect(input).toHaveValue("some text");

    userEvent.click(getByTestId("review-form-dialog-cancel-button"));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);

    rerender(<ReviewFormDialog open={false} header="Test" onCancel={mockOnCancel} />);
    rerender(<ReviewFormDialog open header="Test" onCancel={mockOnCancel} />);

    await waitFor(() => {
      expect(within(getByTestId("review-comment")).getByRole("textbox")).toHaveValue("");
    });
  });
});
