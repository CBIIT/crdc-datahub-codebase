import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { studyFactory } from "@/factories/application/StudyFactory";

import { render, waitFor } from "../../test-utils";
import { ContextState, Context as AuthCtx, Status as AuthStatus } from "../Contexts/AuthContext";
import {
  ContextState as FormContextState,
  Context as FormContext,
  Status as FormStatus,
} from "../Contexts/FormContext";

import ExportRequestButton from "./index";

const mockGenerate = vi.fn();
vi.mock("./pdf/Generate", () => ({
  GenerateDocument: (...args) => mockGenerate(...args),
}));

const mockDownloadBlob = vi.fn();
vi.mock("../../utils", async () => ({
  ...(await vi.importActual("../../utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

type TestParentProps = {
  /**
   * The status of the form context.
   */
  formStatus?: FormStatus;
  /**
   * The form data to provide to the form context.
   */
  formData?: Partial<Application>;
  /**
   * The role of the "current user" viewing the element
   */
  userRole?: UserRole;
  /**
   * The element to use as the print region for the PDF.
   */
  printRegion?: React.ReactNode;
  /**
   * The children to render within the test parent.
   */
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({
  formStatus = FormStatus.LOADED,
  formData = {},
  userRole = "User",
  printRegion = <div data-pdf-print-region="1" />,
  children,
}: TestParentProps) => {
  const formValue = useMemo<FormContextState>(
    () => ({
      ...formContextStateFactory.build({
        status: formStatus,
        data:
          formStatus === FormStatus.LOADED
            ? applicationFactory.build({
                ...formData,
                questionnaireData: questionnaireDataFactory.build({
                  ...formData?.questionnaireData,
                }),
              })
            : null,
      }),
    }),
    [formStatus, formData]
  );

  const authValue = useMemo<ContextState>(
    () => ({
      status: AuthStatus.LOADED,
      user: { role: userRole } as User,
      isLoggedIn: true,
    }),
    [userRole]
  );

  return (
    <AuthCtx.Provider value={authValue}>
      <FormContext.Provider value={formValue}>
        {printRegion}
        {children}
      </FormContext.Provider>
    </AuthCtx.Provider>
  );
};

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not have any violations", async () => {
    const { container } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations (hover)", async () => {
    const { container, getByTestId, getByRole } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    userEvent.hover(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations (disabled)", async () => {
    const { container } = render(<ExportRequestButton disabled />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should render without crashing", () => {
    expect(() =>
      render(<ExportRequestButton />, { wrapper: (p) => <TestParent {...p} /> })
    ).not.toThrow();
  });

  it("should disable the button when building the document", async () => {
    mockGenerate.mockImplementation(
      () =>
        new Promise((res) => {
          setTimeout(() => {
            res("mock pdf data"); // NOTE: This is a placeholder value.
          }, 1000);
        })
    );

    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    userEvent.click(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(getByTestId("export-submission-request-button")).toBeDisabled();
    });

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("should disable the button when the disabled prop is passed", () => {
    const { getByTestId } = render(<ExportRequestButton disabled />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    expect(getByTestId("export-submission-request-button")).toBeDisabled();
  });

  it("should disable the button when the FormContext is not loaded", () => {
    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent formStatus={FormStatus.LOADING} {...p} />,
    });

    expect(getByTestId("export-submission-request-button")).toBeDisabled();
  });

  it("should display an error message on failed export", async () => {
    vi.spyOn(console, "error").mockImplementation(() => null);

    mockGenerate.mockRejectedValue(new Error("mock error"));

    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    userEvent.click(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while exporting the Submission Request to PDF.",
        { variant: "error" }
      );
    });
  });

  it("should display an error message if no print region is found", async () => {
    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent printRegion={null} {...p} />,
    });

    userEvent.click(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "An error occurred while exporting the Submission Request to PDF.",
        { variant: "error" }
      );
    });
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TZ = "UTC";
  });

  it("should have a tooltip on hover", async () => {
    const { getByTestId, getByRole, queryByRole } = render(<ExportRequestButton />, {
      wrapper: (p) => <TestParent {...p} />,
    });

    userEvent.hover(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByRole("tooltip")).toHaveTextContent(
      "Click to export this Submission Request as a PDF."
    );

    userEvent.unhover(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  // NOTE: This component does not currently implement any authorization,
  // this is just future-proofing test coverage.
  it.each<UserRole>(["User", "Submitter", "Federal Lead", "Admin", "fake role" as UserRole])(
    "should be enabled for the user role %s if they can access the page",
    (role) => {
      const { getByTestId } = render(<ExportRequestButton />, {
        wrapper: (p) => <TestParent userRole={role} {...p} />,
      });

      expect(getByTestId("export-submission-request-button")).toBeEnabled();
    }
  );

  it("should format the PDF filename as 'CRDCSubmissionPortal-Request-{studyAbbr}-{submittedDate}.pdf'", async () => {
    mockGenerate.mockImplementation(
      () =>
        new Promise((res) => {
          res("mock-data");
        })
    );

    const mockFormObject: Partial<Application> = {
      status: "Submitted",
      updatedAt: "2024-09-30T09:10:00.000Z",
      submittedDate: "2024-09-30T09:10:00.000Z",
      questionnaireData: questionnaireDataFactory.build({
        study: studyFactory.build({
          abbreviation: "TEST",
          name: "Test Study",
        }),
      }),
      history: [],
    };

    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => (
        <TestParent formStatus={FormStatus.LOADED} formData={mockFormObject} {...p} />
      ),
    });

    userEvent.click(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        "mock-data",
        "CRDCSubmissionPortal-Request-TEST-2024-09-30.pdf",
        "application/pdf"
      );
    });
  });

  it.each(["", null, undefined])(
    "should fallback to the study name if the abbreviation is not provided",
    async (abbreviation) => {
      mockGenerate.mockImplementation(
        () =>
          new Promise((res) => {
            res("mock-data");
          })
      );

      const mockFormObject: Partial<Application> = {
        status: "Submitted",
        updatedAt: "2024-09-30T09:10:00.000Z",
        submittedDate: "2024-09-30T09:10:00.000Z",
        questionnaireData: questionnaireDataFactory.build({
          study: studyFactory.build({
            abbreviation,
            name: "Test Study",
          }),
        }),
        history: [],
      };

      const { getByTestId } = render(<ExportRequestButton />, {
        wrapper: (p) => (
          <TestParent formStatus={FormStatus.LOADED} formData={mockFormObject} {...p} />
        ),
      });

      userEvent.click(getByTestId("export-submission-request-button"));

      await waitFor(() => {
        expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
        expect(mockDownloadBlob).toHaveBeenCalledWith(
          "mock-data",
          "CRDCSubmissionPortal-Request-Test Study-2024-09-30.pdf",
          "application/pdf"
        );
      });
    }
  );

  it("should use the updatedAt date if the status is 'In Progress'", async () => {
    mockGenerate.mockImplementation(
      () =>
        new Promise((res) => {
          res("mock-data");
        })
    );

    const mockFormObject: Partial<Application> = {
      status: "In Progress",
      updatedAt: "2024-09-30T09:10:00.000Z",
      submittedDate: "2024-10-22T14:10:00.000Z",
      questionnaireData: questionnaireDataFactory.build({
        study: studyFactory.build({
          abbreviation: "TEST",
          name: "Test Study",
        }),
      }),
      history: [],
    };

    const { getByTestId } = render(<ExportRequestButton />, {
      wrapper: (p) => (
        <TestParent formStatus={FormStatus.LOADED} formData={mockFormObject} {...p} />
      ),
    });

    userEvent.click(getByTestId("export-submission-request-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        "mock-data",
        "CRDCSubmissionPortal-Request-TEST-2024-09-30.pdf",
        "application/pdf"
      );
    });
  });
});
