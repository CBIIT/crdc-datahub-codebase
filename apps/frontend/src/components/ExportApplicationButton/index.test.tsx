import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { axe } from "vitest-axe";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  LIST_INSTITUTIONS,
  LIST_ORGS,
  ListInstitutionsInput,
  ListInstitutionsResp,
  ListOrgsInput,
  ListOrgsResp,
} from "@/graphql";
import { render, waitFor } from "@/test-utils";

import ExportApplicationButton from "./index";

const mockDownloadBlob = vi.fn();
vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

const serializeMock = vi.fn().mockResolvedValue(new ArrayBuffer(8));
const questionnaireExcelMiddlewareMock = vi.fn().mockImplementation(() => ({
  serialize: serializeMock,
}));
vi.mock("@/classes/QuestionnaireExcelMiddleware", () => ({
  QuestionnaireExcelMiddleware: questionnaireExcelMiddlewareMock,
}));

vi.mock("@/components/Contexts/FormContext", async () => ({
  ...(await vi.importActual("@/components/Contexts/FormContext")),
  useFormContext: vi.fn().mockImplementation(() =>
    formContextStateFactory.build({
      data: applicationFactory.build({
        questionnaireData: questionnaireDataFactory.build(),
        studyAbbreviation: "Study-Abbrev",
        version: "3.5",
      }),
    })
  ),
}));

const institutionsMock: MockedResponse<ListInstitutionsResp, ListInstitutionsInput> = {
  request: {
    query: LIST_INSTITUTIONS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listInstitutions: {
        total: 3,
        institutions: [
          ...institutionFactory.build(5, (idx) => ({
            _id: `institution-${idx}`,
            name: `Institution ${idx + 1}`,
            status: "Active",
          })),
        ],
      },
    },
  },
};

const listOrgsMock: MockedResponse<ListOrgsResp, ListOrgsInput> = {
  request: {
    query: LIST_ORGS,
  },
  variableMatcher: () => true,
  result: {
    data: {
      listPrograms: {
        total: 3,
        programs: [
          ...organizationFactory.build(3, (idx) => ({
            _id: `program-${idx + 1}`,
            name: `Program ${idx + 1}`,
            status: "Active",
          })),
        ],
      },
    },
  },
};

type MockParentProps = {
  mocks: MockedResponse[];
  children?: React.ReactNode;
};

const MockParent: FC<MockParentProps> = ({ mocks, children }) => (
  <MockedProvider mocks={mocks}>{children}</MockedProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mockDownloadBlob.mockReset();

  serializeMock.mockReset();
  serializeMock.mockResolvedValue(new ArrayBuffer(8));
});

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(<ExportApplicationButton disabled />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    expect(getByTestId("export-application-excel-button")).toBeDisabled();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    expect(getByTestId("export-application-excel-button")).toBeInTheDocument();
  });

  it("should invoke the Excel middleware with form data and query functions", async () => {
    const { getByTestId } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    const exportButton = getByTestId("export-application-excel-button");

    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toBeEnabled();

    userEvent.click(exportButton);

    await waitFor(() => {
      expect(questionnaireExcelMiddlewareMock).toHaveBeenCalledTimes(1);
    });

    const [passedQuestionnaireData, options] = questionnaireExcelMiddlewareMock.mock.calls[0];

    expect(passedQuestionnaireData).toEqual(
      expect.objectContaining({
        sections: expect.any(Array),
      })
    );

    expect(options).toEqual(
      expect.objectContaining({
        application: expect.objectContaining({
          version: expect.any(String),
        }),
        getInstitutions: expect.any(Function),
        getPrograms: expect.any(Function),
      })
    );
  });
});

describe("Implementation Requirements", () => {
  it("should render a button with the correct text", () => {
    const { getByText } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    expect(getByText("Export Form")).toBeInTheDocument();
  });

  it("should have a tooltip with the correct text", async () => {
    const { getByTestId, findByRole } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    userEvent.hover(getByTestId("export-application-excel-button-text"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Export the Submission Request to Excel.");

    userEvent.unhover(getByTestId("export-application-excel-button-text"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should be disabled while downloading", async () => {
    serializeMock.mockImplementation(() => new Promise(() => {}));

    const { getByTestId } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    const button = getByTestId("export-application-excel-button");

    expect(button).toBeEnabled();

    userEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it("should download the application with the correct filename", async () => {
    const { getByTestId } = render(<ExportApplicationButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    userEvent.click(getByTestId("export-application-excel-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        "CRDC_Submission_Request_Study-Abbrev_v3.5.xlsx",
        "application/vnd.ms-excel"
      );
    });
  });
});
