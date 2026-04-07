import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import {
  Context as AuthContext,
  ContextState as AuthContextState,
  Status as AuthStatus,
} from "../../components/Contexts/AuthContext";
import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "../../components/Contexts/FormContext";
import { render, waitFor } from "../../test-utils";
import { applicationFactory } from "../../test-utils/factories/application/ApplicationFactory";
import { authCtxStateFactory } from "../../test-utils/factories/auth/AuthCtxStateFactory";
import { userFactory } from "../../test-utils/factories/auth/UserFactory";
import { TestRouter } from "../../test-utils/TestRouter";

import FormView from "./FormView";

const mockUseFormMode = vi.fn();
vi.mock("../../hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

vi.mock("../../hooks/usePageTitle", () => ({
  default: () => {},
}));

vi.mock("./sections", () => ({
  default: () => <div data-testid="mock-section">Mock Section</div>,
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

const baseFormCtxState: FormContextState = {
  status: FormStatus.LOADED,
  formRef: { current: null },
  data: applicationFactory.build({
    _id: "test-app-id",
    status: "In Review",
    questionnaireData: {
      sections: [
        { name: "A", status: "Completed" },
        { name: "B", status: "Completed" },
        { name: "C", status: "Completed" },
        { name: "D", status: "Completed" },
      ],
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
};

const TestParent: FC<ParentProps> = ({
  formCtxState = baseFormCtxState,
  authCtxState = baseAuthCtxState,
  section = "REVIEW",
}) => (
  <TestRouter initialEntries={[`/submission-request/test-app-id/${section}`]}>
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
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
