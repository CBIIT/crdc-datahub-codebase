import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { createRef, FC, useMemo } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import {
  Context as FormContext,
  ContextState as FormContextState,
  Status as FormStatus,
} from "@/components/Contexts/FormContext";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { studyFactory } from "@/factories/application/StudyFactory";
import { render } from "@/test-utils";

import FormSectionC from "./C";

const mockUseFormMode = vi.fn();

vi.mock("../../../hooks/useFormMode", () => ({
  default: () => mockUseFormMode(),
}));

type ParentProps = {
  formCtxState?: FormContextState;
  getFormObjectRef?: React.MutableRefObject<(() => FormObject | null) | null>;
};

const baseQuestionnaireData = questionnaireDataFactory.build({
  accessTypes: ["Open Access"],
  cancerTypes: [],
  numberOfParticipants: null,
  otherCancerTypes: "",
  otherCancerTypesEnabled: false,
  otherSpeciesEnabled: false,
  otherSpeciesOfSubjects: "",
  species: [],
  study: studyFactory.build({
    dbGaPPPHSNumber: "",
    GPAName: "",
    isDbGapRegistered: false,
  }),
});

const baseFormCtxState: FormContextState = {
  data: applicationFactory.build({
    questionnaireData: baseQuestionnaireData,
  }),
  formRef: createRef<HTMLFormElement>(),
  status: FormStatus.LOADED,
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
          <FormSectionC
            refs={refs}
            SectionOption={{
              component: FormSectionC,
              id: "C",
              title: "Data Access and Disease",
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

describe("FormSectionC", () => {
  describe("Species Label - Typo Fix Verification", () => {
    it("should not contain the typo 'Specie(s)' in component HTML", () => {
      const formCtxState: FormContextState = {
        data: applicationFactory.build({
          questionnaireData: questionnaireDataFactory.build({
            otherSpeciesEnabled: true,
            otherSpeciesOfSubjects: "Dog",
          }),
        }),
        formRef: createRef<HTMLFormElement>(),
        status: FormStatus.LOADED,
      };

      const { queryByText, container } = render(<TestParent formCtxState={formCtxState} />);

      expect(queryByText(/Specie\(s\) involved/)).not.toBeInTheDocument();
      expect(container.innerHTML).not.toContain("Specie(s)");
      expect(container.innerHTML).toContain("Species");
    });

    it("should render the component with other species field visible", () => {
      const formCtxState: FormContextState = {
        data: applicationFactory.build({
          questionnaireData: questionnaireDataFactory.build({
            otherSpeciesEnabled: true,
            otherSpeciesOfSubjects: "Test Species",
          }),
        }),
        formRef: createRef<HTMLFormElement>(),
        status: FormStatus.LOADED,
      };

      const { container } = render(<TestParent formCtxState={formCtxState} />);

      expect(container.innerHTML).not.toContain("Specie(s)");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Data Binding", () => {
    it("should display the dbGaP PHS number when provided", () => {
      const formCtxState: FormContextState = {
        data: applicationFactory.build({
          questionnaireData: questionnaireDataFactory.build({
            study: studyFactory.build({
              dbGaPPPHSNumber: "phs000001.v1.p1",
              isDbGapRegistered: true,
            }),
          }),
        }),
        formRef: createRef<HTMLFormElement>(),
        status: FormStatus.LOADED,
      };

      const { getByDisplayValue } = render(<TestParent formCtxState={formCtxState} />);

      expect(getByDisplayValue("phs000001.v1.p1")).toBeInTheDocument();
    });

    it("should display other species text when enabled", () => {
      const formCtxState: FormContextState = {
        data: applicationFactory.build({
          questionnaireData: questionnaireDataFactory.build({
            otherSpeciesEnabled: true,
            otherSpeciesOfSubjects: "Dog | Cat",
          }),
        }),
        formRef: createRef<HTMLFormElement>(),
        status: FormStatus.LOADED,
      };

      const { getByDisplayValue } = render(<TestParent formCtxState={formCtxState} />);

      expect(getByDisplayValue("Dog | Cat")).toBeInTheDocument();
    });

    it("should display the number of participants when provided", () => {
      const formCtxState: FormContextState = {
        data: applicationFactory.build({
          questionnaireData: questionnaireDataFactory.build({
            numberOfParticipants: 1000,
          }),
        }),
        formRef: createRef<HTMLFormElement>(),
        status: FormStatus.LOADED,
      };

      const { getByDisplayValue } = render(<TestParent formCtxState={formCtxState} />);

      expect(getByDisplayValue("1000")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should render form controls when component mounts", () => {
      const { queryAllByRole } = render(<TestParent />);

      const checkboxes = queryAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe("Read-only Mode", () => {
    it("should render in read-only mode without errors", () => {
      mockUseFormMode.mockReturnValue({ formMode: "VIEW", readOnlyInputs: true });

      const { container } = render(<TestParent />);

      expect(container).toBeInTheDocument();
    });
  });
});
