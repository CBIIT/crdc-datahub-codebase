import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render, within } from "../../test-utils";

import ReviewDialog from "./RejectFormDialog";

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(<ReviewDialog open />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (disabled actions)", async () => {
    const { container } = render(<ReviewDialog open disableActions />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no violations (loading)", async () => {
    const { container } = render(<ReviewDialog open loading />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render the dialog with the correct title", () => {
    const { getByText } = render(<ReviewDialog open />);

    expect(getByText(/Reject Submission Request/)).toBeInTheDocument();
  });

  it("should render the dialog with the review comment input field", () => {
    const { getByTestId } = render(<ReviewDialog open />);

    expect(getByTestId("review-comment")).toBeInTheDocument();
  });

  it("should disable all actions when `disableActions` is true", () => {
    const { getByRole } = render(<ReviewDialog open disableActions />);

    expect(getByRole("button", { name: /Cancel/i })).toBeDisabled();
    expect(getByRole("button", { name: /Confirm to Reject/i })).toBeDisabled();
  });

  it("should disable the confirm button when `loading` is true", () => {
    const { getByRole } = render(<ReviewDialog open loading />);

    expect(getByRole("button", { name: /Confirm to Reject/i })).toBeDisabled();
  });

  it("should call the `onSubmit` function when the confirm button is clicked", () => {
    const mockOnSubmit = vi.fn();

    const { getByRole, getByTestId } = render(<ReviewDialog open onSubmit={mockOnSubmit} />);

    userEvent.type(getByTestId("review-comment"), "mock-comment");

    userEvent.click(getByRole("button", { name: /Confirm to Reject/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith("mock-comment");
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls the `onCancel` function when the cancel button is clicked", () => {
    const mockOnCancel = vi.fn();

    const { getByRole } = render(<ReviewDialog open onCancel={mockOnCancel} />);

    userEvent.click(getByRole("button", { name: /Cancel/i }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});

describe("Implementation Requirements", () => {
  it("disables the confirm button when no review comment is entered", () => {
    const { getByRole, getByTestId } = render(<ReviewDialog open />);

    expect(getByRole("button", { name: /Confirm to Reject/i })).toBeDisabled();

    userEvent.type(getByTestId("review-comment"), "mock-comment");

    expect(getByRole("button", { name: /Confirm to Reject/i })).not.toBeDisabled();
  });

  it("should not allow typing more than 500 characters in the review comment input field", () => {
    const mockOnSubmit = vi.fn();

    const { getByTestId, getByRole } = render(<ReviewDialog open onSubmit={mockOnSubmit} />);

    userEvent.type(getByTestId("review-comment"), "X".repeat(550));

    expect(within(getByTestId("review-comment")).getByRole("textbox")).toHaveValue("X".repeat(500));

    userEvent.click(getByRole("button", { name: /Confirm to Reject/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.stringMatching(/^X{500}$/));
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it("should not allow pasting more than 500 characters in the review comment input field", () => {
    const mockOnSubmit = vi.fn();

    const { getByTestId, getByRole } = render(<ReviewDialog open onSubmit={mockOnSubmit} />);

    const input = within(getByTestId("review-comment")).getByRole("textbox");

    userEvent.paste(input, "X".repeat(550));

    expect(input).toHaveValue("X".repeat(500));

    userEvent.click(getByRole("button", { name: /Confirm to Reject/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.stringMatching(/^X{500}$/));
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });
});
