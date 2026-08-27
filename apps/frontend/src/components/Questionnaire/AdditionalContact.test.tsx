import { fireEvent, within } from "@testing-library/react";
import { FC, useMemo } from "react";
import { axe } from "vitest-axe";

import { contactFactory } from "@/factories/application/ContactFactory";
import { formContextStateFactory } from "@/factories/application/FormContextStateFactory";
import { render } from "@/test-utils";

import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "../Contexts/FormContext";

import AdditionalContact from "./AdditionalContact";

const mockUseFormMode = vi.fn();

vi.mock("@/hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

vi.mock("@/hooks/useAggregatedInstitutions", () => ({
  default: () => ({
    data: [{ _id: "inst-1", name: "National Cancer Institute" }],
  }),
}));

type TestParentProps = {
  children: React.ReactNode;
  formCtxState?: FormContextState;
};

const TestParent: FC<TestParentProps> = ({ children, formCtxState }) => {
  const value = useMemo(
    () => formCtxState ?? formContextStateFactory.build({ status: FormStatus.LOADED }),
    [formCtxState]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

const defaultContact = contactFactory.build({
  firstName: "Jane",
  lastName: "Doe",
  position: "Researcher",
  email: "jane.doe@example.com",
  phone: "555-000-1234",
  institution: "National Cancer Institute",
  institutionID: "inst-1",
  receivesEmails: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFormMode.mockReturnValue({ formMode: "EDIT", readOnlyInputs: false });
});

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(
      <TestParent>
        <AdditionalContact index={0} contact={defaultContact} onDelete={vi.fn()} />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render all contact fields correctly", () => {
    const { container } = render(
      <TestParent>
        <AdditionalContact
          idPrefix="section-a-"
          index={0}
          contact={defaultContact}
          onDelete={vi.fn()}
        />
      </TestParent>
    );

    const firstName = container.querySelector("#section-a-additionalContacts-0-first-name");
    expect(firstName).toBeInTheDocument();
    expect(firstName).toHaveValue("Jane");

    const lastName = container.querySelector("#section-a-additionalContacts-0-last-name");
    expect(lastName).toBeInTheDocument();
    expect(lastName).toHaveValue("Doe");

    const position = container.querySelector("#section-a-additionalContacts-0-position");
    expect(position).toBeInTheDocument();
    expect(position).toHaveValue("Researcher");

    const email = container.querySelector("#section-a-additionalContacts-0-email");
    expect(email).toBeInTheDocument();
    expect(email).toHaveValue("jane.doe@example.com");

    const phone = container.querySelector("#section-a-additionalContacts-0-phone-number");
    expect(phone).toBeInTheDocument();
    expect(phone).toHaveValue("555-000-1234");

    const institution = container.querySelector("#section-a-additionalContacts-0-institution");
    expect(institution).toBeInTheDocument();
    expect(institution).toHaveValue("National Cancer Institute");
  });
});

describe("Implementation Requirements", () => {
  it("should render the receivesEmails checkbox unchecked by default", () => {
    const { container } = render(
      <TestParent>
        <AdditionalContact
          idPrefix="section-a-"
          index={0}
          contact={contactFactory.build({ receivesEmails: false })}
          onDelete={vi.fn()}
        />
      </TestParent>
    );

    const hiddenCheckbox = container.querySelector(
      "#section-a-additionalContacts-0-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(hiddenCheckbox).toBeInTheDocument();
    expect(hiddenCheckbox.value).toBe("false");
  });

  it("should allow toggling the receivesEmails checkbox", () => {
    const { container, getByTestId } = render(
      <TestParent>
        <AdditionalContact
          idPrefix="section-a-"
          index={0}
          contact={contactFactory.build({ receivesEmails: false })}
          onDelete={vi.fn()}
        />
      </TestParent>
    );

    const hiddenCheckbox = container.querySelector(
      "#section-a-additionalContacts-0-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(hiddenCheckbox.value).toBe("false");

    const visibleCheckbox = within(getByTestId("additionalContacts-0-receives-emails")).getByRole(
      "checkbox"
    );
    fireEvent.click(visibleCheckbox);

    expect(hiddenCheckbox.value).toBe("true");

    fireEvent.click(visibleCheckbox);

    expect(hiddenCheckbox.value).toBe("false");
  });

  it("should render the receivesEmails checkbox checked when contact has receivesEmails true", () => {
    const { container } = render(
      <TestParent>
        <AdditionalContact
          idPrefix="section-a-"
          index={0}
          contact={contactFactory.build({ receivesEmails: true })}
          onDelete={vi.fn()}
        />
      </TestParent>
    );

    const hiddenCheckbox = container.querySelector(
      "#section-a-additionalContacts-0-receives-emails-checkbox"
    ) as HTMLInputElement;
    expect(hiddenCheckbox).toBeInTheDocument();
    expect(hiddenCheckbox.value).toBe("true");
  });
});
