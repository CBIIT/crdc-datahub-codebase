import userEvent from "@testing-library/user-event";
import React from "react";

import { Status as AuthStatus } from "@/components/Contexts/AuthContext";
import { Status as FormStatus } from "@/components/Contexts/FormContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { act, render, screen, waitFor, within } from "@/test-utils";

import FormView from "./FormView";

const mocked = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: "/submission-request/new/A",
    search: "",
    hash: "",
  },
  blocker: {
    location: {
      pathname: "/submission-request/new/B",
      search: "",
      hash: "",
    },
    proceed: vi.fn(),
    reset: vi.fn(),
  },
  blockerCallback: null as (() => boolean) | null,
  useFormContext: vi.fn(),
  useAuthContext: vi.fn(),
  useFormMode: vi.fn(),
  hasPermission: vi.fn(),
  usePageTitle: vi.fn(),
  getSectionData: vi.fn(),
  checkValidity: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocked.navigate,
    useLocation: () => mocked.location,
    useBlocker: (handler: () => boolean) => {
      mocked.blockerCallback = handler;
      return mocked.blocker;
    },
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("../../hooks/usePageTitle", () => ({
  default: (title: string) => mocked.usePageTitle(title),
}));

vi.mock("../../hooks/useFormMode", () => ({
  default: () => mocked.useFormMode(),
}));

vi.mock("../../config/AuthPermissions", () => ({
  hasPermission: (...args: unknown[]) => mocked.hasPermission(...args),
}));

vi.mock("../../components/Contexts/FormContext", async () => {
  const actual = await vi.importActual("../../components/Contexts/FormContext");
  return {
    ...actual,
    useFormContext: () => mocked.useFormContext(),
  };
});

vi.mock("../../components/Contexts/AuthContext", async () => {
  const actual = await vi.importActual("../../components/Contexts/AuthContext");
  return {
    ...actual,
    useAuthContext: () => mocked.useAuthContext(),
  };
});

vi.mock("../../components/StatusBar/StatusBar", () => ({
  default: () => <div data-testid="status-bar" />,
}));

vi.mock("../../components/ProgressBar/ProgressBar", () => ({
  default: ({ section }: { section: string }) => <div data-testid="progress-bar">{section}</div>,
}));

vi.mock("../../components/CancelApplicationButton", () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <button onClick={onCancel} type="button">
      Cancel Request
    </button>
  ),
}));

vi.mock("./sections", () => ({
  default: ({ refs }: { refs: FormSectionProps["refs"] }) => {
    refs.getFormObjectRef.current = () => ({
      ref: {
        current: {
          checkValidity: () => mocked.checkValidity(),
        },
      } as React.RefObject<HTMLFormElement>,
      data: mocked.getSectionData(),
    });
    return <div data-testid="questionnaire-section" />;
  },
}));

type RenderOptions = {
  section?: string;
  formContext?: Partial<ReturnType<typeof mocked.useFormContext>>;
  authContext?: Partial<ReturnType<typeof mocked.useAuthContext>>;
  formMode?: ReturnType<typeof mocked.useFormMode>;
};

const buildDefaultData = () =>
  applicationFactory.build({
    _id: "new",
    status: "New",
    applicant: {
      applicantID: "user-1",
      applicantName: "Test User",
      applicantEmail: "test@example.com",
    },
    questionnaireData: questionnaireDataFactory.build({
      sections: [
        { name: "A", status: "Not Started" },
        { name: "B", status: "Not Started" },
      ],
    }),
  });

const renderView = ({ section = "A", formContext, authContext, formMode }: RenderOptions = {}) => {
  const baseData = buildDefaultData();

  mocked.useFormContext.mockReturnValue({
    status: FormStatus.LOADED,
    data: baseData,
    setData: vi.fn().mockResolvedValue({ status: "success", id: "saved-id" }),
    submitData: vi.fn().mockResolvedValue("saved-id"),
    approveForm: vi.fn().mockResolvedValue({ status: "success", id: "saved-id" }),
    inquireForm: vi.fn().mockResolvedValue("saved-id"),
    rejectForm: vi.fn().mockResolvedValue("saved-id"),
    reopenForm: vi.fn().mockResolvedValue("saved-id"),
    error: null,
    ...formContext,
  });

  mocked.useAuthContext.mockReturnValue({
    status: AuthStatus.LOADED,
    isLoggedIn: true,
    user: userFactory.build({
      _id: "user-1",
      role: "Submitter",
      permissions: ["submission_request:create", "submission_request:submit"],
    }),
    ...authContext,
  });

  mocked.useFormMode.mockReturnValue(
    formMode || {
      formMode: "Edit",
      readOnlyInputs: false,
    }
  );

  mocked.hasPermission.mockReturnValue(true);
  mocked.checkValidity.mockReturnValue(true);
  mocked.getSectionData.mockReturnValue(baseData.questionnaireData);

  return render(<FormView section={section} />);
};

describe("FormView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.location.pathname = "/submission-request/new/A";
    mocked.location.search = "";
    mocked.location.hash = "";
    mocked.blocker.location.pathname = "/submission-request/new/B";
    mocked.blocker.location.search = "";
    mocked.blocker.location.hash = "";
    mocked.blockerCallback = null;
  });

  it("sets the page title with the current submission id", () => {
    renderView();
    expect(mocked.usePageTitle).toHaveBeenCalledWith("Submission Request new");
  });

  it("shows a loading spinner while form or auth context is loading", () => {
    const { rerender } = renderView({
      formContext: {
        status: FormStatus.LOADING,
      },
    });

    expect(screen.getByLabelText("Content Loader")).toBeInTheDocument();

    mocked.useFormContext.mockReturnValue({
      ...mocked.useFormContext.mock.results[0].value,
      status: FormStatus.LOADED,
    });
    mocked.useAuthContext.mockReturnValue({
      ...mocked.useAuthContext.mock.results[0].value,
      status: AuthStatus.LOADING,
    });

    rerender(<FormView section="A" />);
    expect(screen.getByLabelText("Content Loader")).toBeInTheDocument();
  });

  it("returns null when auth context is in error state", () => {
    const { queryByText } = renderView({
      authContext: {
        status: AuthStatus.ERROR,
      },
    });

    expect(queryByText("Submission Request Form")).not.toBeInTheDocument();
  });

  it("redirects to the list view when form load fails without data", () => {
    const { getByTestId } = renderView({
      formContext: {
        status: FormStatus.ERROR,
        data: null,
        error: "Unable to load form",
      },
    });

    expect(getByTestId("navigate")).toHaveAttribute("data-to", "/submission-requests");
  });

  it("navigates to the next section when clicking Next", async () => {
    renderView({
      formContext: {
        data: {
          ...buildDefaultData(),
          _id: "existing-id",
        },
      },
    });

    userEvent.click(document.getElementById("submission-form-next-button") as HTMLElement);

    expect(mocked.navigate).toHaveBeenCalledWith("/submission-request/existing-id/B", {
      preventScrollReset: true,
    });
  });

  it("disables Next on section D until all sections are complete", async () => {
    renderView({
      section: "D",
      formContext: {
        data: {
          ...buildDefaultData(),
          _id: "existing-id",
          questionnaireData: questionnaireDataFactory.build({
            sections: [{ name: "A", status: "Not Started" }],
          }),
        },
      },
    });

    const nextButton = document.getElementById("submission-form-next-button") as HTMLButtonElement;
    expect(nextButton).toBeDisabled();
  });

  it("saves form data and replaces /new/ with persisted id", async () => {
    const setData = vi.fn().mockResolvedValue({ status: "success", id: "uuid-123" });

    renderView({
      formContext: {
        setData,
      },
    });

    userEvent.click(document.getElementById("submission-form-save-button") as HTMLElement);

    await waitFor(() => {
      expect(setData).toHaveBeenCalled();
      expect(mocked.navigate).toHaveBeenCalledWith("/submission-request/uuid-123/A", {
        replace: true,
        preventScrollReset: true,
      });
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Your changes for the Principal Investigator and Contact section have been successfully saved.",
        { variant: "success" }
      );
    });
  });

  it("shows save error snackbar when setData fails", async () => {
    const setData = vi.fn().mockResolvedValue({
      status: "failed",
      errorMessage: "Unable to save",
    });

    renderView({
      formContext: {
        setData,
      },
    });

    userEvent.click(document.getElementById("submission-form-save-button") as HTMLElement);

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while saving the Principal Investigator and Contact section.",
        { variant: "error" }
      );
    });
  });

  it("opens submit dialog in review section", async () => {
    renderView({
      section: "REVIEW",
    });

    userEvent.click(document.getElementById("submission-form-submit-button") as HTMLElement);

    expect(screen.getByText("Submit Request")).toBeInTheDocument();
  });

  it("opens approve dialog in review mode", () => {
    renderView({
      section: "REVIEW",
      formMode: {
        formMode: "Review",
        readOnlyInputs: true,
      },
    });

    userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText("Approve Submission Request")).toBeInTheDocument();
  });

  it("opens inquire dialog in review mode", () => {
    renderView({
      section: "REVIEW",
      formMode: {
        formMode: "Review",
        readOnlyInputs: true,
      },
    });

    userEvent.click(screen.getByRole("button", { name: "Request Additional Information" }));
    expect(screen.getByText("Request Additional Changes")).toBeInTheDocument();
  });

  it("opens reject dialog in review mode", () => {
    renderView({
      section: "REVIEW",
      formMode: {
        formMode: "Review",
        readOnlyInputs: true,
      },
    });

    userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText("Reject Submission Request")).toBeInTheDocument();
  });

  it("opens unsaved changes dialog when blocker intercepts invalid navigation", async () => {
    const dirtyData = questionnaireDataFactory.build({
      submitterComment: "changed",
      sections: [{ name: "A", status: "Not Started" }],
    });

    renderView({
      formContext: {
        data: {
          ...buildDefaultData(),
          questionnaireData: questionnaireDataFactory.build({
            sections: [{ name: "A", status: "Not Started" }],
          }),
        },
      },
    });

    mocked.getSectionData.mockReturnValue(dirtyData);
    mocked.checkValidity.mockReturnValue(false);

    act(() => {
      expect(mocked.blockerCallback?.()).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    });
  });

  it("saves from unsaved changes dialog, closes prompt, and navigates with persisted id", async () => {
    const setData = vi.fn().mockResolvedValue({ status: "success", id: "uuid-123" });
    const dirtyData = questionnaireDataFactory.build({
      submitterComment: "changed",
      sections: [{ name: "A", status: "Not Started" }],
    });

    mocked.blocker.location.pathname = "/submission-request/new/B";

    renderView({
      formContext: {
        setData,
      },
    });

    mocked.getSectionData.mockReturnValue(dirtyData);
    mocked.checkValidity.mockReturnValue(false);

    act(() => {
      expect(mocked.blockerCallback?.()).toBe(true);
    });

    const dialog = await screen.findByRole("dialog");
    userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(setData).toHaveBeenCalled();
      expect(mocked.blocker.reset).toHaveBeenCalled();
      expect(mocked.navigate).toHaveBeenCalledWith("/submission-request/uuid-123/B", {
        replace: true,
        preventScrollReset: true,
      });
      expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
    });
  });

  it("discards from unsaved changes dialog and continues blocked navigation", async () => {
    const dirtyData = questionnaireDataFactory.build({
      submitterComment: "changed",
      sections: [{ name: "A", status: "Not Started" }],
    });

    renderView();

    mocked.getSectionData.mockReturnValue(dirtyData);
    mocked.checkValidity.mockReturnValue(false);

    act(() => {
      expect(mocked.blockerCallback?.()).toBe(true);
    });

    const dialog = await screen.findByRole("dialog");
    userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(mocked.blocker.proceed).toHaveBeenCalled();
      expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
    });
  });
});
