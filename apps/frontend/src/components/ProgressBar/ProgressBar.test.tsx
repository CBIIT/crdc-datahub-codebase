import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { FC, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { axe } from "vitest-axe";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { userFactory } from "@/factories/auth/UserFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import {
  GET_APPLICATION_FORM_VERSION,
  GetApplicationFormVersionResp,
  LIST_INSTITUTIONS,
  LIST_ORGS,
  ListInstitutionsInput,
  ListInstitutionsResp,
  ListOrgsInput,
  ListOrgsResp,
} from "@/graphql";

import { InitialApplication, InitialQuestionnaire } from "../../config/InitialValues";
import config from "../../config/SectionConfig";
import { render } from "../../test-utils";
import { ContextState, Context as AuthCtx } from "../Contexts/AuthContext";
import { ContextState as FormCtxState, Context as FormCtx } from "../Contexts/FormContext";

import ProgressBar from "./ProgressBar";

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

const BaseApplication: Application = {
  ...InitialApplication,
  questionnaireData: { ...InitialQuestionnaire },
};

type Props = {
  section: string;
  user?: Partial<User>;
  data?: Partial<Application>;
};

const BaseComponent: FC<Props> = ({ section, user = {}, data = {} }: Props) => {
  const formValue = useMemo<FormCtxState>(
    () =>
      formContextStateFactory.build({
        data: applicationFactory.build({ ...data }),
      }),
    [data]
  );

  const authValue = useMemo<ContextState>(
    () =>
      authCtxStateFactory.build({
        user: userFactory.build({ ...user }),
      }),
    [user]
  );

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MockedProvider mocks={[institutionsMock, formVersionMock, listOrgsMock]}>
        <AuthCtx.Provider value={authValue}>
          <FormCtx.Provider value={formValue}>
            <ProgressBar section={section} />
          </FormCtx.Provider>
        </AuthCtx.Provider>
      </MockedProvider>
    </BrowserRouter>
  );
};

describe("Accessibility", () => {
  const keys = Object.keys(config) as SectionKey[];

  it("has no base accessibility violations", async () => {
    const { container } = render(<BaseComponent section={keys[0]} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when all sections are completed", async () => {
    const data: Application = {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.map((s) => ({ name: s, status: "Completed" })),
      },
    };

    const { container } = render(<BaseComponent section={keys[0]} data={data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when the review section is accessible", async () => {
    const data: Application = {
      ...BaseApplication,
      status: "Approved",
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.map((s) => ({ name: s, status: "Completed" })),
      },
    };

    const { container } = render(<BaseComponent section={keys[0]} data={data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations when the review section is inaccessible", async () => {
    const data: Application = {
      ...BaseApplication,
      status: "New",
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.map((s) => ({ name: s, status: "Completed" })),
      },
    };

    const { container } = render(<BaseComponent section={keys[0]} data={data} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  const keys = Object.keys(config) as SectionKey[];
  const sections = Object.values(config);

  it("renders the progress bar with all A-D config-defined sections", () => {
    const { getByText } = render(<BaseComponent section={keys[0]} />);

    sections
      .filter((section) => section.id !== config.REVIEW.id)
      .forEach(({ title }, index) => {
        const root = getByText(title).closest("a");

        expect(root).toBeVisible();
        expect(root).toHaveAttribute("data-testId", `progress-bar-section-${index}`);
        expect(root).toHaveAttribute("href");
        expect(root).toHaveAttribute("aria-disabled");
      });
  });

  it("renders the currently active section as highlighted", () => {
    const { container, getByTestId } = render(<BaseComponent section={keys[1]} />);
    const activeLinks = container.querySelectorAll("a[data-selected='true']");

    expect(activeLinks.length).toBe(1);
    expect(activeLinks[0]).toBe(getByTestId("progress-bar-section-1"));
    expect(activeLinks[0].querySelector(".MuiButtonBase-root")).toHaveClass("Mui-selected");
  });

  it("renders the completed sections with a checkmark", () => {
    const data: Application = {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: [{ name: keys[1], status: "Completed" }],
      },
    };

    const { getByTestId } = render(<BaseComponent section={keys[0]} data={data} />);
    const element = getByTestId("progress-bar-section-1");

    expect(element.querySelector(".MuiAvatar-root svg")).toHaveAttribute(
      "data-testid",
      "CheckIcon"
    );
  });

  it("renders the Review section as disabled by default", () => {
    const { getByTestId } = render(<BaseComponent section={keys[0]} />);
    const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

    expect(reviewSection).toBeVisible();
    expect(reviewSection).toHaveAttribute("aria-disabled", "true");
    expect(reviewSection.querySelector(".MuiAvatar-root svg")).toHaveAttribute(
      "data-testid",
      "ArrowUpwardIcon"
    );
  });

  it("renders the Review section as enabled only when all sections are completed", () => {
    const data: Application = {
      ...BaseApplication,
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
      },
    };

    const { getByTestId } = render(<BaseComponent section={keys[0]} data={data} />);

    sections.slice(0, sections.length - 1).forEach((_, index) => {
      const sectionLink = getByTestId(`progress-bar-section-${index}`);
      expect(sectionLink).toHaveAttribute("aria-disabled", "false");
      expect(sectionLink.querySelector(".MuiAvatar-root svg")).toHaveAttribute(
        "data-testid",
        "CheckIcon"
      );
    });

    expect(getByTestId(`progress-bar-section-${keys.length - 1}`)).toHaveAttribute(
      "aria-disabled",
      "false"
    );
  });

  it.each<ApplicationStatus>(["Approved"])(
    "renders the Review section as accessible and completed for status %s",
    (status) => {
      const data: Application = {
        ...BaseApplication,
        status,
        questionnaireData: {
          ...BaseApplication.questionnaireData,
          sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
        },
      };

      const { getByTestId } = render(<BaseComponent section={keys[0]} data={data} />);
      const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

      expect(reviewSection.querySelector(".MuiAvatar-root svg")).toHaveAttribute(
        "data-testid",
        "CheckIcon"
      );
    }
  );

  it.each<ApplicationStatus>(["New", "In Progress", "Submitted", "In Review", "Rejected"])(
    "renders the Review section as accessible and incomplete for status %s",
    (status) => {
      const data: Application = {
        ...BaseApplication,
        status,
        questionnaireData: {
          ...BaseApplication.questionnaireData,
          sections: keys.slice(0, keys.length - 1).map((s) => ({ name: s, status: "Completed" })),
        },
      };

      const { getByTestId } = render(<BaseComponent section={keys[0]} data={data} />);
      const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

      expect(reviewSection.querySelector(".MuiAvatar-root svg")).toHaveAttribute(
        "data-testid",
        "ArrowUpwardIcon"
      );
    }
  );

  it.each<ApplicationStatus>(["In Progress", "Inquired"])(
    "should use the review title 'Review and Submit' for the status '%s' when the user has the permission to submit (owner)",
    (status) => {
      const data: Application = {
        ...BaseApplication,
        status,
        applicant: {
          ...BaseApplication.applicant,
          applicantID: "owner-of-sr",
        },
        questionnaireData: {
          ...BaseApplication.questionnaireData,
          sections: keys.map((s) => ({ name: s, status: "Completed" })),
        },
      };

      const { getByTestId } = render(
        <BaseComponent
          section={config.REVIEW.title}
          data={data}
          user={{
            _id: "owner-of-sr",
            permissions: ["submission_request:view", "submission_request:submit"],
          }}
        />
      );

      const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

      expect(reviewSection.textContent).toBe("Review and Submit");
    }
  );

  it.each<ApplicationStatus>(["In Progress", "Inquired"])(
    "should use the review title 'Review and Submit' for the status '%s' when the user has the permission to submit (non-owner)",
    (status) => {
      const data: Application = {
        ...BaseApplication,
        status,
        applicant: {
          ...BaseApplication.applicant,
          applicantID: "the-owner-is-not-me",
        },
        questionnaireData: {
          ...BaseApplication.questionnaireData,
          sections: keys.map((s) => ({ name: s, status: "Completed" })),
        },
      };

      const { getByTestId } = render(
        <BaseComponent
          section={config.REVIEW.title}
          data={data}
          user={{
            _id: "some-other-user",
            role: "Admin",
            permissions: ["submission_request:view", "submission_request:submit"],
          }}
        />
      );

      const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

      expect(reviewSection.textContent).toBe("Review and Submit");
    }
  );

  it.each<ApplicationStatus>(["In Progress", "Inquired", "Submitted", "In Review"])(
    "shows the review section title as 'Review' when submit button is not visible and status is %s",
    (status) => {
      const data: Application = {
        ...BaseApplication,
        status,
        applicant: {
          ...BaseApplication.applicant,
          applicantID: "user-2-owns-the-sr",
        },
        questionnaireData: {
          ...BaseApplication.questionnaireData,
          sections: keys.map((s: SectionKey) => ({ name: s, status: "Completed" })),
        },
      };

      const { getByTestId } = render(
        <BaseComponent
          section={config.REVIEW.title}
          data={data}
          user={{
            _id: "user-id-01",
            role: "Admin",
            permissions: ["submission_request:view"], // Only possible to view the submission request, no submit or review
          }}
        />
      );

      const reviewSection = getByTestId(`progress-bar-section-${keys.length - 1}`);

      expect(reviewSection.textContent).toBe("Review");
    }
  );
});

describe("Implementation Requirements", () => {
  it("should disable the import button in the Review section", () => {
    const data: Application = {
      ...BaseApplication,
      status: "In Progress",
      applicant: {
        ...BaseApplication.applicant,
        applicantID: "current-user",
      },
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: Object.keys(config)?.map((s: SectionKey) => ({ name: s, status: "Completed" })),
      },
    };

    const { getByTestId } = render(
      <BaseComponent
        section={config.REVIEW.id}
        data={data}
        user={{
          _id: "current-user",
          role: "Submitter",
          permissions: ["submission_request:view", "submission_request:create"],
        }}
      />
    );

    expect(getByTestId("import-application-excel-button")).toBeDisabled();
  });

  it("should show the import button when user is the submission owner", () => {
    const data: Application = {
      ...BaseApplication,
      status: "In Progress",
      applicant: {
        ...BaseApplication.applicant,
        applicantID: "current-user",
      },
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: Object.keys(config)?.map((s: SectionKey) => ({ name: s, status: "Completed" })),
      },
    };

    const { getByTestId } = render(
      <BaseComponent
        section={config.A.id}
        data={data}
        user={{
          _id: "current-user",
          role: "Admin",
          permissions: ["submission_request:view", "submission_request:create"],
        }}
      />
    );

    expect(getByTestId("import-application-excel-button")).toBeInTheDocument();
  });

  it("should not show the import button when user is not the submission owner", () => {
    const data: Application = {
      ...BaseApplication,
      status: "In Progress",
      applicant: {
        ...BaseApplication.applicant,
        applicantID: "other-user",
      },
      questionnaireData: {
        ...BaseApplication.questionnaireData,
        sections: Object.keys(config)?.map((s: SectionKey) => ({ name: s, status: "Completed" })),
      },
    };

    const { queryByTestId } = render(
      <BaseComponent
        section={config.A.id}
        data={data}
        user={{
          _id: "current-user",
          role: "Admin",
          permissions: ["submission_request:view", "submission_request:create"],
        }}
      />
    );

    expect(queryByTestId("import-application-excel-button")).not.toBeInTheDocument();
  });
});
