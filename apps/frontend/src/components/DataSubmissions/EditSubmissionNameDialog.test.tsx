import { MockedProvider } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";

import { EDIT_SUBMISSION } from "@/graphql";

import { render, waitFor } from "../../test-utils";

import EditSubmissionNameDialog from "./EditSubmissionNameDialog";

const defaultProps = {
  open: true,
  submissionID: "12345",
  initialValue: "Test Submission Name",
  onCancel: vi.fn(),
  onSave: vi.fn(),
};

const editSubmissionMock = {
  request: {
    query: EDIT_SUBMISSION,
    variables: { _id: "12345", newName: "Updated Submission Name" },
  },
  result: {
    data: {
      editSubmission: {
        _id: "12345",
        name: "Updated Submission Name",
      },
    },
  },
};

function renderDialog(overrideProps = {}) {
  return render(
    <MockedProvider>
      <EditSubmissionNameDialog {...defaultProps} {...overrideProps} />
    </MockedProvider>
  );
}

function getInput(getByTestId: (id: string) => HTMLElement) {
  const inputWrapper = getByTestId("edit-submission-name-dialog-input");
  return inputWrapper.querySelector("input") as HTMLInputElement;
}

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = renderDialog();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it("should close the dialog when the 'Cancel' button is clicked", async () => {
    const mockOnCancel = vi.fn();
    const { getByTestId } = renderDialog({ onCancel: mockOnCancel });
    userEvent.click(getByTestId("edit-submission-name-dialog-cancel-button"));
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the 'X' icon is clicked", async () => {
    const mockOnCancel = vi.fn();
    const { getByTestId } = renderDialog({ onCancel: mockOnCancel });
    userEvent.click(getByTestId("edit-submission-name-dialog-close-icon"));
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  it("should close the dialog when the backdrop is clicked", async () => {
    const mockOnCancel = vi.fn();
    const { getByTestId } = renderDialog({ onCancel: mockOnCancel });
    userEvent.click(getByTestId("edit-submission-name-dialog").firstChild as HTMLElement);
    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  it("should update the input value when user types", async () => {
    const { getByTestId } = renderDialog({ initialValue: "Test" });
    const input = getInput(getByTestId);
    userEvent.clear(input);
    userEvent.type(input, "New Name");
    expect(input.value).toBe("New Name");
  });

  it("should call onSave with the new name when the 'Save' button is clicked", async () => {
    const mockOnSave = vi.fn();
    const { getByTestId } = render(
      <MockedProvider mocks={[editSubmissionMock]}>
        <EditSubmissionNameDialog {...defaultProps} onSave={mockOnSave} />
      </MockedProvider>
    );
    const input = getInput(getByTestId);
    userEvent.clear(input);
    userEvent.type(input, "Updated Submission Name");
    userEvent.click(getByTestId("edit-submission-name-dialog-save-button"));
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("Updated Submission Name");
    });
  });
});

describe("Implementation Requirements", () => {
  it("should prepopulate the input with the initial value", async () => {
    const { getByTestId } = renderDialog();
    const input = getInput(getByTestId);
    expect(input.value).toBe("Test Submission Name");
  });

  it("should not allow the input to be empty when saving", async () => {
    const { getByTestId } = renderDialog();
    const input = getInput(getByTestId);
    userEvent.clear(input);
    userEvent.click(getByTestId("edit-submission-name-dialog-save-button"));
    await waitFor(() => {
      expect(getByTestId("edit-submission-name-dialog-error")).toHaveTextContent(
        /Submission name is required/i
      );
    });
  });

  it("should not allow the input to exceed 25 characters", async () => {
    const { getByTestId } = renderDialog();
    const input = getInput(getByTestId);
    userEvent.clear(input);
    userEvent.type(input, "a".repeat(30));
    expect(input.value.length).toBe(25);
  });
});
