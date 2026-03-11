import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import userEvent from "@testing-library/user-event";
import { FC, useMemo, useRef } from "react";
import { axe } from "vitest-axe";

import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { studyFactory } from "@/factories/application/StudyFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";

import {
  ContextState as FormContextState,
  Context as FormContext,
  Status as FormStatus,
} from "../../../components/Contexts/FormContext";
import {
  Context as OrganizationContext,
  ContextState as OrganizationContextState,
  Status as OrganizationStatus,
} from "../../../components/Contexts/OrganizationListContext";
import { render, RenderResult, waitFor, within } from "../../../test-utils";

import FormSectionB from "./B";

Element.prototype.scrollIntoView = vi.fn();

const mockUseFormMode = vi.fn();
vi.mock("../../../hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

/**
 * Helper to get form elements
 */
const getFormElements = ({ getByTestId }: Pick<RenderResult, "getByTestId">) => ({
  programSelect: () => getByTestId("section-b-program"),
  programTitle: () => getByTestId("section-b-program-title"),
  programAbbreviation: () => getByTestId("section-b-program-abbreviation"),
  programDescription: () => getByTestId("section-b-program-description"),
  studyTitle: () => getByTestId("section-b-study-title"),
  studyAbbreviation: () => getByTestId("section-b-study-abbreviation-or-acronym"),
  studyDescription: () => getByTestId("section-b-study-description"),
  addFundingButton: () => getByTestId("section-b-add-funding-agency-button"),
  addPublicationButton: () => getByTestId("section-b-add-publication-button"),
  addPlannedPublicationButton: () => getByTestId("section-b-add-planned-publication-button"),
  addRepositoryButton: () => getByTestId("section-b-add-repository-button"),
});

const mockPrograms = [
  organizationFactory.build({
    _id: "program-1",
    name: "Test Program 1",
    abbreviation: "TP1",
    description: "Test Program 1 Description",
  }),
  organizationFactory.build({
    _id: "program-2",
    name: "Test Program 2",
    abbreviation: "TP2",
    description: "Test Program 2 Description",
  }),
];

const defaultQuestionnaireData = questionnaireDataFactory.build({
  study: studyFactory.build(),
});

type TestParentProps = {
  formStatus?: FormStatus;
  questionnaireData?: QuestionnaireData;
  organizationStatus?: OrganizationStatus;
  programs?: OrganizationContextState["data"];
  formRef?: React.RefObject<HTMLFormElement>;
  children: React.ReactNode;
};

const TestParent: FC<TestParentProps> = ({
  formStatus = FormStatus.LOADED,
  questionnaireData = defaultQuestionnaireData,
  organizationStatus = OrganizationStatus.LOADED,
  programs = mockPrograms,
  formRef,
  children,
}: TestParentProps) => {
  const defaultFormRef = useRef<HTMLFormElement>(null);
  const actualFormRef = formRef || defaultFormRef;

  const formValue = useMemo<FormContextState>(
    () => ({
      status: formStatus,
      formRef: actualFormRef,
      data: applicationFactory.build({
        questionnaireData,
      }),
    }),
    [formStatus, questionnaireData, actualFormRef]
  );

  const organizationValue = useMemo<OrganizationContextState>(
    () => ({
      status: organizationStatus,
      data: programs,
      activeOrganizations: programs.filter((p) => p.status === "Active"),
    }),
    [organizationStatus, programs]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <OrganizationContext.Provider value={organizationValue}>
        <FormContext.Provider value={formValue}>{children}</FormContext.Provider>
      </OrganizationContext.Provider>
    </LocalizationProvider>
  );
};

/**
 * Creates default FormSectionProps
 */
const createSectionProps = (): FormSectionProps => ({
  SectionOption: {
    title: "Program and Study",
    id: "B",
    component: FormSectionB,
  },
  refs: {
    getFormObjectRef: { current: null },
  },
});

describe("Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFormMode.mockReturnValue({ formMode: "EDIT", readOnlyInputs: false });
  });

  it("should not have any violations", async () => {
    const props = createSectionProps();

    const { container } = render(<FormSectionB {...props} />, { wrapper: TestParent });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFormMode.mockReturnValue({ formMode: "EDIT", readOnlyInputs: false });
  });

  it("should render without crashing", () => {
    const props = createSectionProps();

    expect(() => render(<FormSectionB {...props} />, { wrapper: TestParent })).not.toThrow();
  });

  it("should render all program information fields", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, { wrapper: TestParent });

    const elements = getFormElements({ getByTestId });
    expect(elements.programSelect()).toBeInTheDocument();
    expect(elements.programTitle()).toBeInTheDocument();
    expect(elements.programAbbreviation()).toBeInTheDocument();
    expect(elements.programDescription()).toBeInTheDocument();
  });

  it("should render all study information fields", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, { wrapper: TestParent });

    const elements = getFormElements({ getByTestId });
    expect(elements.studyTitle()).toBeInTheDocument();
    expect(elements.studyAbbreviation()).toBeInTheDocument();
    expect(elements.studyDescription()).toBeInTheDocument();
  });

  it("should render all add buttons for repeating sections", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, { wrapper: TestParent });

    const elements = getFormElements({ getByTestId });
    expect(elements.addFundingButton()).toBeInTheDocument();
    expect(elements.addPublicationButton()).toBeInTheDocument();
    expect(elements.addPlannedPublicationButton()).toBeInTheDocument();
    expect(elements.addRepositoryButton()).toBeInTheDocument();
  });

  it("should display study name value when provided", () => {
    const props = createSectionProps();

    const { getByDisplayValue } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              name: "My Test Study",
              abbreviation: "MTS",
              description: "A description of my test study",
            }),
          })}
        />
      ),
    });

    expect(getByDisplayValue("My Test Study")).toBeInTheDocument();
    expect(getByDisplayValue("MTS")).toBeInTheDocument();
  });

  it("should add a funding agency when Add Agency button is clicked", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const elements = getFormElements({ getByTestId });
    userEvent.click(elements.addFundingButton());

    await waitFor(() => {
      expect(getByTestId("section-b-funding-agency-0")).toBeInTheDocument();
    });
  });

  it("should add a publication when Add Existing Publication button is clicked", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const elements = getFormElements({ getByTestId });
    userEvent.click(elements.addPublicationButton());

    await waitFor(() => {
      expect(getByTestId("section-b-publication-0")).toBeInTheDocument();
    });
  });

  it("should add a planned publication when Add Planned Publication button is clicked", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const elements = getFormElements({ getByTestId });
    userEvent.click(elements.addPlannedPublicationButton());

    await waitFor(() => {
      expect(getByTestId("section-b-planned-publication-0")).toBeInTheDocument();
    });
  });

  it("should add a repository when Add Repository button is clicked", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const elements = getFormElements({ getByTestId });
    userEvent.click(elements.addRepositoryButton());

    await waitFor(() => {
      expect(getByTestId("section-b-repository-0")).toBeInTheDocument();
    });
  });

  it("should disable add buttons when form status is SAVING", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} formStatus={FormStatus.SAVING} />,
    });

    const elements = getFormElements({ getByTestId });
    expect(elements.addFundingButton()).toBeDisabled();
    expect(elements.addPublicationButton()).toBeDisabled();
    expect(elements.addPlannedPublicationButton()).toBeDisabled();
    expect(elements.addRepositoryButton()).toBeDisabled();
  });

  it("should disable add buttons when readOnly is true", () => {
    mockUseFormMode.mockReturnValue({ formMode: "VIEW", readOnlyInputs: true });
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const elements = getFormElements({ getByTestId });
    expect(elements.addFundingButton()).toBeDisabled();
    expect(elements.addPublicationButton()).toBeDisabled();
    expect(elements.addPlannedPublicationButton()).toBeDisabled();
    expect(elements.addRepositoryButton()).toBeDisabled();
  });

  it("should assign getFormObject to the ref when component mounts", () => {
    const getFormObjectRef = { current: null };
    const props: FormSectionProps = {
      ...createSectionProps(),
      refs: { getFormObjectRef },
    };

    render(<FormSectionB {...props} />, { wrapper: TestParent });

    expect(getFormObjectRef.current).toBeInstanceOf(Function);
  });

  it("should render existing funding agencies from data", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              funding: [
                { agency: "NIH", grantNumbers: "R01", nciProgramOfficer: "John Doe" },
                { agency: "NCI", grantNumbers: "P01", nciProgramOfficer: "Jane Smith" },
              ],
            }),
          })}
        />
      ),
    });

    expect(getByTestId("section-b-funding-agency-0")).toBeInTheDocument();
    expect(getByTestId("section-b-funding-agency-1")).toBeInTheDocument();
  });

  it("should render existing publications from data", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              publications: [{ title: "Publication 1", pubmedID: "12345", DOI: "10.1234" }],
            }),
          })}
        />
      ),
    });

    expect(getByTestId("section-b-publication-0")).toBeInTheDocument();
  });

  it("should render existing repositories from data", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              repositories: [
                {
                  name: "GEO",
                  studyID: "GSE123",
                  dataTypesSubmitted: ["genomics"],
                  otherDataTypesSubmitted: "",
                },
              ],
            }),
          })}
        />
      ),
    });

    expect(getByTestId("section-b-repository-0")).toBeInTheDocument();
  });

  it("should render existing planned publications from data", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              plannedPublications: [{ title: "Planned Pub 1", expectedDate: "12/31/2026" }],
            }),
          })}
        />
      ),
    });

    expect(getByTestId("section-b-planned-publication-0")).toBeInTheDocument();
  });

  it("should handle empty programs array gracefully", () => {
    const props = createSectionProps();

    expect(() =>
      render(<FormSectionB {...props} />, {
        wrapper: (p) => <TestParent {...p} programs={[]} />,
      })
    ).not.toThrow();
  });

  it("should change program when selecting a different program", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole, getByText } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
          })}
        />
      ),
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    const program2Option = getByText("Test Program 2 (TP2)");
    userEvent.click(program2Option);

    await waitFor(() => {
      expect(programSelectButton).toHaveTextContent("Test Program 2 (TP2)");
    });
  });

  it("should change to 'Not Applicable' program when selected", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole, getByText } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
          })}
        />
      ),
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    const notApplicableOption = getByText("Not Applicable");
    userEvent.click(notApplicableOption);

    await waitFor(() => {
      expect(programSelectButton).toHaveTextContent("Not Applicable");
    });
  });

  it("should change to 'Other' program when selected", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole, getByText } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
          })}
        />
      ),
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    const otherOption = getByText("Other");
    userEvent.click(otherOption);

    await waitFor(() => {
      expect(programSelectButton).toHaveTextContent("Other");
    });
  });

  it("should return form data when getFormObject is called", async () => {
    const getFormObjectRef = { current: null };
    const props: FormSectionProps = {
      ...createSectionProps(),
      refs: { getFormObjectRef },
    };

    render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
            study: studyFactory.build({
              name: "Test Study",
              abbreviation: "TS",
              description: "A test study",
            }),
          })}
        />
      ),
    });

    await waitFor(() => {
      expect(getFormObjectRef.current).toBeInstanceOf(Function);
    });

    const formObject = getFormObjectRef.current();

    expect(formObject).not.toBeNull();
    expect(formObject.data).toBeDefined();
    expect(formObject.ref).toBeDefined();
  });

  it("should handle planned publications with invalid expectedDate", async () => {
    const getFormObjectRef = { current: null };
    const props: FormSectionProps = {
      ...createSectionProps(),
      refs: { getFormObjectRef },
    };

    render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              plannedPublications: [
                { title: "Planned Pub 1", expectedDate: "invalid-date" },
                { title: "Planned Pub 2", expectedDate: "12/31/2026" },
              ],
            }),
          })}
        />
      ),
    });

    await waitFor(() => {
      expect(getFormObjectRef.current).toBeInstanceOf(Function);
    });

    const formObject = getFormObjectRef.current();

    expect(formObject).not.toBeNull();
    expect(formObject.data.study.plannedPublications).toBeDefined();
    expect(formObject.data.study.plannedPublications[0].expectedDate).toBe("");
  });

  it("should initialize program state from context data", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-2",
              name: "Test Program 2",
              abbreviation: "TP2",
              description: "Test Program 2 Description",
            },
          })}
        />
      ),
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    expect(programSelectButton).toHaveTextContent("Test Program 2 (TP2)");
  });

  it("should initialize study state from context data", () => {
    const props = createSectionProps();

    const { getByDisplayValue } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              name: "Custom Study Name",
              abbreviation: "CSN",
              description: "Custom study description",
            }),
          })}
        />
      ),
    });

    expect(getByDisplayValue("Custom Study Name")).toBeInTheDocument();
    expect(getByDisplayValue("CSN")).toBeInTheDocument();
  });

  it("should display program name without abbreviation when abbreviation is empty", async () => {
    const props = createSectionProps();

    const programsWithoutAbbreviation = [
      organizationFactory.build({
        _id: "program-no-abbr",
        name: "Program Without Abbreviation",
        abbreviation: "",
        description: "A program without abbreviation",
      }),
    ];

    const { getByTestId, getAllByRole, getByText } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} programs={programsWithoutAbbreviation} />,
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    expect(getByText("Program Without Abbreviation")).toBeInTheDocument();
  });

  it("should not change program when selecting the same program", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
          })}
        />
      ),
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");

    await waitFor(() => {
      expect(programSelectButton).toHaveTextContent("Test Program 1 (TP1)");
    });

    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    const listboxes = getAllByRole("listbox", { hidden: true });
    const listbox = listboxes.find((el) => el.tagName === "UL");
    const options = within(listbox).getAllByRole("option", { hidden: true });
    const sameOption = options.find((o) => o.textContent?.includes("Test Program 1"));
    userEvent.click(sameOption);

    await waitFor(() => {
      expect(listbox).not.toBeVisible();
    });

    await waitFor(() => {
      expect(programSelectButton).toHaveTextContent("Test Program 1 (TP1)");
    });
  });

  it("should filter out readOnly programs from options", () => {
    const props = createSectionProps();

    const programsWithReadOnly = [
      organizationFactory.build({
        _id: "program-normal",
        name: "Normal Program",
        abbreviation: "NP",
        description: "A normal program",
        readOnly: false,
      }),
      organizationFactory.build({
        _id: "program-readonly",
        name: "ReadOnly Program",
        abbreviation: "RP",
        description: "A readonly program",
        readOnly: true,
      }),
    ];

    const { queryByText } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} programs={programsWithReadOnly} />,
    });

    expect(queryByText("ReadOnly Program (RP)")).not.toBeInTheDocument();
  });

  it("should convert program abbreviation to uppercase when typing", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "Other",
              name: "",
              abbreviation: "",
              description: "",
            },
          })}
        />
      ),
    });

    const programAbbreviation = within(getByTestId("section-b-program-abbreviation")).getByRole(
      "textbox"
    );
    userEvent.type(programAbbreviation, "abc");

    await waitFor(() => {
      expect(programAbbreviation).toHaveValue("ABC");
    });
    userEvent.clear(programAbbreviation);
  });

  it("should convert study abbreviation to uppercase when typing", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, { wrapper: TestParent });

    const studyAbbreviation = within(
      getByTestId("section-b-study-abbreviation-or-acronym")
    ).getByRole("textbox");
    userEvent.clear(studyAbbreviation);
    userEvent.type(studyAbbreviation, "xyz");

    await waitFor(() => {
      expect(studyAbbreviation).toHaveValue("XYZ");
    });
    userEvent.clear(studyAbbreviation);
  });

  it("should remove a funding agency when remove button is clicked", async () => {
    const props = createSectionProps();
    const dataWithFunding = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [
          { agency: "Funding 1", grantNumbers: "123", nciProgramOfficer: "", nciGPA: "" },
          { agency: "Funding 2", grantNumbers: "456", nciProgramOfficer: "", nciGPA: "" },
        ],
      }),
    });

    const { getByTestId, queryByTestId, getByRole } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithFunding} />,
    });

    expect(getByTestId("section-b-funding-agency-0")).toBeInTheDocument();
    expect(getByTestId("section-b-funding-agency-1")).toBeInTheDocument();

    const removeButtons = getByRole("button", { name: "Remove Agency" });
    userEvent.click(removeButtons);

    await waitFor(() => {
      expect(queryByTestId("section-b-funding-agency-1")).not.toBeInTheDocument();
    });
  });

  it("should remove a publication when remove button is clicked", async () => {
    const props = createSectionProps();

    const { getByTestId, queryByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            study: studyFactory.build({
              publications: [
                { title: "Publication 1", pubmedID: "12345", DOI: "10.1234" },
                { title: "Publication 2", pubmedID: "67890", DOI: "10.5678" },
              ],
            }),
          })}
        />
      ),
    });

    expect(getByTestId("section-b-publication-0")).toBeInTheDocument();
    expect(getByTestId("section-b-publication-1")).toBeInTheDocument();

    const removeButtons = getAllByRole("button", { name: "Remove Existing Publication" });
    expect(removeButtons.length).toBe(2);

    userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(getByTestId("section-b-publication-0")).toBeInTheDocument();
      expect(queryByTestId("section-b-publication-1")).not.toBeInTheDocument();
    });
  });

  it("should remove a planned publication when remove button is clicked", async () => {
    const props = createSectionProps();
    const dataWithPlannedPubs = questionnaireDataFactory.build({
      study: studyFactory.build({
        plannedPublications: [
          { title: "Planned Pub 1", expectedDate: "06/01/2024" },
          { title: "Planned Pub 2", expectedDate: "01/01/2025" },
        ],
      }),
    });

    const { getByTestId, queryByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithPlannedPubs} />,
    });

    expect(getByTestId("section-b-planned-publication-0")).toBeInTheDocument();
    expect(getByTestId("section-b-planned-publication-1")).toBeInTheDocument();

    const removeButtons = getAllByRole("button", { name: "Remove Planned Publication" });
    expect(removeButtons.length).toBe(2);

    userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(getByTestId("section-b-planned-publication-0")).toBeInTheDocument();
      expect(queryByTestId("section-b-planned-publication-1")).not.toBeInTheDocument();
    });
  });

  it("should remove a repository when remove button is clicked", async () => {
    const props = createSectionProps();
    const dataWithRepos = questionnaireDataFactory.build({
      study: studyFactory.build({
        repositories: [
          {
            name: "Repository 1",
            studyID: "R001",
            dataTypesSubmitted: [],
            otherDataTypesSubmitted: "",
          },
          {
            name: "Repository 2",
            studyID: "R002",
            dataTypesSubmitted: [],
            otherDataTypesSubmitted: "",
          },
        ],
      }),
    });

    const { getByTestId, queryByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithRepos} />,
    });

    expect(getByTestId("section-b-repository-0")).toBeInTheDocument();
    expect(getByTestId("section-b-repository-1")).toBeInTheDocument();

    const removeButtons = getAllByRole("button", { name: "Remove Repository" });
    expect(removeButtons.length).toBe(2);

    userEvent.click(removeButtons[1]);

    await waitFor(() => {
      expect(getByTestId("section-b-repository-0")).toBeInTheDocument();
      expect(queryByTestId("section-b-repository-1")).not.toBeInTheDocument();
    });
  });

  it("should add a funding agency when add button is clicked", async () => {
    const props = createSectionProps();
    const dataWithFunding = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [{ agency: "Funding 1", grantNumbers: "123", nciProgramOfficer: "", nciGPA: "" }],
      }),
    });

    const { getByTestId, queryByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithFunding} />,
    });

    expect(getByTestId("section-b-funding-agency-0")).toBeInTheDocument();
    expect(queryByTestId("section-b-funding-agency-1")).not.toBeInTheDocument();

    const addButton = getByTestId("section-b-add-funding-agency-button");
    userEvent.click(addButton);

    await waitFor(() => {
      expect(getByTestId("section-b-funding-agency-1")).toBeInTheDocument();
    });
  });

  it("should add a publication when add button is clicked", async () => {
    const props = createSectionProps();
    const dataWithPubs = questionnaireDataFactory.build({
      study: studyFactory.build({
        publications: [{ title: "Publication 1", pubmedID: "PUB001", DOI: "10.1234" }],
      }),
    });

    const { getByTestId, queryByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithPubs} />,
    });

    expect(getByTestId("section-b-publication-0")).toBeInTheDocument();
    expect(queryByTestId("section-b-publication-1")).not.toBeInTheDocument();

    const addButton = getByTestId("section-b-add-publication-button");
    userEvent.click(addButton);

    await waitFor(() => {
      expect(getByTestId("section-b-publication-1")).toBeInTheDocument();
    });
  });

  it("should add a planned publication when add button is clicked", async () => {
    const props = createSectionProps();
    const dataWithPlannedPubs = questionnaireDataFactory.build({
      study: studyFactory.build({
        plannedPublications: [{ title: "Planned Pub 1", expectedDate: "06/01/2024" }],
      }),
    });

    const { getByTestId, queryByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithPlannedPubs} />,
    });

    expect(getByTestId("section-b-planned-publication-0")).toBeInTheDocument();
    expect(queryByTestId("section-b-planned-publication-1")).not.toBeInTheDocument();

    const addButton = getByTestId("section-b-add-planned-publication-button");
    userEvent.click(addButton);

    await waitFor(() => {
      expect(getByTestId("section-b-planned-publication-1")).toBeInTheDocument();
    });
  });

  it("should add a repository when add button is clicked", async () => {
    const props = createSectionProps();
    const dataWithRepos = questionnaireDataFactory.build({
      study: studyFactory.build({
        repositories: [
          {
            name: "Repository 1",
            studyID: "R001",
            dataTypesSubmitted: [],
            otherDataTypesSubmitted: "",
          },
        ],
      }),
    });

    const { getByTestId, queryByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => <TestParent {...p} questionnaireData={dataWithRepos} />,
    });

    expect(getByTestId("section-b-repository-0")).toBeInTheDocument();
    expect(queryByTestId("section-b-repository-1")).not.toBeInTheDocument();

    const addButton = getByTestId("section-b-add-repository-button");
    userEvent.click(addButton);

    await waitFor(() => {
      expect(getByTestId("section-b-repository-1")).toBeInTheDocument();
    });
  });

  it("should render program label from initial data without abbreviation", () => {
    const props = createSectionProps();
    const programWithoutAbbreviation = organizationFactory.build({
      _id: "program-no-abbrev",
      name: "Program Without Abbreviation",
      abbreviation: "",
      description: "Description",
    });

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: programWithoutAbbreviation,
          })}
          programs={[programWithoutAbbreviation]}
        />
      ),
    });

    const programSelect = getByTestId("section-b-program");
    expect(within(programSelect).getByRole("button")).toHaveTextContent(
      "Program Without Abbreviation"
    );
    expect(within(programSelect).getByRole("button").textContent).not.toContain("()");
  });
});

describe("Implementation Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFormMode.mockReturnValue({ formMode: "EDIT", readOnlyInputs: false });
  });

  it("should include 'Not Applicable' as a program option", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    expect(getAllByRole("option", { hidden: true, name: "Not Applicable" })[0]).toBeInTheDocument();
  });

  it("should include 'Other' as a program option", async () => {
    const props = createSectionProps();

    const { getByTestId, getAllByRole } = render(<FormSectionB {...props} />, {
      wrapper: TestParent,
    });

    const programSelectContainer = getByTestId("section-b-program");
    const programSelectButton = within(programSelectContainer).getByRole("button");
    userEvent.click(programSelectButton);

    await waitFor(() => {
      const listboxes = getAllByRole("listbox", { hidden: true });
      const listbox = listboxes.find((el) => el.tagName === "UL");
      expect(listbox).toBeInTheDocument();
    });

    expect(getAllByRole("option", { hidden: true, name: "Other" })[0]).toBeInTheDocument();
  });

  it("should make program title and abbreviation editable when 'Other' is selected", () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "Other",
              name: "",
              abbreviation: "",
              description: "",
            },
          })}
        />
      ),
    });

    const elements = getFormElements({ getByTestId });
    expect(within(elements.programTitle()).getByRole("textbox")).not.toHaveAttribute("readonly");
    expect(within(elements.programAbbreviation()).getByRole("textbox")).not.toHaveAttribute(
      "readonly"
    );
    expect(within(elements.programDescription()).getByRole("textbox")).not.toHaveAttribute(
      "readonly"
    );
  });

  it("should make program title and abbreviation readOnly when a standard program is selected", async () => {
    const props = createSectionProps();

    const { getByTestId } = render(<FormSectionB {...props} />, {
      wrapper: (p) => (
        <TestParent
          {...p}
          questionnaireData={questionnaireDataFactory.build({
            program: {
              _id: "program-1",
              name: "Test Program 1",
              abbreviation: "TP1",
              description: "Test Program 1 Description",
            },
          })}
        />
      ),
    });

    await waitFor(() => {
      const elements = getFormElements({ getByTestId });
      expect(within(elements.programTitle()).getByRole("textbox")).toHaveAttribute("readonly");
      expect(within(elements.programAbbreviation()).getByRole("textbox")).toHaveAttribute(
        "readonly"
      );
      expect(within(elements.programDescription()).getByRole("textbox")).toHaveAttribute(
        "readonly"
      );
    });
  });
});
