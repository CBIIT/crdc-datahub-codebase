import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import userEvent from "@testing-library/user-event";
import { GraphQLError } from "graphql";
import { FC } from "react";
import { axe } from "vitest-axe";

import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  LIST_INSTITUTIONS,
  LIST_ORGS,
  ListInstitutionsInput,
  ListInstitutionsResp,
  ListOrgsInput,
  ListOrgsResp,
  GET_APPLICATION_FORM_VERSION,
  GetApplicationFormVersionResp,
} from "@/graphql";
import { render, waitFor, act } from "@/test-utils";

import ExportTemplateButton from "./index";

const mockDownloadBlob = vi.fn();
vi.mock("@/utils", async () => ({
  ...(await vi.importActual("@/utils")),
  downloadBlob: (...args) => mockDownloadBlob(...args),
}));

vi.mock("@/classes/QuestionnaireExcelMiddleware", () => ({
  QuestionnaireExcelMiddleware: vi.fn().mockImplementation(() => ({
    serialize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  })),
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

const formVersionMock: MockedResponse<GetApplicationFormVersionResp> = {
  request: {
    query: GET_APPLICATION_FORM_VERSION,
  },
  result: {
    data: {
      getApplicationFormVersion: {
        _id: "mock-uuid",
        version: "1.0.0",
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

describe("Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("should have no accessibility violations (disabled)", async () => {
    const { container, getByTestId } = render(<ExportTemplateButton disabled />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("export-application-excel-template-button")).toBeDisabled(); // Sanity check

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(getByTestId("export-application-excel-template-button")).toBeInTheDocument();
  });

  it("should handle API errors gracefully (GraphQL)", async () => {
    const errorFormVersionMock: MockedResponse<GetApplicationFormVersionResp> = {
      request: {
        query: GET_APPLICATION_FORM_VERSION,
      },
      result: {
        errors: [new GraphQLError("mock error")],
      },
    };

    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, errorFormVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("export-application-excel-template-button"));

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to generate the template. Please try again later.",
        { variant: "error" }
      );
    });
  });

  it("should handle API errors gracefully (Network)", async () => {
    const errorFormVersionMock: MockedResponse<GetApplicationFormVersionResp> = {
      request: {
        query: GET_APPLICATION_FORM_VERSION,
      },
      error: new Error("mock Network error"),
    };

    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, errorFormVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(getByTestId("export-application-excel-template-button"));
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to generate the template. Please try again later.",
        { variant: "error" }
      );
    });
  });

  it("should handle API errors gracefully (API)", async () => {
    const errorFormVersionMock: MockedResponse<GetApplicationFormVersionResp> = {
      request: {
        query: GET_APPLICATION_FORM_VERSION,
      },
      result: {
        data: {
          getApplicationFormVersion: null, // Simulating an API error by returning null
        },
      },
    };

    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, errorFormVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(getByTestId("export-application-excel-template-button"));
    });

    await waitFor(() => {
      expect(global.mockEnqueue).toHaveBeenCalledWith(
        "Oops! Unable to generate the template. Please try again later.",
        { variant: "error" }
      );
    });
  });
});

describe("Implementation Requirements", () => {
  it("should render a button with the correct text", () => {
    const { getByText } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    expect(getByText("Download Template")).toBeInTheDocument();
  });

  it("should have a tooltip with the correct text", async () => {
    const { getByTestId, findByRole } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.hover(getByTestId("export-application-excel-template-button"));

    const tooltip = await findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Download the Submission Request Excel Template.");

    userEvent.unhover(getByTestId("export-application-excel-template-button"));

    await waitFor(() => {
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("should be disabled while downloading", async () => {
    const slowApiMock: MockedResponse<GetApplicationFormVersionResp> = {
      request: {
        query: GET_APPLICATION_FORM_VERSION,
      },
      result: {
        data: {
          getApplicationFormVersion: null, // This never resolves anyway
        },
      },
      delay: 5000,
    };

    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, slowApiMock, listOrgsMock]}>{children}</MockParent>
      ),
    });

    const button = getByTestId("export-application-excel-template-button");

    expect(button).toBeEnabled(); // Initial state

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      userEvent.click(button);
    });

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });

  it("should download the template with the correct filename", async () => {
    const mockFormVersion: MockedResponse<GetApplicationFormVersionResp> = {
      request: {
        query: GET_APPLICATION_FORM_VERSION,
      },
      result: {
        data: {
          getApplicationFormVersion: {
            _id: "a mock uuid here",
            version: "3.5",
          },
        },
      },
    };

    const { getByTestId } = render(<ExportTemplateButton />, {
      wrapper: ({ children }) => (
        <MockParent mocks={[institutionsMock, mockFormVersion, listOrgsMock]}>
          {children}
        </MockParent>
      ),
    });

    userEvent.click(getByTestId("export-application-excel-template-button"));

    await waitFor(() => {
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("CRDC_Submission_Request_Template_v3.5_"),
        "application/vnd.ms-excel"
      );
    });
  });
});
