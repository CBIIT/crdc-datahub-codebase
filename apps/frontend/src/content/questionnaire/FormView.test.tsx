import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { MemoryRouterProps } from "react-router-dom";
import { axe } from "vitest-axe";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthStatus,
} from "@/components/Contexts/AuthContext";
import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "@/components/Contexts/FormContext";
import { render, waitFor, within } from "@/test-utils";
import { applicationFactory } from "@/test-utils/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "@/test-utils/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/test-utils/factories/auth/UserFactory";
import { TestRouter } from "@/test-utils/TestRouter";

import FormView from "./FormView";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUsePageTitle = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const mockUseFormMode = vi.fn();
vi.mock("../../hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

vi.mock("../../hooks/usePageTitle", () => ({
  default: (title: string) => mockUsePageTitle(title),
}));

let mockFormObject: FormObject | null = null;

vi.mock("./sections", () => ({
  default: ({ refs }: FormSectionProps) => {
    if (refs?.getFormObjectRef) {
      refs.getFormObjectRef.current = () => mockFormObject;
    }
    return <div data-testid="mock-section">Mock Section</div>;
  },
}));

vi.mock("../../components/PageBanner", () => ({
  default: () => <div data-testid="mock-page-banner">Mock Banner</div>,
}));

vi.mock("../../components/ProgressBar/ProgressBar", () => ({
  default: () => <div data-testid="mock-progress-bar">Mock ProgressBar</div>,
}));

vi.mock("../../components/StatusBar/StatusBar", () => ({
  default: () => <div data-testid="mock-status-bar">Mock StatusBar</div>,
}));

vi.mock("../../components/SuspenseLoader", () => ({
  default: () => <div data-testid="mock-loader">Loading...</div>,
}));

vi.mock("../../components/CancelApplicationButton", () => ({
  default: () => <div data-testid="mock-cancel-button">Cancel</div>,
}));

const completedSections: Section[] = [
  { name: "A", status: "Completed" },
  { name: "B", status: "Completed" },
  { name: "C", status: "Completed" },
  { name: "D", status: "Completed" },
];

const baseFormCtxState: FormContextState = {
  status: FormStatus.LOADED,
  formRef: { current: null },
  data: applicationFactory.build({
    _id: "test-app-id",
    status: "In Review",
    questionnaireData: {
      sections: completedSections,
    } as QuestionnaireData,
  }),
  approveForm: vi.fn(),
  inquireForm: vi.fn(),
  rejectForm: vi.fn(),
};

const baseAuthCtxState: AuthContextState = authCtxStateFactory.build({
  status: AuthStatus.LOADED,
  isLoggedIn: true,
  user: userFactory.build({
    _id: "reviewer-user",
    role: "Admin",
    permissions: [
      "submission_request:view",
      "submission_request:create",
      "submission_request:submit",
      "submission_request:review",
    ],
  }),
});

type ParentProps = {
  formCtxState?: FormContextState;
  authCtxState?: AuthContextState;
  section?: string;
  initialEntries?: MemoryRouterProps["initialEntries"];
};

const TestParent: FC<ParentProps> = ({
  formCtxState = baseFormCtxState,
  authCtxState = baseAuthCtxState,
  section = "REVIEW",
  initialEntries = [`/submission-request/test-app-id/${section}`],
}) => (
  <TestRouter initialEntries={initialEntries}>
    <AuthContext.Provider value={authCtxState}>
      <FormContext.Provider value={formCtxState}>
        <FormView section={section} />
      </FormContext.Provider>
    </AuthContext.Provider>
  </TestRouter>
);

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormObject = null;
  });

  it("should have no violations", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { container } = render(<TestParent />);

    const result = await axe(container);
    expect(result).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormObject = null;
  });

  it("should render without crashing", () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { getByTestId } = render(<TestParent />);

    expect(getByTestId("mock-page-banner")).toBeInTheDocument();
    expect(getByTestId("mock-section")).toBeInTheDocument();
  });

  it("should render Edit mode controls on a non-review section", () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const { getByText, queryByRole } = render(<TestParent section="A" />);

    expect(getByText("Save")).toBeInTheDocument();
    expect(getByText("Next")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(
      queryByRole("button", { name: "Request Additional Information" })
    ).not.toBeInTheDocument();
  });

  it("should render Review mode controls on the review section", () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { getByRole, queryByText } = render(<TestParent section="REVIEW" />);

    expect(getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Request Additional Information" })).toBeInTheDocument();
    expect(queryByText("Save")).not.toBeInTheDocument();
    expect(queryByText("Next")).not.toBeInTheDocument();
  });

  it("should set the page title without the legacy new id", () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const newFormState: FormContextState = {
      ...baseFormCtxState,
      data: applicationFactory.build({
        ...baseFormCtxState.data,
        _id: "new",
        questionnaireData: baseFormCtxState.data.questionnaireData,
      }),
    };

    render(
      <TestParent
        section="A"
        initialEntries={["/submission-request/new/A"]}
        formCtxState={newFormState}
      />
    );

    expect(mockUsePageTitle).toHaveBeenCalledWith("Submission Request");
  });

  it("should replace the temporary new route with the persisted id after save", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const newFormState: FormContextState = {
      ...baseFormCtxState,
      data: applicationFactory.build({
        ...baseFormCtxState.data,
        _id: "new",
        questionnaireData: baseFormCtxState.data.questionnaireData,
      }),
    };

    const savedFormState: FormContextState = {
      ...baseFormCtxState,
      data: applicationFactory.build({
        ...baseFormCtxState.data,
        _id: "persisted-form-id",
        questionnaireData: baseFormCtxState.data.questionnaireData,
      }),
    };

    const { rerender } = render(
      <TestParent
        section="A"
        initialEntries={["/submission-request/new/A"]}
        formCtxState={newFormState}
      />
    );

    rerender(
      <TestParent
        section="A"
        initialEntries={["/submission-request/new/A"]}
        formCtxState={savedFormState}
      />
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/submission-request/persisted-form-id/A", {
        replace: true,
        preventScrollReset: true,
      });
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormObject = null;
  });

  it("should render the Approve ReviewFormDialog with correct props", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { getByText, getByRole } = render(<TestParent />);

    userEvent.click(getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(getByText("Approve Submission Request")).toBeInTheDocument();
    });
    expect(getByText("Confirm to Approve")).toBeInTheDocument();
    expect(getByText("Require Data Model changes")).toBeInTheDocument();
    expect(
      getByText("Require Risk Mitigation document & De-identification protocol")
    ).toBeInTheDocument();
  });

  it("should send the correct properties to approveForm on confirm", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });
    mockFormObject = {
      ref: { current: document.createElement("form") },
      data: {
        sections: completedSections,
      } as QuestionnaireData,
    };

    const { getByRole, getByTestId } = render(<TestParent />);

    userEvent.click(getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(getByTestId("pendingModelChange-checkbox")).toBeInTheDocument();
    });

    userEvent.click(getByTestId("pendingModelChange-checkbox"));
    userEvent.click(getByTestId("pendingImageDeIdentification-checkbox"));

    const textarea = within(getByTestId("review-comment")).getByRole("textbox");
    userEvent.type(textarea, "Approved with conditions");

    userEvent.click(getByTestId("review-form-dialog-confirm-button"));

    await waitFor(() => {
      expect(baseFormCtxState.approveForm).toHaveBeenCalledWith(
        {
          reviewComment: "Approved with conditions",
          pendingModelChange: true,
          pendingImageDeIdentification: true,
        },
        true
      );
    });
  });

  it("should render the Reject ReviewFormDialog with correct props", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { getByText, getByRole } = render(<TestParent />);

    userEvent.click(getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(getByText("Reject Submission Request")).toBeInTheDocument();
    });
    expect(getByText("Confirm to Reject")).toBeInTheDocument();
  });

  it("should render the Inquire ReviewFormDialog with correct props", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Review", readOnlyInputs: true });

    const { getByText, getByRole } = render(<TestParent />);

    userEvent.click(getByRole("button", { name: "Request Additional Information" }));

    await waitFor(() => {
      expect(getByText("Request Additional Changes")).toBeInTheDocument();
    });
    expect(getByText("Confirm to move to Inquired")).toBeInTheDocument();
  });

  it("should indicate that changes were saved if any portion of the form has data", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const mockSections: Section[] = [
      { name: "A", status: "Not Started" },
      { name: "B", status: "Not Started" },
      { name: "C", status: "In Progress" }, // Triggers the specific message
      { name: "D", status: "Not Started" },
    ];

    mockFormObject = {
      ref: { current: document.createElement("form") },
      data: { sections: mockSections } as QuestionnaireData,
    };

    const setDataMock = vi
      .fn()
      .mockResolvedValue({ status: "success", id: baseFormCtxState.data._id });

    const formCtxState: FormContextState = {
      ...baseFormCtxState,
      setData: setDataMock,
    };

    const { getByText } = render(<TestParent section="A" formCtxState={formCtxState} />);

    userEvent.click(getByText("Save"));

    await waitFor(() => {
      expect(setDataMock).toHaveBeenCalled();
    });

    expect(global.mockEnqueue).toHaveBeenCalledWith(
      "Your changes for the Principal Investigator and Contact section have been successfully saved.",
      { variant: "success" }
    );
  });

  // NOTE: This is a slight variant of the above scenario, but testing for "new" UUIDs
  it("should indicate that changes were saved if any portion of the form has data (new UUID)", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const mockSections: Section[] = [
      { name: "A", status: "Not Started" },
      { name: "B", status: "In Progress" }, // Triggers the specific message
      { name: "C", status: "Not Started" },
      { name: "D", status: "Not Started" },
    ];

    const mockFormElement = document.createElement("form");
    Object.defineProperty(mockFormElement, "checkValidity", {
      value: vi.fn(() => false),
    });

    mockFormObject = {
      ref: { current: mockFormElement },
      data: { sections: mockSections } as QuestionnaireData,
    };

    const setDataMock = vi.fn().mockResolvedValue({ status: "success", id: "new" });

    const formCtxState: FormContextState = {
      ...baseFormCtxState,
      setData: setDataMock,
    };

    const { getByText } = render(<TestParent section="A" formCtxState={formCtxState} />);

    userEvent.click(getByText("Save"));

    await waitFor(() => {
      expect(setDataMock).toHaveBeenCalled();
    });

    expect(global.mockEnqueue).toHaveBeenCalledWith(
      "Your changes for the Principal Investigator and Contact section have been successfully saved.",
      { variant: "success" }
    );
  });

  it("should show new success snackbar when saving a section for a form with no data", async () => {
    mockUseFormMode.mockReturnValue({ formMode: "Edit", readOnlyInputs: false });

    const mockSections: Section[] = [
      { name: "A", status: "Not Started" },
      { name: "B", status: "Not Started" },
      { name: "C", status: "Not Started" },
      { name: "D", status: "Not Started" },
    ];

    const mockFormElement = document.createElement("form");
    Object.defineProperty(mockFormElement, "checkValidity", {
      value: vi.fn(() => false),
    });

    mockFormObject = {
      ref: { current: mockFormElement },
      data: { sections: mockSections } as QuestionnaireData,
    };

    const setDataMock = vi.fn().mockResolvedValue({ status: "success", id: "new" });

    const newFormState: FormContextState = {
      ...baseFormCtxState,
      data: applicationFactory.build({
        ...baseFormCtxState.data,
        _id: "new",
      }),
      setData: setDataMock,
    };

    const { getByText } = render(<TestParent section="A" formCtxState={newFormState} />);

    userEvent.click(getByText("Save"));

    await waitFor(() => {
      expect(setDataMock).toHaveBeenCalled();
    });

    expect(global.mockEnqueue).toHaveBeenCalledWith(
      "The Principal Investigator and Contact section has been successfully saved.",
      { variant: "success" }
    );
  });
});
