import { MockedProvider } from "@apollo/client/testing";
import React, { useMemo } from "react";
import { Mock } from "vitest";
import { axe } from "vitest-axe";

import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { collaboratorFactory } from "@/factories/submission/CollaboratorFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";

import { TOOLTIP_TEXT } from "../../config/DashboardTooltips";
import { render, fireEvent, within, waitFor } from "../../test-utils";
import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthStatus,
  useAuthContext,
} from "../Contexts/AuthContext";
import { CollaboratorsProvider, useCollaboratorsContext } from "../Contexts/CollaboratorsContext";
import { useSubmissionContext } from "../Contexts/SubmissionContext";

import CollaboratorsTable from "./CollaboratorsTable";

vi.mock("../Contexts/AuthContext", async () => ({
  ...(await vi.importActual("../Contexts/AuthContext")),
  useAuthContext: vi.fn(),
}));

vi.mock("../Contexts/SubmissionContext", async () => ({
  ...(await vi.importActual("../Contexts/SubmissionContext")),
  useSubmissionContext: vi.fn(),
}));

vi.mock("../Contexts/CollaboratorsContext", async () => ({
  ...(await vi.importActual("../Contexts/CollaboratorsContext")),
  useCollaboratorsContext: vi.fn(),
}));

const mockUseAuthContext = useAuthContext as Mock;
const mockUseSubmissionContext = useSubmissionContext as Mock;
const mockUseCollaboratorsContext = useCollaboratorsContext as Mock;

const mockSubmission: Submission = submissionFactory.build({
  _id: "submission-1",
  submitterID: "user-1",
  collaborators: [],
});

const mockCollaborators: Collaborator[] = [
  collaboratorFactory.build({
    collaboratorID: "user-2",
    collaboratorName: "Jane Smith",
    permission: "Can Edit",
  }),
];

const mockRemainingPotentialCollaborators: Collaborator[] = collaboratorFactory.build(
  2,
  (index) => ({
    collaboratorID: `user-${index + 3}`,
    collaboratorName: `User ${index + 3}`,
    permission: "Can Edit",
  })
);

const mockHandleAddCollaborator = vi.fn();
const mockHandleRemoveCollaborator = vi.fn();
const mockHandleUpdateCollaborator = vi.fn();

type Props = {
  role?: UserRole;
  children: React.ReactNode;
};

const TestParent: React.FC<Props> = ({ role = "Submitter", children }) => {
  const authState = useMemo<AuthContextState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ _id: "user-1", role, permissions: ["data_submission:create"] }),
      }),
    [role]
  );

  return (
    <MockedProvider mocks={[]}>
      <AuthContext.Provider value={authState}>
        <CollaboratorsProvider>{children}</CollaboratorsProvider>
      </AuthContext.Provider>
    </MockedProvider>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        role: "Submitter",
        permissions: ["data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: mockSubmission },
    });

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaborators,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        role: "Submitter",
        permissions: ["data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: mockSubmission },
    });

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaborators,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });
  });

  it("renders table headers correctly", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    expect(getByTestId("header-collaborator")).toHaveTextContent("Collaborator");
    expect(getByTestId("header-remove")).toHaveTextContent("Remove");
  });

  it("renders collaborators correctly", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorRow = getByTestId("collaborator-row-0");
    expect(collaboratorRow).toBeInTheDocument();

    const collaboratorSelect = getByTestId("collaborator-select-0-input");
    expect(collaboratorSelect).toBeInTheDocument();
    expect(collaboratorSelect).toHaveValue("user-2");

    const removeButton = getByTestId("remove-collaborator-button-0");
    expect(removeButton).toBeInTheDocument();
  });

  it("calls handleRemoveCollaborator when remove button is clicked", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const removeButton = getByTestId("remove-collaborator-button-0");
    fireEvent.click(removeButton);

    expect(mockHandleRemoveCollaborator).toHaveBeenCalledWith(0);
  });

  it("calls handleAddCollaborator when add collaborator button is clicked", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const addButton = getByTestId("add-collaborator-button");
    fireEvent.click(addButton);

    expect(mockHandleAddCollaborator).toHaveBeenCalled();
  });

  it("renders add collaborator button disabled when max collaborators reached", () => {
    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: new Array(5).fill(mockCollaborators[0]),
      remainingPotentialCollaborators: [],
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const addButton = getByTestId("add-collaborator-button");
    expect(addButton).toBeDisabled();
  });

  it("disables inputs when loading", () => {
    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaborators,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: true,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = within(getByTestId("collaborator-select-0")).getByRole("button");
    expect(collaboratorSelect).toHaveClass("Mui-readOnly");

    const removeButton = getByTestId("remove-collaborator-button-0");
    expect(removeButton).toBeDisabled();

    const addButton = getByTestId("add-collaborator-button");
    expect(addButton).toBeDisabled();
  });

  it("does not render remove button when isEdit is false", () => {
    const { queryByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit={false} />
      </TestParent>
    );

    expect(queryByTestId("header-remove")).toBeNull();
    expect(queryByTestId("remove-collaborator-button-0")).toBeNull();
  });

  it("calls handleUpdateCollaborator when collaborator select changes", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0-input");

    fireEvent.change(collaboratorSelect, { target: { value: "user-3" } });

    expect(mockHandleUpdateCollaborator).toHaveBeenCalledWith(0, {
      collaboratorID: "user-3",
      permission: "Can Edit",
    });
  });

  it("renders disabled add collaborator button tooltip correctly", async () => {
    const { getByText, getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit={false} />
      </TestParent>
    );

    fireEvent.mouseOver(getByTestId("add-collaborator-button"));

    await waitFor(() => {
      expect(
        getByText(TOOLTIP_TEXT.COLLABORATORS_DIALOG.ACTIONS.ADD_COLLABORATOR_DISABLED)
      ).toBeInTheDocument();
    });
  });

  it("renders placeholder in collaborator select when no collaboratorID", () => {
    const mockCollaboratorsWithEmptyID = [
      collaboratorFactory.build({
        collaboratorID: "",
        collaboratorName: "",
        permission: "Can Edit",
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaboratorsWithEmptyID,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0-input");
    expect(collaboratorSelect).toHaveValue("");
  });

  it("disables inputs when user isEdit is false", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit={false} />
      </TestParent>
    );

    const collaboratorSelect = within(getByTestId("collaborator-select-0")).getByRole("button");
    expect(collaboratorSelect).toHaveClass("Mui-readOnly");

    const addButton = getByTestId("add-collaborator-button");
    expect(addButton).toBeDisabled();
  });

  it("renders the correct number of collaborator rows", () => {
    const additionalCollaborators = [
      collaboratorFactory.build({
        collaboratorID: "user-5",
        collaboratorName: "Emily Davis",
        permission: "Can Edit",
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: [...mockCollaborators, ...additionalCollaborators],
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorRow0 = getByTestId("collaborator-row-0");
    const collaboratorRow1 = getByTestId("collaborator-row-1");

    expect(collaboratorRow0).toBeInTheDocument();
    expect(collaboratorRow1).toBeInTheDocument();
  });

  it("returns empty string in renderValue when value is falsy", () => {
    const mockCollaboratorsWithEmptyID = [
      collaboratorFactory.build({
        collaboratorID: "",
        collaboratorName: "Jane Smith",
        permission: "Can Edit",
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaboratorsWithEmptyID,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0-input");

    expect(collaboratorSelect).toHaveValue("");
  });

  it("displays a space when collaboratorName is null", () => {
    const mockCollaboratorsWithNullName = [
      collaboratorFactory.build({
        collaboratorID: "user-2",
        collaboratorName: null,
        permission: "Can Edit",
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaboratorsWithNullName,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0");
    expect(within(collaboratorSelect).getByTestId("truncated-text-label").textContent).toEqual(" ");
  });

  it("displays a space when collaboratorID is null", () => {
    const mockCollaboratorsWithNullID = [
      collaboratorFactory.build({
        collaboratorID: null,
        collaboratorName: "user-name",
        permission: "Can Edit",
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaboratorsWithNullID,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0-input");
    expect(collaboratorSelect).toHaveValue("");
  });

  it("handles undefined collaborator permission by defaulting to no selection (only 'Can Edit' is valid)", () => {
    const mockCollaboratorsWithUndefinedPermission = [
      collaboratorFactory.build({
        collaboratorID: "user-2",
        collaboratorName: "Jane Smith",
        permission: undefined,
      }),
    ];

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaboratorsWithUndefinedPermission,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const collaboratorSelect = getByTestId("collaborator-select-0-input");
    expect(collaboratorSelect).toHaveValue("user-2");
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuthContext.mockReturnValue({
      user: userFactory.build({
        _id: "user-1",
        role: "Submitter",
        permissions: ["data_submission:create"],
      }),
      status: AuthStatus.LOADED,
    });

    mockUseSubmissionContext.mockReturnValue({
      data: { getSubmission: mockSubmission },
    });

    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: mockCollaborators,
      remainingPotentialCollaborators: mockRemainingPotentialCollaborators,
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });
  });

  it("renders the 'Can Edit' Access column with correct label and value", () => {
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    expect(getByTestId("header-access")).toHaveTextContent("Access");

    const accessCell = getByTestId("collaborator-access-0");
    expect(accessCell).toHaveTextContent("Can Edit");
  });

  it("renders the 'No Access' Access column with correct label and value", () => {
    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: [
        collaboratorFactory.build({
          collaboratorID: "user-4",
          collaboratorName: "Lost Access User",
          permission: "No Access",
        }),
      ],
      remainingPotentialCollaborators: [],
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });
    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    expect(getByTestId("header-access")).toHaveTextContent("Access");

    const accessCell = getByTestId("collaborator-access-0");
    expect(accessCell).toHaveTextContent("No Access");
  });

  it("allows removing collaborators with 'No Access'", () => {
    mockUseCollaboratorsContext.mockReturnValue({
      currentCollaborators: [
        collaboratorFactory.build({
          collaboratorID: "user-4",
          collaboratorName: "Lost Access User",
          permission: "No Access",
        }),
      ],
      remainingPotentialCollaborators: [],
      maxCollaborators: 5,
      handleAddCollaborator: mockHandleAddCollaborator,
      handleRemoveCollaborator: mockHandleRemoveCollaborator,
      handleUpdateCollaborator: mockHandleUpdateCollaborator,
      loading: false,
    });

    const { getByTestId } = render(
      <TestParent>
        <CollaboratorsTable isEdit />
      </TestParent>
    );

    const removeButton = getByTestId("remove-collaborator-button-0");
    expect(removeButton).toBeInTheDocument();
    expect(removeButton).not.toBeDisabled();

    fireEvent.click(removeButton);
    expect(mockHandleRemoveCollaborator).toHaveBeenCalledWith(0);
  });
});
