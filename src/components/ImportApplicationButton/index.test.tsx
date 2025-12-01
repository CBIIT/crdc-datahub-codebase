import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC, useMemo } from "react";
import { Mock } from "vitest";
import { axe } from "vitest-axe";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { historyEventFactory } from "@/factories/application/HistoryEventFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import useFormMode from "@/hooks/useFormMode";
import { fireEvent, render, waitFor } from "@/test-utils";

import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import {
  ContextState as FormContextState,
  Context as FormContext,
  Status as FormStatus,
} from "../Contexts/FormContext";

import { IMPORT_ERROR_MESSAGE } from "./ImportDialog";
import ImportApplicationButton from "./index";

vi.mock("@/hooks/useFormMode", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/useFormMode")>("@/hooks/useFormMode")),
  __esModule: true,
  default: vi.fn(),
}));

vi.mock("@/classes/QuestionnaireExcelMiddleware", async () => ({
  QuestionnaireExcelMiddleware: {
    parse: vi.fn(),
  },
}));

type ParentProps = {
  mocks?: MockedResponse[];
  authCtxState?: AuthCtxState;
  formCtxState?: Partial<Omit<FormContextState, "data">> & { data?: RecursivePartial<Application> };
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({
  authCtxState,
  formCtxState,
  mocks = [],
  children,
}: ParentProps) => {
  const formValue = useMemo<FormContextState>(
    () =>
      formContextStateFactory.build({
        ...formCtxState,
        status: FormStatus.LOADED,
        data: applicationFactory.build({
          ...formCtxState?.data,
          _id: "application-1",
          history: historyEventFactory.build(1),
          applicant: applicantFactory.build({ applicantID: "current-user" }),
          newInstitutions: [],
          questionnaireData: questionnaireDataFactory.build(),
        }) as Application,
        submitData: vi.fn(),
        reopenForm: vi.fn(),
        approveForm: vi.fn(),
        inquireForm: vi.fn(),
        rejectForm: vi.fn(),
        setData: (formCtxState?.setData as FormContextState["setData"]) ?? vi.fn(),
      }),
    [formCtxState]
  );

  const authValue = useMemo<AuthCtxState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ _id: "current-user", ...authCtxState?.user }),
      }),
    [authCtxState]
  );

  return (
    <AuthCtx.Provider value={authValue}>
      <FormContext.Provider value={formValue}>
        <MockedProvider mocks={mocks} showWarnings>
          {children}
        </MockedProvider>
      </FormContext.Provider>
    </AuthCtx.Provider>
  );
};

describe("Accessibility", () => {
  it("should not have any violations", async () => {
    (useFormMode as Mock).mockReturnValue({ readOnlyInputs: false });

    const { container } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useFormMode as Mock).mockReturnValue({ readOnlyInputs: false });
  });

  it("should render a button with the correct text", () => {
    const { getByText, getByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton />
      </TestParent>
    );

    expect(getByTestId("import-application-excel-button")).toBeVisible();
    expect(getByText("Import Form")).toBeInTheDocument();
  });

  it("should open dialog when button is clicked", () => {
    const { getByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));
    expect(getByTestId("import-dialog")).toBeVisible();
  });

  it("should not open dialog when disabled", () => {
    const { getByTestId, queryByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton disabled />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));
    expect(queryByTestId("import-dialog")).not.toBeInTheDocument();
  });

  it("should call setData with parsed data and close dialog on import", async () => {
    const setData = vi.fn().mockReturnValue({ status: "success", id: "success-id" });
    const parsedData = { some: "data" };
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockResolvedValue(parsedData);

    const { getByTestId, getByDisplayValue } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByDisplayValue("test.xlsx")).toBeInTheDocument();
    });

    const confirmButton = getByTestId("import-dialog-confirm-button");
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(getByTestId("import-dialog-confirm-button")).toBeDisabled();
    });

    await waitFor(() => {
      expect(QuestionnaireExcelMiddleware.parse).toHaveBeenCalled();
      expect(setData).toHaveBeenCalledWith(parsedData, { skipSave: false });
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalled();
    });
  });

  it("should do nothing if handleImport is called with no file", () => {
    const setData = vi.fn();

    const { getByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));
    fireEvent.click(getByTestId("import-dialog-confirm-button"));

    expect(setData).not.toHaveBeenCalled();
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useFormMode as Mock).mockReturnValue({ readOnlyInputs: false });
  });

  it("should show correct tooltip text", async () => {
    const { getByTestId, getByRole } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton />
      </TestParent>
    );

    userEvent.hover(getByTestId("import-application-excel-tooltip-text"));

    await waitFor(() => {
      expect(getByRole("tooltip")).toBeInTheDocument();
    });

    expect(getByRole("tooltip")).toHaveTextContent("Import the Submission Request from Excel.", {
      normalizeWhitespace: true,
    });
  });

  it.each<ApplicationStatus>(["Submitted", "Approved", "Rejected", "Canceled", "Deleted"])(
    "should disable button for status %s",
    (status: ApplicationStatus) => {
      const { getByTestId } = render(
        <TestParent formCtxState={{ data: { status }, setData: vi.fn() }}>
          <ImportApplicationButton />
        </TestParent>
      );
      expect(getByTestId("import-application-excel-button")).toBeDisabled();
    }
  );

  it("should disable button when readOnlyInputs is true", () => {
    (useFormMode as Mock).mockReturnValue({ readOnlyInputs: true });
    const { getByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData: vi.fn() }}>
        <ImportApplicationButton />
      </TestParent>
    );
    expect(getByTestId("import-application-excel-button")).toBeDisabled();
  });

  it("should disable dialog when isUploading is true", async () => {
    const setData = vi.fn().mockReturnValue({ status: "success" });
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep isUploading true
    );

    const { getByTestId } = render(
      <TestParent formCtxState={{ data: {}, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(getByTestId("import-dialog-confirm-button"));

    await waitFor(() => {
      expect(getByTestId("import-dialog-confirm-button")).toBeDisabled();
    });
  });

  it("should disable button when active section is REVIEW", () => {
    const { getByTestId } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData: vi.fn() }}>
        <ImportApplicationButton activeSection="REVIEW" />
      </TestParent>
    );

    expect(getByTestId("import-application-excel-button")).toBeDisabled();
  });

  it("should not show button when user is not the form owner", () => {
    const { queryByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({ user: userFactory.build({ _id: "other-user" }) })}
        formCtxState={{
          data: {
            status: "In Progress",
            applicant: applicantFactory.build({ applicantID: "some-user" }),
          },
          setData: vi.fn(),
        }}
      >
        <ImportApplicationButton />
      </TestParent>
    );

    expect(queryByTestId("import-application-excel-button")).not.toBeInTheDocument();
  });

  it("should enable button when user is the form owner", () => {
    const { getByTestId } = render(
      <TestParent
        authCtxState={authCtxStateFactory.build({
          user: userFactory.build({ _id: "current-user" }),
        })}
        formCtxState={{
          data: {
            status: "In Progress",
            applicant: applicantFactory.build({ applicantID: "current-user" }),
          },
          setData: vi.fn(),
        }}
      >
        <ImportApplicationButton />
      </TestParent>
    );

    expect(getByTestId("import-application-excel-button")).toBeEnabled();
  });

  it("should display an error snackbar if parsing fails", async () => {
    const setData = vi.fn().mockReturnValue({ status: "failed" });
    const parsedData = { some: "data" };
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockResolvedValue(parsedData);

    const { getByTestId, getByDisplayValue } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByDisplayValue("test.xlsx")).toBeInTheDocument();
    });

    const confirmButton = getByTestId("import-dialog-confirm-button");
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(getByTestId("import-dialog-confirm-button")).toBeDisabled();
    });

    await waitFor(() => {
      expect(QuestionnaireExcelMiddleware.parse).toHaveBeenCalled();
      expect(setData).toHaveBeenCalledWith(parsedData, { skipSave: false });
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(IMPORT_ERROR_MESSAGE, { variant: "error" });
    });
  });

  it("should display a success snackbar if the imported data fully passed validation", async () => {
    const setData = vi.fn().mockReturnValue({ status: "success", id: "success-id" });
    const parsedData: Partial<QuestionnaireData> = {
      sections: [
        { name: "A", status: "Completed" },
        { name: "B", status: "Completed" },
      ],
    };
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockResolvedValue(parsedData);

    const { getByTestId, getByDisplayValue } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByDisplayValue("test.xlsx")).toBeInTheDocument();
    });

    const confirmButton = getByTestId("import-dialog-confirm-button");
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(getByTestId("import-dialog-confirm-button")).toBeDisabled();
    });

    await waitFor(() => {
      expect(QuestionnaireExcelMiddleware.parse).toHaveBeenCalled();
      expect(setData).toHaveBeenCalledWith(parsedData, { skipSave: false });
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Your data has been imported and all passed validation. You may proceed to Review & Submit.",
        { variant: "success" }
      );
    });
  });

  it("should display a success snackbar if the imported data partially passed validation", async () => {
    const setData = vi.fn().mockReturnValue({ status: "success", id: "success-id" });
    const parsedData: Partial<QuestionnaireData> = {
      sections: [
        { name: "B", status: "Not Started" },
        { name: "C", status: "Completed" },
      ],
    };
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockResolvedValue(parsedData);

    const { getByTestId, getByDisplayValue } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByDisplayValue("test.xlsx")).toBeInTheDocument();
    });

    const confirmButton = getByTestId("import-dialog-confirm-button");
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(getByTestId("import-dialog-confirm-button")).toBeDisabled();
    });

    await waitFor(() => {
      expect(QuestionnaireExcelMiddleware.parse).toHaveBeenCalled();
      expect(setData).toHaveBeenCalledWith(parsedData, { skipSave: false });
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Your data has been imported, but some pages contain validation errors. Please review each page and resolve before submitting.",
        { variant: "success" }
      );
    });
  });

  it("should display an error snackbar when QuestionnaireExcelMiddleware.parse throws an exception", async () => {
    const setData = vi.fn();
    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");
    (QuestionnaireExcelMiddleware.parse as Mock).mockRejectedValue(
      new Error("Invalid file format")
    );

    const { getByTestId, getByDisplayValue, queryByTestId } = render(
      <TestParent formCtxState={{ data: { status: "In Progress" }, setData }}>
        <ImportApplicationButton />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-application-excel-button"));

    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Mock the arrayBuffer method
    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByDisplayValue("test.xlsx")).toBeInTheDocument();
    });

    const confirmButton = getByTestId("import-dialog-confirm-button");
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(QuestionnaireExcelMiddleware.parse).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(IMPORT_ERROR_MESSAGE, { variant: "error" });
    });

    await waitFor(() => {
      expect(queryByTestId("import-dialog")).not.toBeInTheDocument();
    });

    expect(setData).not.toHaveBeenCalled();
  });
});
