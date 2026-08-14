import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { fireEvent, within } from "@testing-library/react";
import { createRef, FC, useMemo } from "react";
import { MemoryRouter } from "react-router-dom";

import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "@/components/Contexts/FormContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { contactFactory } from "@/factories/application/ContactFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { render } from "@/test-utils";

import FormSectionA from "./A";

const mockUseFormMode = vi.fn();

vi.mock("@/hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

vi.mock("@/hooks/useAggregatedInstitutions", () => ({
  default: () => ({
    data: [
      {
        _id: "inst-1",
        name: "National Cancer Institute",
      },
    ],
  }),
}));

vi.mock("@/components/PansBanner", () => ({
  default: () => null,
}));

type ParentProps = {
  formCtxState?: FormContextState;
  getFormObjectRef?: React.MutableRefObject<(() => FormObject | null) | null>;
};

const baseQuestionnaireData = questionnaireDataFactory.build({
  pi: {
    firstName: "Locked",
    lastName: "Owner",
    position: "PI",
    email: "locked@example.org",
    ORCID: "0000-0000-0000-0001",
    institution: "National Cancer Institute",
    institutionID: "inst-1",
    address: "9000 Rockville Pike",
  },
});

const baseFormCtxState: FormContextState = {
  status: FormStatus.LOADED,
  formRef: createRef<HTMLFormElement>(),
  data: applicationFactory.build({
    questionnaireData: baseQuestionnaireData,
  }),
};

const TestParent: FC<ParentProps> = ({
  formCtxState = baseFormCtxState,
  getFormObjectRef,
}: ParentProps) => {
  const refs = useMemo(
    () => ({
      getFormObjectRef: getFormObjectRef ?? { current: null },
    }),
    [getFormObjectRef]
  );

  return (
    <MemoryRouter>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <FormContext.Provider value={formCtxState}>
          <FormSectionA
            refs={refs}
            SectionOption={{
              id: "A",
              title: "Principal Investigator",
              component: FormSectionA,
            }}
          />
        </FormContext.Provider>
      </LocalizationProvider>
    </MemoryRouter>
  );
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFormMode.mockReturnValue({ formMode: "EDIT", readOnlyInputs: false });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("FormSectionA sequence-based PI locking", () => {
  it("locks configured PI fields when sequenceNumber is >= 2", () => {
    const formCtxState: FormContextState = {
      status: FormStatus.LOADED,
      formRef: createRef<HTMLFormElement>(),
      data: applicationFactory.build({
        sequenceNumber: 2,
        questionnaireData: baseQuestionnaireData,
      }),
    };

    const { container } = render(<TestParent formCtxState={formCtxState} />);

    expect(container.querySelector("#section-a-pi-first-name")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-last-name")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-position")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-email")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-orcid")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-institution")).toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-institution-address")).toHaveAttribute(
      "readonly"
    );

    // Control check: lock is PI-specific and should not affect primary contact fields.
    expect(container.querySelector("#section-a-primary-contact-first-name")).not.toHaveAttribute(
      "readonly"
    );
  });

  it("does not lock configured PI fields when sequenceNumber is 1", () => {
    const formCtxState: FormContextState = {
      status: FormStatus.LOADED,
      formRef: createRef<HTMLFormElement>(),
      data: applicationFactory.build({
        sequenceNumber: 1,
        questionnaireData: baseQuestionnaireData,
      }),
    };

    const { container } = render(<TestParent formCtxState={formCtxState} />);

    expect(container.querySelector("#section-a-pi-first-name")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-last-name")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-position")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-email")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-orcid")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-institution")).not.toHaveAttribute("readonly");
    expect(container.querySelector("#section-a-pi-institution-address")).not.toHaveAttribute(
      "readonly"
    );
  });
});

describe("Implementation Requirements", () => {
  it("should render all 'Receives all email communications' checkboxes with correct defaults", () => {
    const questionnaireData = questionnaireDataFactory.build({
      additionalContacts: contactFactory.build(1, { receivesEmails: false }),
    });

    const formCtxState: FormContextState = {
      status: FormStatus.LOADED,
      formRef: createRef<HTMLFormElement>(),
      data: applicationFactory.build({ questionnaireData }),
    };

    const { container } = render(<TestParent formCtxState={formCtxState} />);

    const piCheckbox = container.querySelector(
      "#section-a-pi-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(piCheckbox).toBeInTheDocument();
    expect(piCheckbox.value).toBe("false");

    const pcCheckbox = container.querySelector(
      "#section-a-primary-contact-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(pcCheckbox).toBeInTheDocument();
    expect(pcCheckbox.value).toBe("true");

    const acCheckboxes = container.querySelectorAll(
      "[id*='additionalContacts'][id*='receives-emails-checkbox']"
    );
    expect(acCheckboxes.length).toBe(1);
    expect((acCheckboxes[0] as HTMLInputElement).value).toBe("false");
  });

  it("should render the Primary Contact 'Receives all email communications' checkbox always checked and not allow unchecking", () => {
    const { container, getByTestId } = render(<TestParent />);

    const pcHiddenCheckbox = container.querySelector(
      "#section-a-primary-contact-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(pcHiddenCheckbox).toBeInTheDocument();
    expect(pcHiddenCheckbox.value).toBe("true");

    const pcEmailCheckbox = within(getByTestId("primary-contact-receives-emails")).getByRole(
      "checkbox"
    );

    fireEvent.click(pcEmailCheckbox);

    expect(pcHiddenCheckbox.value).toBe("true");
  });

  it("should disable the PI email checkbox when 'Same as Principal Investigator' is checked", () => {
    const questionnaireData = questionnaireDataFactory.build({
      piAsPrimaryContact: true,
      primaryContact: null,
    });

    const formCtxState: FormContextState = {
      status: FormStatus.LOADED,
      formRef: createRef<HTMLFormElement>(),
      data: applicationFactory.build({ questionnaireData }),
    };

    const { container, getByTestId } = render(<TestParent formCtxState={formCtxState} />);

    const piCheckbox = container.querySelector(
      "#section-a-pi-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(piCheckbox).toBeInTheDocument();
    expect(piCheckbox.value).toBe("true");

    const piEmailCheckbox = within(getByTestId("pi-receives-emails")).getByRole("checkbox");
    expect(piEmailCheckbox).toBeDisabled();
  });

  it("should allow toggling the PI email checkbox when 'Same as PI' is not checked", () => {
    const { container, getByTestId } = render(<TestParent />);

    const piHiddenCheckbox = container.querySelector(
      "#section-a-pi-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(piHiddenCheckbox.value).toBe("false");

    const piEmailCheckbox = within(getByTestId("pi-receives-emails")).getByRole("checkbox");

    fireEvent.click(piEmailCheckbox);

    expect(piHiddenCheckbox.value).toBe("true");
  });

  it("should render a receivesEmails checkbox for each Additional Contact when multiple exist", () => {
    const questionnaireData = questionnaireDataFactory.build({
      additionalContacts: contactFactory.build(3, { receivesEmails: false }),
    });

    const formCtxState: FormContextState = {
      status: FormStatus.LOADED,
      formRef: createRef<HTMLFormElement>(),
      data: applicationFactory.build({ questionnaireData }),
    };

    const { container } = render(<TestParent formCtxState={formCtxState} />);

    const acCheckboxes = container.querySelectorAll(
      "[id*='additionalContacts'][id*='receives-emails-checkbox']"
    );
    expect(acCheckboxes.length).toBe(3);
    acCheckboxes.forEach((checkbox: HTMLInputElement) => {
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.value).toBe("false");
    });
  });
});
