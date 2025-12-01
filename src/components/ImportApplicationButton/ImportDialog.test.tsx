import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { fireEvent, render } from "@/test-utils";
import { Logger } from "@/utils";

import { Context as AuthCtx, ContextState as AuthCtxState } from "../Contexts/AuthContext";
import {
  ContextState as FormContextState,
  Context as FormContext,
  Status as FormStatus,
} from "../Contexts/FormContext";

import ImportDialog from "./ImportDialog";

type ParentProps = {
  mocks?: MockedResponse[];
  authCtxState?: AuthCtxState;
  formCtxState?: FormContextState;
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
        data:
          formCtxState?.status === FormStatus.LOADED
            ? applicationFactory.build({
                ...formCtxState?.data,
                questionnaireData: questionnaireDataFactory.build({
                  ...formCtxState?.data?.questionnaireData,
                }),
                applicant: applicantFactory.build({ applicantID: "current-user" }),
              })
            : null,
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
  it("should not have any violations (open)", async () => {
    const { container } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should not have any violations (closed)", async () => {
    const { container } = render(
      <TestParent>
        <ImportDialog open={false} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    expect(getByTestId("import-dialog")).toBeVisible();
  });

  it("should call onClose when close icon is clicked", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open onClose={onClose} />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-dialog-close-icon-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open onClose={onClose} />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-dialog-cancel-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should call onConfirm with file when Import button is clicked", async () => {
    const onConfirm = vi.fn();
    const file = new File(["test"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open onConfirm={onConfirm} />
      </TestParent>
    );

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(getByTestId("import-dialog-confirm-button"));
    expect(onConfirm).toHaveBeenCalledWith(file);
  });

  it("should not call onConfirm if no file is selected", () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open onConfirm={onConfirm} />
      </TestParent>
    );

    fireEvent.click(getByTestId("import-dialog-confirm-button"));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("Implementation Requirements", () => {
  it("should display title, header, and description correctly", () => {
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    expect(getByTestId("import-dialog-title")).toHaveTextContent("Submission Request Form");
    expect(getByTestId("import-dialog-header")).toHaveTextContent("Import from File");
    expect(getByTestId("import-dialog-description")).toHaveTextContent(
      "Importing a file will overwrite any data you have entered so far. Do you want to proceed?"
    );
  });

  it("should trigger file input when clicking the outlined input", () => {
    const { getByTestId, getByPlaceholderText } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    const hiddenInput = getByTestId("import-upload-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(hiddenInput, "click");

    fireEvent.click(getByPlaceholderText("Choose Excel Files"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("should set file name when valid .xlsx file is selected", () => {
    const { getByTestId, getByDisplayValue } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    const file = new File(["test"], "valid.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(getByDisplayValue("valid.xlsx")).toBeInTheDocument();
  });

  it("should log error and not set file name when invalid file type is selected", () => {
    const loggerSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    const { getByTestId, getByPlaceholderText } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    const file = new File(["test"], "invalid.txt", { type: "text/plain" });

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(loggerSpy).toHaveBeenCalledWith("ImportApplicationButton: Unsupported file format");
    expect(getByPlaceholderText("Choose Excel Files")).toHaveValue("");
    loggerSpy.mockRestore();
  });

  it("should log error when no file is selected", () => {
    const loggerSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    const { getByTestId } = render(
      <TestParent>
        <ImportDialog open />
      </TestParent>
    );

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(loggerSpy).toHaveBeenCalledWith("ImportApplicationButton: No file selected");
    loggerSpy.mockRestore();
  });

  it("should call onError when invalid file type is selected", () => {
    const onError = vi.fn();
    const loggerSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    const { getByTestId, getByPlaceholderText } = render(
      <TestParent>
        <ImportDialog open onError={onError} />
      </TestParent>
    );

    const file = new File(["test"], "invalid.txt", { type: "text/plain" });

    const input = getByTestId("import-upload-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(loggerSpy).toHaveBeenCalledWith("ImportApplicationButton: Unsupported file format");
    expect(onError).toHaveBeenCalledWith(
      "Import failed. Your data could not be imported. Please check the file format and template, then try again."
    );
    expect(getByPlaceholderText("Choose Excel Files")).toHaveValue("");
    loggerSpy.mockRestore();
  });
});
