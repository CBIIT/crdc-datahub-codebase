import { createRef, FC, useMemo } from "react";

import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "@/components/Contexts/FormContext";
import {
  Context as OrganizationListContext,
  ContextState as OrganizationListContextState,
  Status as OrganizationStatus,
} from "@/components/Contexts/OrganizationListContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { publicationFactory } from "@/factories/application/PublicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { studyFactory } from "@/factories/application/StudyFactory";
import { organizationFactory } from "@/factories/auth/OrganizationFactory";
import { fireEvent, render, within } from "@/test-utils";

import FormSectionB from "./B";

vi.mock("../../../hooks/useFormMode", () => ({
  default: () => ({ formMode: "EDIT", readOnlyInputs: false }),
}));

type ParentProps = {
  formCtxState?: FormContextState;
  orgCtxState?: OrganizationListContextState;
};

const baseQuestionnaireData = questionnaireDataFactory.build({
  study: studyFactory.build({
    publications: [
      publicationFactory.build({
        title: "Sample Publication",
        DOI: "10.1000/example-doi",
        pubmedID: "123456",
      }),
    ],
  }),
});

const baseFormCtxState: FormContextState = {
  status: FormStatus.LOADED,
  formRef: createRef<HTMLFormElement>(),
  data: applicationFactory.build({
    questionnaireData: baseQuestionnaireData,
  }),
};

const baseOrgCtxState: OrganizationListContextState = {
  status: OrganizationStatus.LOADED,
  data: [organizationFactory.build({ _id: "mock-program-1", name: "Mock Program" })],
  activeOrganizations: [organizationFactory.build({ _id: "mock-program-1", name: "Mock Program" })],
};

const TestParent: FC<ParentProps> = ({
  formCtxState = baseFormCtxState,
  orgCtxState = baseOrgCtxState,
}: ParentProps) => {
  const refs = useMemo(
    () => ({
      getFormObjectRef: { current: null },
    }),
    []
  );

  return (
    <OrganizationListContext.Provider value={orgCtxState}>
      <FormContext.Provider value={formCtxState}>
        <FormSectionB
          refs={refs}
          SectionOption={{
            id: "B",
            title: "Program and Study Registration",
            component: FormSectionB,
          }}
        />
      </FormContext.Provider>
    </OrganizationListContext.Provider>
  );
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    expect(() => render(<TestParent />)).not.toThrow();
  });
});

describe("Implementation Requirements", () => {
  it("should have a tooltip on the DOI field", async () => {
    const { getByText, findByText } = render(<TestParent />);

    const doiLabel = getByText("DOI");
    const doiLabelElement = doiLabel.closest("label");

    expect(doiLabelElement).toBeInTheDocument();

    const tooltipToggleButton = within(doiLabelElement as HTMLLabelElement).getByRole("button", {
      name: "Toggle Tooltip",
    });

    fireEvent.click(tooltipToggleButton);

    const tooltipText = await findByText(
      "Digital Object Identifier, either DOI value or DOI link.",
      { exact: true }
    );
    expect(tooltipText).toBeInTheDocument();
  });
});
