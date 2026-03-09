import { MockedProvider } from "@apollo/client/testing";
import React from "react";
import { Mock } from "vitest";
import { axe } from "vitest-axe";

import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { render, fireEvent, waitFor } from "../../test-utils";
import { Status as AuthStatus, useAuthContext } from "../Contexts/AuthContext";
import { CollaboratorsProvider, useCollaboratorsContext } from "../Contexts/CollaboratorsContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";

import CollaboratorsDialog from "./CollaboratorsDialog";

vi.mock("../Contexts/AuthContext", async () => ({
  ...(await vi.importActual("../Contexts/AuthContext")),
  useAuthContext: vi.fn(),
}));

vi.mock("../Contexts/CollaboratorsContext", async () => ({
  ...(await vi.importActual("../Contexts/CollaboratorsContext")),
  useCollaboratorsContext: vi.fn(),
}));

vi.mock("../Contexts/SubmissionContext", async () => ({
  ...(await vi.importActual("../Contexts/SubmissionContext")),
  useSubmissionContext: vi.fn(),
}));

const mockUseAuthContext = useAuthContext as Mock;
const mockUseCollaboratorsContext = useCollaboratorsContext as Mock;
const mockUseSubmissionContext = useSubmissionContext as Mock;

const mockSubmission = submissionFactory.build({
  _id: "submission-1",
  submitterID: "user-1",
  collaborators: [],
  organization: organizationFactory.pick(["_id", "name", "abbreviation"]).build({
    _id: "org-1",
    name: "Organization 1",
  }),
});

const mockCollaborators = [
  collaboratorFactory.build({
    collaboratorID: "user-2",
    collaboratorName: "Jane Smith",
    permission: "Can Edit",
  }),
];

const mockSaveCollaborators = vi.fn();
const mockLoadPotentialCollaborators = vi.fn();
const mockResetCollaborators = vi.fn();
const mockUpdateQuery = vi.fn();

type Props = {
  children: React.ReactNode;
};

const TestParent: React.FC<Props> = ({ children }) => (
  <MockedProvider mocks={[]}>
    <CollaboratorsProvider>{children}</CollaboratorsProvider>
  </MockedProvider>
);

describe("CollaboratorsDialog Accessibility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        permissions: ["data_submission:view", "data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: mockSubmission },
      updateQuery: mockUpdateQuery,
    });

    mockUseCollaboratorsContext.mockReturnValue({
      saveCollaborators: mockSaveCollaborators,
      loadPotentialCollaborators: mockLoadPotentialCollaborators,
      resetCollaborators: mockResetCollaborators,
      loading: false,
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("CollaboratorsDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        permissions: ["data_submission:view", "data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: mockSubmission },
      updateQuery: mockUpdateQuery,
    });

    mockUseCollaboratorsContext.mockReturnValue({
      saveCollaborators: mockSaveCollaborators,
      loadPotentialCollaborators: mockLoadPotentialCollaborators,
      resetCollaborators: mockResetCollaborators,
      loading: false,
    });
  });

  it("renders the dialog when open is true", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("collaborators-dialog")).toBeInTheDocument();
    expect(getByTestId("collaborators-dialog-header")).toHaveTextContent(
      "Data SubmissionCollaborators" // line break between "Submission" and "Collaborators" text
    );
    expect(getByTestId("collaborators-dialog-description")).toHaveTextContent(
      "Below is a list of collaborators who have been granted access to this data submission. Once added, each collaborator can contribute to the submission by uploading data, running validations, and submitting."
    );
  });

  it("should have a disclaimer in the dialog", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("collaborators-dialog-disclaimer")).toHaveTextContent(
      "Note: It is the responsibility of the person adding collaborators to ensure that the collaborators have permission to see and access the data that will be visible to them and that they will abide by all pre-release program-level restrictions."
    );
  });

  it("does not render the dialog when open is false", () => {
    const { queryByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open={false} onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    expect(queryByTestId("collaborators-dialog")).toBeNull();
  });

  it("calls onClose when close icon is clicked", () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    const closeButton = getByTestId("collaborators-dialog-close-icon-button");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when Close button is clicked", () => {
    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "some-other-user",
        permissions: ["data_submission:view", "data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    const closeButton = getByTestId("collaborators-dialog-close-button");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onSave when Save button is clicked", async () => {
    const mockOnSave = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={mockOnSave} />
      </TestParent>
    );

    mockSaveCollaborators.mockResolvedValue(mockCollaborators);

    const saveButton = getByTestId("collaborators-dialog-save-button");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveCollaborators).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith(mockCollaborators);
      expect(mockUpdateQuery).toHaveBeenCalled();
    });
  });

  it("calls resetCollaborators and onClose when Cancel button is clicked", () => {
    const mockOnClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    const cancelButton = getByTestId("collaborators-dialog-cancel-button");
    fireEvent.click(cancelButton);

    expect(mockResetCollaborators).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("loads potential collaborators on mount", () => {
    render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    expect(mockLoadPotentialCollaborators).toHaveBeenCalled();
  });

  it("disables buttons when loading", () => {
    mockUseCollaboratorsContext.mockReturnValue({
      saveCollaborators: mockSaveCollaborators,
      loadPotentialCollaborators: mockLoadPotentialCollaborators,
      resetCollaborators: mockResetCollaborators,
      loading: true,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={vi.fn()} />
      </TestParent>
    );

    const saveButton = getByTestId("collaborators-dialog-save-button");
    const cancelButton = getByTestId("collaborators-dialog-cancel-button");

    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it("updates submission data correctly when previous data exists", async () => {
    const mockOnSave = vi.fn();

    mockUpdateQuery.mockImplementation((callback) => {
      const prev = { getSubmission: { otherData: "test" } };
      const result = callback(prev);
      expect(result).toEqual({
        ...prev,
        getSubmission: {
          ...prev.getSubmission,
          collaborators: mockCollaborators,
        },
      });
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={mockOnSave} />
      </TestParent>
    );

    mockSaveCollaborators.mockResolvedValue(mockCollaborators);

    const saveButton = getByTestId("collaborators-dialog-save-button");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveCollaborators).toHaveBeenCalled();
      expect(mockUpdateQuery).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith(mockCollaborators);
    });
  });

  it("updates submission data correctly when previous data is undefined", async () => {
    const mockOnSave = vi.fn();

    mockUpdateQuery.mockImplementation((callback) => {
      const prev = undefined;
      const result = callback(prev);
      expect(result).toEqual({
        ...prev,
        getSubmission: {
          ...prev?.getSubmission,
          collaborators: mockCollaborators,
        },
      });
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={mockOnSave} />
      </TestParent>
    );

    mockSaveCollaborators.mockResolvedValue(mockCollaborators);

    const saveButton = getByTestId("collaborators-dialog-save-button");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveCollaborators).toHaveBeenCalled();
      expect(mockUpdateQuery).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith(mockCollaborators);
    });
  });

  it("updates submission data correctly when getSubmission is undefined", async () => {
    const mockOnSave = vi.fn();

    mockUpdateQuery.mockImplementation((callback) => {
      const prev = { getSubmission: undefined };
      const result = callback(prev);
      expect(result).toEqual({
        ...prev,
        getSubmission: {
          ...prev.getSubmission,
          collaborators: mockCollaborators,
        },
      });
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={vi.fn()} onSave={mockOnSave} />
      </TestParent>
    );

    mockSaveCollaborators.mockResolvedValue(mockCollaborators);

    const saveButton = getByTestId("collaborators-dialog-save-button");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveCollaborators).toHaveBeenCalled();
      expect(mockUpdateQuery).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalledWith(mockCollaborators);
    });
  });

  it("should disable inputs when user does not have required permissions", async () => {
    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        permissions: ["data_submission:view"],
      }),
      status: AuthStatus.LOADED,
    });

    const mockOnClose = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    expect(queryByTestId("collaborators-dialog-save-button")).not.toBeInTheDocument();
    expect(queryByTestId("collaborators-dialog-cancel-button")).not.toBeInTheDocument();
    expect(getByTestId("collaborators-dialog-close-button")).toBeInTheDocument();
  });

  it("should enable inputs when user has the required permissions", async () => {
    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        permissions: ["data_submission:view", "data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    const mockOnClose = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("collaborators-dialog-save-button")).toBeInTheDocument();
    expect(getByTestId("collaborators-dialog-cancel-button")).toBeInTheDocument();
    expect(queryByTestId("collaborators-dialog-close-button")).not.toBeInTheDocument();
  });

  it.each<SubmissionStatus>(["Completed", "Canceled", "Deleted"])(
    "should not allow changes when submission status is '%s'",
    async (status) => {
      mockUseAuthContext.mockReturnValue({
        user: userFactory.build({
          _id: "user-1",
          permissions: ["data_submission:view", "data_submission:create"],
        }),
        status: AuthStatus.LOADED,
      });
      mockUseSubmissionContext.mockReturnValue({
        data: { getSubmission: { ...mockSubmission, status } as Submission },
        updateQuery: mockUpdateQuery,
      });

      const mockOnClose = vi.fn();
      const { getByTestId, queryByTestId } = render(
        <TestParent>
          <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
        </TestParent>
      );

      expect(queryByTestId("collaborators-dialog-save-button")).not.toBeInTheDocument();
      expect(queryByTestId("collaborators-dialog-cancel-button")).not.toBeInTheDocument();
      expect(getByTestId("collaborators-dialog-close-button")).toBeInTheDocument();
    }
  );

  it.each<SubmissionStatus>([
    "New",
    "In Progress",
    "Rejected",
    "Released",
    "Submitted",
    "Withdrawn",
  ])("should allow changes when submission status is '%s'", async (status) => {
    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        permissions: ["data_submission:view", "data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });
    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: { ...mockSubmission, status } as Submission },
      updateQuery: mockUpdateQuery,
    });

    const mockOnClose = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <TestParent>
        <CollaboratorsDialog open onClose={mockOnClose} onSave={vi.fn()} />
      </TestParent>
    );

    expect(getByTestId("collaborators-dialog-save-button")).toBeInTheDocument();
    expect(getByTestId("collaborators-dialog-cancel-button")).toBeInTheDocument();
    expect(queryByTestId("collaborators-dialog-close-button")).not.toBeInTheDocument();
  });
});
