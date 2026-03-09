import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { render } from "../../test-utils";

import CopyAdornment from "./CopyAdornment";

const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    const { container } = render(<CopyAdornment _id="abc-123-this-is-a-id" />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations (no _ID)", async () => {
    const { container } = render(<CopyAdornment _id={null} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the Submission ID and copy button", () => {
    const { getByTestId } = render(<CopyAdornment _id="abc-123-this-is-a-id" />);

    expect(getByTestId("data-submission-id-value")).toBeInTheDocument();
    expect(getByTestId("data-submission-id-value")).toHaveTextContent("abc-123-this-is-a-id");

    expect(getByTestId("data-submission-copy-id-button")).toBeInTheDocument();
    expect(getByTestId("data-submission-copy-id-button")).toBeEnabled();
  });

  it("should copy the ID to the clipboard when clicking the copy button", () => {
    const { getByTestId } = render(<CopyAdornment _id="abc-123-this-is-a-id" />);

    userEvent.click(getByTestId("data-submission-copy-id-button"));

    expect(mockWriteText).toHaveBeenCalledWith("abc-123-this-is-a-id");
  });

  it("should not copy the ID to the clipboard when no _ID is provided", () => {
    const { getByTestId } = render(<CopyAdornment _id={null} />);

    userEvent.click(getByTestId("data-submission-copy-id-button"), null, {
      skipPointerEventsCheck: true,
    });

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("should disable the copy button when no _ID is provided", () => {
    const { getByTestId } = render(<CopyAdornment _id={null} />);

    expect(getByTestId("data-submission-copy-id-button")).toBeDisabled();
  });
});
