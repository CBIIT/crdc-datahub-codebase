import ExcelJS, { Worksheet } from "exceljs";
import { v4 } from "uuid";

import cancerTypeOptions, { CUSTOM_CANCER_TYPES } from "@/config/CancerTypesConfig";
import { InitialQuestionnaire } from "@/config/InitialValues";
import { InitialSections } from "@/config/SectionConfig";
import speciesOptions from "@/config/SpeciesConfig";
import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";
import { contactFactory } from "@/factories/application/ContactFactory";
import { fileInfoFactory } from "@/factories/application/FileInfoFactory";
import { fundingFactory } from "@/factories/application/FundingFactory";
import { piFactory } from "@/factories/application/PIFactory";
import { plannedPublicationFactory } from "@/factories/application/PlannedPublicationFactory";
import { programInputFactory } from "@/factories/application/ProgramInputFactory";
import { publicationFactory } from "@/factories/application/PublicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { repositoryFactory } from "@/factories/application/RepositoryFactory";
import { studyFactory } from "@/factories/application/StudyFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import { waitFor } from "@/test-utils";
import { Logger } from "@/utils";

import { SectionAColumns } from "./Excel/A/SectionA";
import { SectionBColumns } from "./Excel/B/SectionB";
import { SectionCColumns } from "./Excel/C/SectionC";
import { SectionDColumns } from "./Excel/D/SectionD";
import { CONTENT } from "./Excel/Instructions/Content";
import {
  HIDDEN_SHEET_NAMES,
  QuestionnaireExcelMiddleware,
  TEMPLATE_VERSION,
} from "./QuestionnaireExcelMiddleware";

vi.mock(import("@/env"), async (importOriginal) => {
  const mod = await importOriginal();

  return {
    default: {
      ...mod.default,
      VITE_DEV_TIER: "mock-dev-tier",
      VITE_FE_VERSION: "5.5.0.959",
    },
  };
});

vi.mock("@/utils/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Serialization", () => {
  it("should set workbook metadata properties correctly during serialization", async () => {
    vi.setSystemTime(new Date("2025-06-07T14:11:00Z"));

    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    await middleware.setMetadataProperties();

    // @ts-expect-error Private member
    const wb = middleware.workbook;

    expect(wb.creator).toEqual("crdc-datahub-ui");
    expect(wb.lastModifiedBy).toEqual("crdc-datahub-ui");
    expect(wb.title).toEqual("CRDC Submission Request");
    expect(wb.subject).toEqual("CRDC Submission Request Template");
    expect(wb.company).toEqual("National Cancer Institute");
    expect(wb.created).toEqual(new Date("2025-06-07T14:11:00Z"));
    expect(wb.modified).toEqual(new Date("2025-06-07T14:11:00Z"));
  });

  describe("Template", () => {
    it("should generate the metadata sheet with available data", async () => {
      vi.setSystemTime(new Date("2025-01-07T17:34:00Z"));

      const middleware = new QuestionnaireExcelMiddleware(null, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeMetadata();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Metadata")).toEqual(sheet);

      // All of these are empty in the template
      expect(sheet.getCell("A2").value).toBeNull();
      expect(sheet.getCell("B2").value).toBeNull();
      expect(sheet.getCell("C2").value).toBeNull();
      expect(sheet.getCell("D2").value).toBeNull();
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getCell("F2").value).toBeNull();
      expect(sheet.getCell("G2").value).toBeNull();

      // Pre-filled data
      expect(sheet.getCell("H2").value).toEqual("mock-dev-tier");
      expect(sheet.getCell("I2").value).toEqual(TEMPLATE_VERSION);
      expect(sheet.getCell("J2").value).toEqual("5.5.0");
      expect(sheet.getCell("K2").value).toEqual(new Date("2025-01-07T17:34:00Z").toISOString());
    });

    it("should display the instructions sheet", async () => {
      vi.setSystemTime(new Date("2025-01-07T17:34:00Z"));

      const middleware = new QuestionnaireExcelMiddleware(null, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeInstructions();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Instructions")).toEqual(sheet);

      expect(sheet.getCell("B2").value).toEqual("Instructions");
      expect(sheet.getCell("B4").value).toEqual(CONTENT.sections.intro.title);
      expect(sheet.getCell("B5").value).toEqual(CONTENT.sections.intro.description);
      expect(sheet.getCell("B6").value).toEqual(CONTENT.sections.getStarted.title);
      expect(sheet.getCell("B7").value).toEqual(CONTENT.sections.getStarted.description);
      expect(sheet.getCell("C8").value).toEqual(CONTENT.sections.getStarted.table.types[0]);
      expect(sheet.getCell("C9").value).toEqual(CONTENT.sections.getStarted.table.types[1]);
      expect(sheet.getCell("C10").value).toEqual(CONTENT.sections.getStarted.table.types[2]);
      expect(sheet.getCell("E8").value).toEqual(CONTENT.sections.getStarted.table.descriptions[0]);
      expect(sheet.getCell("E9").value).toEqual(CONTENT.sections.getStarted.table.descriptions[1]);
      expect(sheet.getCell("E10").value).toEqual(CONTENT.sections.getStarted.table.descriptions[2]);
      expect(sheet.getCell("B12").value).toEqual(CONTENT.sections.dependentCells.title);
      expect(sheet.getCell("D14").value).toEqual(CONTENT.sections.dependentCells.descriptions[0]);
      expect(sheet.getCell("D15").value).toEqual(CONTENT.sections.dependentCells.descriptions[1]);
      expect(sheet.getCell("D16").value).toEqual(CONTENT.sections.dependentCells.descriptions[2]);
      expect(sheet.getCell("B18").value).toEqual(CONTENT.sections.faq.title);
      expect(sheet.getCell("B20").value).toEqual(CONTENT.sections.faq.questions[0].question);
      expect(sheet.getCell("B21").value).toEqual(CONTENT.sections.faq.questions[0].answer);
      expect(sheet.getCell("B23").value).toEqual(CONTENT.sections.faq.questions[1].question);
      expect(sheet.getCell("B24").value).toEqual(CONTENT.sections.faq.questions[1].answer);
      expect(sheet.getCell("B26").value).toEqual(CONTENT.sections.faq.questions[2].question);
      expect(sheet.getCell("B27").value).toEqual(CONTENT.sections.faq.questions[2].answer);
    });

    it("should generate SectionA sheet with all dependent sheets", async () => {
      const mockInstitutions = vi.fn().mockResolvedValue(null);

      const middleware = new QuestionnaireExcelMiddleware(null, {
        getInstitutions: mockInstitutions,
      });

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.institutions)).toBeDefined();
      expect(mockInstitutions).toHaveBeenCalled();

      // NOTE: Values are 1-indexed, need to use a empty value at 0 index
      // eslint-disable-next-line no-sparse-arrays
      expect(sheet.getRow(1).values).toEqual([, ...SectionAColumns.map((col) => col.header)]);
    });

    it("should generate SectionB sheet with all dependent sheets", async () => {
      const mockPrograms = vi.fn().mockResolvedValue(null);

      const middleware = new QuestionnaireExcelMiddleware(null, {
        getPrograms: mockPrograms,
      });

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.programs)).toBeDefined();
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.fundingAgencies)).toBeDefined();
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.repositoryDataTypes)).toBeDefined();
      expect(mockPrograms).toHaveBeenCalled();

      // NOTE: Values are 1-indexed, need to use a empty value at 0 index
      // eslint-disable-next-line no-sparse-arrays
      expect(sheet.getRow(1).values).toEqual([, ...SectionBColumns.map((col) => col.header)]);
    });

    it("should generate SectionC sheet with all dependent sheets", async () => {
      const middleware = new QuestionnaireExcelMiddleware(null, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionC();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Access and Disease")).toEqual(sheet);
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.cancerTypes)).toBeDefined();
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.speciesOptions)).toBeDefined();

      // NOTE: Values are 1-indexed, need to use a empty value at 0 index
      // eslint-disable-next-line no-sparse-arrays
      expect(sheet.getRow(1).values).toEqual([, ...SectionCColumns.map((col) => col.header)]);
    });

    it("should generate SectionD sheet with all dependent sheets", async () => {
      const mockPrograms = vi.fn().mockResolvedValue(null);

      const middleware = new QuestionnaireExcelMiddleware(null, {
        getPrograms: mockPrograms,
      });

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);
      expect(wb.getWorksheet(HIDDEN_SHEET_NAMES.programs)).toBeDefined();
      expect(mockPrograms).toHaveBeenCalled();

      // NOTE: Values are 1-indexed, need to use a empty value at 0 index
      // eslint-disable-next-line no-sparse-arrays
      expect(sheet.getRow(1).values).toEqual([, ...SectionDColumns.map((col) => col.header)]);
    });
  });

  describe("With Data", () => {
    it("should generate the metadata sheet with pre-filled data", async () => {
      vi.setSystemTime(new Date("2025-03-15T22:36:00Z"));

      const middleware = new QuestionnaireExcelMiddleware(null, {
        application: applicationFactory.build({
          _id: "a mock uuid",
          status: "In Progress",
          version: "1.5",
          applicant: applicantFactory.build({
            applicantID: "a-mock-uuid-for-id",
            applicantName: "a-mock-name of a user",
          }),
          createdAt: "2025-02-15T22:36:00Z",
          updatedAt: "2025-02-16T22:36:00Z",
        }),
      });

      // @ts-expect-error Private member
      const sheet = await middleware.serializeMetadata();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Metadata")).toEqual(sheet);

      expect(sheet.getCell("A2").value).toEqual("a mock uuid");
      expect(sheet.getCell("B2").value).toEqual("a-mock-name of a user");
      expect(sheet.getCell("C2").value).toEqual("a-mock-uuid-for-id");
      expect(sheet.getCell("D2").value).toEqual("In Progress");
      expect(sheet.getCell("E2").value).toEqual("1.5");
      expect(sheet.getCell("F2").value).toEqual("2025-02-15T22:36:00Z");
      expect(sheet.getCell("G2").value).toEqual("2025-02-16T22:36:00Z");
      expect(sheet.getCell("H2").value).toEqual("mock-dev-tier");
      expect(sheet.getCell("I2").value).toEqual(TEMPLATE_VERSION);
      expect(sheet.getCell("J2").value).toEqual("5.5.0");
      expect(sheet.getCell("K2").value).toEqual(new Date("2025-03-15T22:36:00Z").toISOString());
    });

    it("should generate SectionA sheet with all data", async () => {
      const mockForm = questionnaireDataFactory.build({
        pi: piFactory.build({
          firstName: "benjamin",
          lastName: "bunny",
          position: "Some PI Position",
          email: "benjamin.bunny@example.com",
          ORCID: "1234-5678-9012-3456",
          institution: "A Mock Institution",
          address: "123 Bunny Lane, Bunnyville, USA 20001",
        }),
        piAsPrimaryContact: false,
        primaryContact: contactFactory.build({
          firstName: "Radish",
          lastName: "Rabbit",
          position: "Some Contact Position",
          email: "radish.rabbit@example.com",
          institution: "Another Mock Institution",
          phone: "957-123-9393",
        }),
        additionalContacts: contactFactory.build(3, (idx) => ({
          firstName: `Contact ${idx + 1} First`,
          lastName: `Contact ${idx + 1} Last`,
          position: `Contact ${idx + 1} Position`,
          email: `contact${idx + 1}@example.com`,
          institution: `Contact ${idx + 1} Institution`,
          phone: `555-123-${9000 + idx}`,
        })),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);

      // PI
      expect(sheet.getCell("A2").value).toEqual("benjamin");
      expect(sheet.getCell("B2").value).toEqual("bunny");
      expect(sheet.getCell("C2").value).toEqual("Some PI Position");
      expect(sheet.getCell("D2").value).toEqual("benjamin.bunny@example.com");
      expect(sheet.getCell("E2").value).toEqual("1234-5678-9012-3456");
      expect(sheet.getCell("F2").value).toEqual("A Mock Institution");
      expect(sheet.getCell("G2").value).toEqual("123 Bunny Lane, Bunnyville, USA 20001");

      // Primary Contact
      expect(sheet.getCell("H2").value).toEqual("No");
      expect(sheet.getCell("I2").value).toEqual("Radish");
      expect(sheet.getCell("J2").value).toEqual("Rabbit");
      expect(sheet.getCell("K2").value).toEqual("Some Contact Position");
      expect(sheet.getCell("L2").value).toEqual("radish.rabbit@example.com");
      expect(sheet.getCell("M2").value).toEqual("Another Mock Institution");
      expect(sheet.getCell("N2").value).toEqual("957-123-9393");

      // Additional Contacts x3
      expect(sheet.getColumn("O").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 First",
        "Contact 2 First",
        "Contact 3 First",
      ]);
      expect(sheet.getColumn("P").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Last",
        "Contact 2 Last",
        "Contact 3 Last",
      ]);
      expect(sheet.getColumn("Q").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Position",
        "Contact 2 Position",
        "Contact 3 Position",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "contact1@example.com",
        "contact2@example.com",
        "contact3@example.com",
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Institution",
        "Contact 2 Institution",
        "Contact 3 Institution",
      ]);
      expect(sheet.getColumn("T").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "555-123-9000",
        "555-123-9001",
        "555-123-9002",
      ]);
    });

    it("should generate SectionA sheet with partial data (only PI)", async () => {
      const mockForm = questionnaireDataFactory.build({
        pi: piFactory.build({
          firstName: "benjamin",
          lastName: "bunny",
          position: "Some PI Position",
          email: "benjamin.bunny@example.com",
          ORCID: "1234-5678-9012-3456",
          institution: "A Mock Institution",
          address: "123 Bunny Lane, Bunnyville, USA 20001",
        }),
        piAsPrimaryContact: null,
        primaryContact: null,
        additionalContacts: null,
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);

      // PI
      expect(sheet.getCell("A2").value).toEqual("benjamin");
      expect(sheet.getCell("B2").value).toEqual("bunny");
      expect(sheet.getCell("C2").value).toEqual("Some PI Position");
      expect(sheet.getCell("D2").value).toEqual("benjamin.bunny@example.com");
      expect(sheet.getCell("E2").value).toEqual("1234-5678-9012-3456");
      expect(sheet.getCell("F2").value).toEqual("A Mock Institution");
      expect(sheet.getCell("G2").value).toEqual("123 Bunny Lane, Bunnyville, USA 20001");
    });

    it("should generate SectionA sheet with partial data (only Primary Contact)", async () => {
      const mockForm = questionnaireDataFactory.build({
        pi: null,
        piAsPrimaryContact: false,
        primaryContact: contactFactory.build({
          firstName: "Radish",
          lastName: "Rabbit",
          position: "Some Contact Position",
          email: "radish.rabbit@example.com",
          institution: "Another Mock Institution",
          phone: "957-123-9393",
        }),
        additionalContacts: null,
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);

      // Primary Contact
      expect(sheet.getCell("H2").value).toEqual("No");
      expect(sheet.getCell("I2").value).toEqual("Radish");
      expect(sheet.getCell("J2").value).toEqual("Rabbit");
      expect(sheet.getCell("K2").value).toEqual("Some Contact Position");
      expect(sheet.getCell("L2").value).toEqual("radish.rabbit@example.com");
      expect(sheet.getCell("M2").value).toEqual("Another Mock Institution");
      expect(sheet.getCell("N2").value).toEqual("957-123-9393");
    });

    it("should generate SectionA sheet with partial data (only Additional Contacts)", async () => {
      const mockForm = questionnaireDataFactory.build({
        pi: null,
        piAsPrimaryContact: true,
        primaryContact: null,
        additionalContacts: contactFactory.build(3, (idx) => ({
          firstName: `Contact ${idx + 1} First`,
          lastName: `Contact ${idx + 1} Last`,
          position: `Contact ${idx + 1} Position`,
          email: `contact${idx + 1}@example.com`,
          institution: `Contact ${idx + 1} Institution`,
          phone: `555-123-${9000 + idx}`,
        })),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);

      // Additional Contacts x3
      expect(sheet.getColumn("O").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 First",
        "Contact 2 First",
        "Contact 3 First",
      ]);
      expect(sheet.getColumn("P").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Last",
        "Contact 2 Last",
        "Contact 3 Last",
      ]);
      expect(sheet.getColumn("Q").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Position",
        "Contact 2 Position",
        "Contact 3 Position",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "contact1@example.com",
        "contact2@example.com",
        "contact3@example.com",
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Contact 1 Institution",
        "Contact 2 Institution",
        "Contact 3 Institution",
      ]);
      expect(sheet.getColumn("T").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "555-123-9000",
        "555-123-9001",
        "555-123-9002",
      ]);
    });

    it("should generate SectionA sheet with partial data (All null)", async () => {
      const mockForm = questionnaireDataFactory.build({
        pi: piFactory.build({
          firstName: null,
          lastName: null,
          position: null,
          email: null,
          ORCID: null,
          institution: null,
          address: null,
        }),
        piAsPrimaryContact: null,
        primaryContact: contactFactory.build({
          firstName: null,
          lastName: null,
          position: null,
          email: null,
          institution: null,
          phone: null,
        }),
        additionalContacts: contactFactory.build(3, () => ({
          firstName: null,
          lastName: null,
          position: null,
          email: null,
          institution: null,
          phone: null,
        })),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionA();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("PI and Contact")).toEqual(sheet);

      // PI
      expect(sheet.getCell("A2").value).toBeNull();
      expect(sheet.getCell("B2").value).toBeNull();
      expect(sheet.getCell("C2").value).toBeNull();
      expect(sheet.getCell("D2").value).toBeNull();
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getCell("F2").value).toBeNull();
      expect(sheet.getCell("G2").value).toBeNull();

      // Primary Contact
      expect(sheet.getCell("H2").value).toEqual("No"); // Default value
      expect(sheet.getCell("I2").value).toBeNull();
      expect(sheet.getCell("J2").value).toBeNull();
      expect(sheet.getCell("K2").value).toBeNull();
      expect(sheet.getCell("L2").value).toBeNull();
      expect(sheet.getCell("M2").value).toBeNull();
      expect(sheet.getCell("N2").value).toBeNull();

      // Additional Contacts x3
      expect(sheet.getColumn("O").values.length).toBe(2); // 1-indexed and header only
      expect(sheet.getColumn("P").values.length).toBe(2);
      expect(sheet.getColumn("Q").values.length).toBe(2);
      expect(sheet.getColumn("R").values.length).toBe(2);
      expect(sheet.getColumn("S").values.length).toBe(2);
      expect(sheet.getColumn("T").values.length).toBe(2);
    });

    it("should generate SectionB sheet with all data", async () => {
      const mockForm = questionnaireDataFactory.build({
        program: {
          _id: "Other",
          name: "Test Program",
          abbreviation: "TP",
          description: "Test Program Description",
        },
        study: studyFactory.build({
          name: "Test Study",
          abbreviation: "TS",
          description: "Test Study Description",
          funding: [
            fundingFactory.build({
              agency: "Test Agency",
              grantNumbers: "12345",
              nciProgramOfficer: "John Doe",
            }),
            fundingFactory.build({
              agency: "Test Agency 2",
              grantNumbers: "6789",
              nciProgramOfficer: "Jane Smith",
            }),
          ],
          publications: [
            publicationFactory.build({
              title: "Test Publication",
              pubmedID: "12345678",
              DOI: "10.1234/test",
            }),
            publicationFactory.build({
              title: "Test Publication 2",
              pubmedID: "87654321",
              DOI: "10.1234/random2",
            }),
          ],
          plannedPublications: [
            plannedPublicationFactory.build({
              title: "Test Planned Publication",
              expectedDate: "2026-01-01",
            }),
            plannedPublicationFactory.build({
              title: "Test Planned Publication 2",
              expectedDate: "2027-01-01",
            }),
          ],
          repositories: [
            repositoryFactory.build({
              name: "Repository 1",
              studyID: "02ec12d2-12c2-45b6-b12d-9fd954f696b8",
              dataTypesSubmitted: ["clinicalTrial", "genomics", "imaging", "proteomics"],
              otherDataTypesSubmitted: "other 1 | other 2 | other 3",
            }),
            repositoryFactory.build({
              name: "Repository 2",
              studyID: "03ec12d2-12c2-45b6-b12d-9fd954f696b8",
              dataTypesSubmitted: [],
              otherDataTypesSubmitted: "other 1",
            }),
          ],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Program
      expect(sheet.getCell("A2").value).toEqual("Other");
      expect(sheet.getCell("B2").value).toEqual("Test Program");
      expect(sheet.getCell("C2").value).toEqual("TP");
      expect(sheet.getCell("D2").value).toEqual("Test Program Description");

      // Study
      expect(sheet.getCell("E2").value).toEqual("Test Study");
      expect(sheet.getCell("F2").value).toEqual("TS");
      expect(sheet.getCell("G2").value).toEqual("Test Study Description");

      // Funding agency
      expect(sheet.getColumn("H").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Test Agency",
        "Test Agency 2",
      ]);
      expect(sheet.getColumn("I").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "12345",
        "6789",
      ]);
      expect(sheet.getColumn("J").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "John Doe",
        "Jane Smith",
      ]);

      // Publications
      expect(sheet.getColumn("K").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Test Publication",
        "Test Publication 2",
      ]);
      expect(sheet.getColumn("L").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "12345678",
        "87654321",
      ]);
      expect(sheet.getColumn("M").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "10.1234/test",
        "10.1234/random2",
      ]);

      // Planned Publications
      expect(sheet.getColumn("N").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Test Planned Publication",
        "Test Planned Publication 2",
      ]);
      expect(sheet.getColumn("O").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "2026-01-01",
        "2027-01-01",
      ]);

      // Repositories
      expect(sheet.getColumn("P").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "Repository 1",
        "Repository 2",
      ]);
      expect(sheet.getColumn("Q").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "02ec12d2-12c2-45b6-b12d-9fd954f696b8",
        "03ec12d2-12c2-45b6-b12d-9fd954f696b8",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "clinicalTrial | genomics | imaging | proteomics",
        // null
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "other 1 | other 2 | other 3",
        "other 1",
      ]);
    });

    it("should generate SectionB sheet with partial data (only Programs)", async () => {
      const mockForm = questionnaireDataFactory.build({
        program: {
          _id: "Other",
          name: "Only Program Test",
          abbreviation: "OPT",
          description:
            "Only Program Test Description with additional detail to ensure coverage of longer strings.",
        },
        study: studyFactory.build({
          name: "",
          abbreviation: "",
          description: "",
          funding: [],
          publications: [],
          plannedPublications: [],
          repositories: [],
        }),
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Program
      expect(sheet.getCell("A2").value).toEqual("Other");
      expect(sheet.getCell("B2").value).toEqual("Only Program Test");
      expect(sheet.getCell("C2").value).toEqual("OPT");
      expect(sheet.getCell("D2").value).toEqual(
        "Only Program Test Description with additional detail to ensure coverage of longer strings."
      );

      for (const col of ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (only Studies)", async () => {
      const mockForm = questionnaireDataFactory.build({
        study: studyFactory.build({
          name: "Longitudinal Cancer Cohort Study",
          abbreviation: "LCCS",
          description:
            "A multi-center cohort with deep longitudinal phenotyping and biospecimen collection.",
          funding: [],
          publications: [],
          plannedPublications: [],
          repositories: [],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Study
      expect(sheet.getCell("E2").value).toEqual("Longitudinal Cancer Cohort Study");
      expect(sheet.getCell("F2").value).toEqual("LCCS");
      expect(sheet.getCell("G2").value).toEqual(
        "A multi-center cohort with deep longitudinal phenotyping and biospecimen collection."
      );

      for (const col of ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (only Funding Agency)", async () => {
      const mockForm = questionnaireDataFactory.build({
        study: studyFactory.build({
          name: "",
          abbreviation: "",
          description: "",
          funding: [
            fundingFactory.build({
              agency: "NIH/NCI",
              grantNumbers: "P30CA012345; U24CA067890",
              nciProgramOfficer: "Alice Johnson",
            }),
            fundingFactory.build({
              agency: "Department of Defense",
              grantNumbers: "W81XWH-22-1234",
              nciProgramOfficer: "—",
            }),
            fundingFactory.build({
              agency: "Stand Up To Cancer",
              grantNumbers: "SU2C-AACR-HT-01",
              nciProgramOfficer: "Bob Lee",
            }),
          ],
          publications: [],
          plannedPublications: [],
          repositories: [],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Funding agency
      expect(sheet.getColumn("H").values).toEqual([
        undefined,
        expect.any(String),
        "NIH/NCI",
        "Department of Defense",
        "Stand Up To Cancer",
      ]);
      expect(sheet.getColumn("I").values).toEqual([
        undefined,
        expect.any(String),
        "P30CA012345; U24CA067890",
        "W81XWH-22-1234",
        "SU2C-AACR-HT-01",
      ]);
      expect(sheet.getColumn("J").values).toEqual([
        undefined,
        expect.any(String),
        "Alice Johnson",
        "—",
        "Bob Lee",
      ]);

      for (const col of ["K", "L", "M", "N", "O", "P", "Q", "R", "S"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (only Publications)", async () => {
      const mockForm = questionnaireDataFactory.build({
        study: studyFactory.build({
          name: "",
          abbreviation: "",
          description: "",
          funding: [],
          publications: [
            publicationFactory.build({
              title: "Comprehensive Genomic Profiling of Rare Tumors",
              pubmedID: "98765432",
              DOI: "10.1000/j.journal.2025.01.001",
            }),
            publicationFactory.build({
              title: "Proteomic Landscapes Across Cancer Subtypes",
              pubmedID: "11223344",
              DOI: "10.1000/j.journal.2025.02.002",
            }),
            publicationFactory.build({
              title: "Imaging Biomarkers for Immunotherapy Response",
              pubmedID: "55667788",
              DOI: "10.1000/j.journal.2025.03.003",
            }),
          ],
          plannedPublications: [],
          repositories: [],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Publications
      expect(sheet.getColumn("K").values).toEqual([
        undefined,
        expect.any(String),
        "Comprehensive Genomic Profiling of Rare Tumors",
        "Proteomic Landscapes Across Cancer Subtypes",
        "Imaging Biomarkers for Immunotherapy Response",
      ]);
      expect(sheet.getColumn("L").values).toEqual([
        undefined,
        expect.any(String),
        "98765432",
        "11223344",
        "55667788",
      ]);
      expect(sheet.getColumn("M").values).toEqual([
        undefined,
        expect.any(String),
        "10.1000/j.journal.2025.01.001",
        "10.1000/j.journal.2025.02.002",
        "10.1000/j.journal.2025.03.003",
      ]);

      for (const col of ["H", "I", "J", "N", "O", "P", "Q", "R", "S"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (only Planned Publications)", async () => {
      const mockForm = questionnaireDataFactory.build({
        study: studyFactory.build({
          name: "",
          abbreviation: "",
          description: "",
          funding: [],
          publications: [],
          plannedPublications: [
            plannedPublicationFactory.build({
              title: "Multi-omic Atlas of Tumor Microenvironment",
              expectedDate: "2025-11-15",
            }),
            plannedPublicationFactory.build({
              title: "Harmonized Clinical-Genomic Outcomes Study",
              expectedDate: "2026-06-30",
            }),
            plannedPublicationFactory.build({
              title: "Benchmarking AI Models in Oncology Imaging",
              expectedDate: "2027-12-01",
            }),
          ],
          repositories: [],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Planned Publications
      expect(sheet.getColumn("N").values).toEqual([
        undefined,
        expect.any(String),
        "Multi-omic Atlas of Tumor Microenvironment",
        "Harmonized Clinical-Genomic Outcomes Study",
        "Benchmarking AI Models in Oncology Imaging",
      ]);
      expect(sheet.getColumn("O").values).toEqual([
        undefined,
        expect.any(String),
        "2025-11-15",
        "2026-06-30",
        "2027-12-01",
      ]);

      for (const col of ["H", "I", "J", "K", "L", "M", "P", "Q", "R", "S"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (only Repositories)", async () => {
      const mockForm = questionnaireDataFactory.build({
        study: studyFactory.build({
          name: "",
          abbreviation: "",
          description: "",
          funding: [],
          publications: [],
          plannedPublications: [],
          repositories: [
            repositoryFactory.build({
              name: "Genomic Data Commons",
              studyID: "GDC-001",
              dataTypesSubmitted: ["genomics", "proteomics"],
              otherDataTypesSubmitted: "other g1 | other g2",
            }),
            repositoryFactory.build({
              name: "The Cancer Imaging Archive",
              studyID: "TCIA-ABC-789",
              dataTypesSubmitted: ["clinicalTrial", "imaging"],
              otherDataTypesSubmitted: "other i1",
            }),
            repositoryFactory.build({
              name: "Custom Repository 3",
              studyID: "CR3-555",
              dataTypesSubmitted: [],
              otherDataTypesSubmitted: "metabolomics | transcriptomics",
            }),
          ],
        }),
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Repositories
      expect(sheet.getColumn("P").values).toEqual([
        undefined,
        expect.any(String),
        "Genomic Data Commons",
        "The Cancer Imaging Archive",
        "Custom Repository 3",
      ]);
      expect(sheet.getColumn("Q").values).toEqual([
        undefined,
        expect.any(String),
        "GDC-001",
        "TCIA-ABC-789",
        "CR3-555",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined,
        expect.any(String),
        "genomics | proteomics",
        "clinicalTrial | imaging",
        // null
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined,
        expect.any(String),
        "other g1 | other g2",
        "other i1",
        "metabolomics | transcriptomics",
      ]);

      for (const col of ["H", "I", "J", "K", "L", "M", "N", "O"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionB sheet with partial data (all null)", async () => {
      const mockForm = questionnaireDataFactory.build({
        program: {
          _id: null,
          name: null,
          abbreviation: null,
          description: null,
        },
        study: studyFactory.build({
          name: null,
          abbreviation: null,
          description: null,
          funding: [
            fundingFactory.build({
              agency: null,
              grantNumbers: null,
              nciProgramOfficer: null,
            }),
            fundingFactory.build({
              agency: null,
              grantNumbers: null,
              nciProgramOfficer: null,
            }),
          ],
          publications: [
            publicationFactory.build({
              title: null,
              pubmedID: null,
              DOI: null,
            }),
            publicationFactory.build({
              title: null,
              pubmedID: null,
              DOI: null,
            }),
          ],
          plannedPublications: [
            plannedPublicationFactory.build({
              title: null,
              expectedDate: null,
            }),
            plannedPublicationFactory.build({
              title: null,
              expectedDate: null,
            }),
          ],
          repositories: [
            repositoryFactory.build({
              name: null,
              studyID: null,
              dataTypesSubmitted: null,
              otherDataTypesSubmitted: null,
            }),
            repositoryFactory.build({
              name: null,
              studyID: null,
              dataTypesSubmitted: null,
              otherDataTypesSubmitted: null,
            }),
          ],
        }),
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Program
      expect(sheet.getCell("A2").value).toBeNull();
      expect(sheet.getCell("B2").value).toBeNull();
      expect(sheet.getCell("C2").value).toBeNull();
      expect(sheet.getCell("D2").value).toBeNull();

      // Study
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getCell("F2").value).toBeNull();
      expect(sheet.getCell("G2").value).toBeNull();

      const dynamicCols = [
        "H",
        "I",
        "J", // Funding
        "K",
        "L",
        "M", // Publications
        "N",
        "O", // Planned Publications
        "P",
        "Q",
        "R",
        "S", // Repositories
      ];

      for (const col of dynamicCols) {
        const { values } = sheet.getColumn(col);

        // First two entries: 1-index padding + header
        expect(values[0]).toBeUndefined();
        expect(values[1]).toEqual(expect.any(String));

        values.slice(2)?.forEach((value) => {
          expect(value === null).toBe(true);
        });
      }
    });

    it("should generate SectionB sheet with partial data (fully null)", async () => {
      const mockForm = questionnaireDataFactory.build({
        program: {
          _id: null,
          name: null,
          abbreviation: null,
          description: null,
        },
        study: studyFactory.build({
          name: null,
          abbreviation: null,
          description: null,
          funding: null,
          publications: null,
          plannedPublications: null,
          repositories: null,
        }),
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionB();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Program and Study")).toEqual(sheet);

      // Program
      expect(sheet.getCell("A2").value).toBeNull();
      expect(sheet.getCell("B2").value).toBeNull();
      expect(sheet.getCell("C2").value).toBeNull();
      expect(sheet.getCell("D2").value).toBeNull();

      // Study
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getCell("F2").value).toBeNull();
      expect(sheet.getCell("G2").value).toBeNull();

      const dynamicCols = [
        "H",
        "I",
        "J", // Funding
        "K",
        "L",
        "M", // Publications
        "N",
        "O", // Planned Publications
        "P",
        "Q",
        "R",
        "S", // Repositories
      ];

      for (const col of dynamicCols) {
        const { values } = sheet.getColumn(col);

        // First two entries: 1-index padding + header
        expect(values[0]).toBeUndefined();
        expect(values[1]).toEqual(expect.any(String));

        values.slice(2)?.forEach((value) => {
          expect(value === null).toBe(true);
        });
      }
    });

    it("should generate SectionC sheet with all data", async () => {
      const mockForm = questionnaireDataFactory.build({
        accessTypes: ["Open Access"],
        study: studyFactory.build({
          isDbGapRegistered: true,
          dbGaPPPHSNumber: "phs100009.v6.a1",
          GPAName: "Benjamin 'Gpa' Bunny",
        }),
        cancerTypes: cancerTypeOptions.slice(1, 10),
        otherCancerTypes: "Some option | Another Option | xyz 123",
        preCancerTypes: "Pre-cancer type 1 | Pre-cancer type 2",
        species: speciesOptions.slice(0, speciesOptions.length - 1),
        otherSpeciesOfSubjects: "Mythical Creature",
        numberOfParticipants: 150_000,
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionC();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Access and Disease")).toEqual(sheet);

      expect(sheet.getCell("A2").value).toEqual("Yes");
      expect(sheet.getCell("B2").value).toEqual("No"); // Not 'Controlled Access'
      expect(sheet.getCell("C2").value).toEqual("Yes");
      expect(sheet.getCell("D2").value).toEqual("phs100009.v6.a1");
      expect(sheet.getCell("E2").value).toEqual("Benjamin 'Gpa' Bunny");
      expect(sheet.getColumn("F").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        ...cancerTypeOptions.slice(1, 10),
      ]);
      expect(sheet.getCell("G2").value).toEqual("Some option | Another Option | xyz 123");
      expect(sheet.getCell("H2").value).toEqual("Pre-cancer type 1 | Pre-cancer type 2");
      expect(sheet.getColumn("I").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        ...speciesOptions.slice(0, speciesOptions.length - 1),
      ]);
      expect(sheet.getCell("J2").value).toEqual("Mythical Creature");
      expect(sheet.getCell("K2").value).toEqual(150_000);
    });

    it("should generate SectionC sheet with partial data (no study)", async () => {
      const mockForm = questionnaireDataFactory.build({
        accessTypes: ["Controlled Access"],
        study: null,
        cancerTypes: cancerTypeOptions.slice(1, 2),
        otherCancerTypes: "some unlisted type",
        preCancerTypes: "some unlisted p-type",
        species: speciesOptions.slice(0, 1),
        otherSpeciesOfSubjects: "Zebra",
        numberOfParticipants: 10,
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionC();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Access and Disease")).toEqual(sheet);

      expect(sheet.getCell("A2").value).toEqual("No"); // Not 'Open Access'
      expect(sheet.getCell("B2").value).toEqual("Yes");
      expect(sheet.getCell("C2").value).toEqual("No"); // Default if not provided
      expect(sheet.getCell("D2").value).toBeNull();
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getColumn("F").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        ...cancerTypeOptions.slice(1, 2),
      ]);
      expect(sheet.getCell("G2").value).toEqual("some unlisted type");
      expect(sheet.getCell("H2").value).toEqual("some unlisted p-type");
      expect(sheet.getColumn("I").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        ...speciesOptions.slice(0, 1),
      ]);
      expect(sheet.getCell("J2").value).toEqual("Zebra");
      expect(sheet.getCell("K2").value).toEqual(10);
    });

    it("should generate SectionC sheet with partial data (all null)", async () => {
      const mockForm = questionnaireDataFactory.build({
        accessTypes: null,
        study: null,
        cancerTypes: null,
        otherCancerTypes: null,
        preCancerTypes: null,
        species: null,
        otherSpeciesOfSubjects: null,
        numberOfParticipants: null,
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionC();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Access and Disease")).toEqual(sheet);

      expect(sheet.getCell("A2").value).toEqual("No"); // Defaults if not provided
      expect(sheet.getCell("B2").value).toEqual("No");
      expect(sheet.getCell("C2").value).toEqual("No");
      expect(sheet.getCell("D2").value).toBeNull();
      expect(sheet.getCell("E2").value).toBeNull();
      expect(sheet.getColumn("F").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
      ]);
      expect(sheet.getCell("G2").value).toBeNull();
      expect(sheet.getCell("H2").value).toBeNull();
      expect(sheet.getColumn("I").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
      ]);
      expect(sheet.getCell("J2").value).toBeNull();
      expect(sheet.getCell("K2").value).toBeNull();
    });

    it("should generate SectionD sheet with all data", async () => {
      const mockForm = questionnaireDataFactory.build({
        targetedSubmissionDate: "03/15/2030",
        targetedReleaseDate: "03/15/2030",
        dataTypes: ["clinicalTrial", "genomics", "imaging", "proteomics"],
        imagingDataDeIdentified: true,
        otherDataTypes: "other 1 | other 2 | other 3",
        clinicalData: {
          dataTypes: [
            "biospecimenData",
            "demographicData",
            "diagnosisData",
            "outcomeData",
            "relapseRecurrenceData",
            "treatmentData",
          ],
          otherDataTypes: "other 1 | other 2 | other 3",
          futureDataTypes: true,
        },
        files: fileInfoFactory.build(3, (index) => ({
          type: `type-${index + 1}`,
          extension: `ext${index + 1}`,
          count: index + 1,
          amount: `${(index + 1) * 10} MB`,
        })),
        dataDeIdentified: true,
        cellLines: true,
        modelSystems: true,
        submitterComment: "Lorem Ipsum",
      });
      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Target Dates
      expect(sheet.getCell("A2").value).toEqual("03/15/2030");
      expect(sheet.getCell("B2").value).toEqual("03/15/2030");

      // Data Types
      expect(sheet.getCell("C2").value).toEqual("Yes");
      expect(sheet.getCell("D2").value).toEqual("Yes");
      expect(sheet.getCell("E2").value).toEqual("Yes");
      expect(sheet.getCell("F2").value).toEqual("Yes");
      expect(sheet.getCell("G2").value).toEqual("Yes");
      expect(sheet.getCell("H2").value).toEqual("other 1 | other 2 | other 3");

      // Clinical Data Types
      expect(sheet.getCell("I2").value).toEqual("Yes");
      expect(sheet.getCell("J2").value).toEqual("Yes");
      expect(sheet.getCell("K2").value).toEqual("Yes");
      expect(sheet.getCell("L2").value).toEqual("Yes");
      expect(sheet.getCell("M2").value).toEqual("Yes");
      expect(sheet.getCell("N2").value).toEqual("Yes");
      expect(sheet.getCell("O2").value).toEqual("other 1 | other 2 | other 3");
      expect(sheet.getCell("P2").value).toEqual("Yes");

      // File Types
      expect(sheet.getColumn("Q").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "type-1",
        "type-2",
        "type-3",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "ext1",
        "ext2",
        "ext3",
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        1,
        2,
        3,
      ]);
      expect(sheet.getColumn("T").values).toEqual([
        undefined, // 1-indexed
        expect.any(String), // Header
        "10 MB",
        "20 MB",
        "30 MB",
      ]);

      // Data de-identified
      expect(sheet.getCell("U2").value).toEqual("Yes");

      // Cell Lines & Model Systems
      expect(sheet.getCell("V2").value).toEqual("Yes");
      expect(sheet.getCell("W2").value).toEqual("Yes");

      // Additional Comment
      expect(sheet.getCell("X2").value).toEqual("Lorem Ipsum");
    });

    it("should generate SectionD sheet with partial data (only Target Dates)", async () => {
      const mockForm = questionnaireDataFactory.build({
        targetedSubmissionDate: "07/04/2035",
        targetedReleaseDate: "08/15/2036",
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Target Dates only
      expect(sheet.getCell("A2").value).toEqual("07/04/2035");
      expect(sheet.getCell("B2").value).toEqual("08/15/2036");

      // File Types columns should have only headers
      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (only Data Types)", async () => {
      const mockForm = questionnaireDataFactory.build({
        dataTypes: ["clinicalTrial", "genomics", "imaging"],
        imagingDataDeIdentified: true,
        otherDataTypes: "spatialTranscriptomics | singleCell | long-read sequencing",
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Data Types
      expect(sheet.getCell("C2").value).toEqual("Yes");
      expect(sheet.getCell("D2").value).toEqual("Yes");
      expect(sheet.getCell("E2").value).toEqual("Yes");
      expect(sheet.getCell("F2").value).toEqual("Yes");
      expect(sheet.getCell("G2").value).toEqual("No");
      expect(sheet.getCell("H2").value).toEqual(
        "spatialTranscriptomics | singleCell | long-read sequencing"
      );

      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (only Clinical Data Types)", async () => {
      const mockForm = questionnaireDataFactory.build({
        clinicalData: {
          dataTypes: [
            "biospecimenData",
            "demographicData",
            "diagnosisData",
            "outcomeData",
            "relapseRecurrenceData",
            "treatmentData",
          ],
          otherDataTypes: "patientReportedOutcomes | adverseEvents | concomitantMeds",
          futureDataTypes: true,
        },
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Clinical Data Types
      expect(sheet.getCell("I2").value).toEqual("Yes");
      expect(sheet.getCell("J2").value).toEqual("Yes");
      expect(sheet.getCell("K2").value).toEqual("Yes");
      expect(sheet.getCell("L2").value).toEqual("Yes");
      expect(sheet.getCell("M2").value).toEqual("Yes");
      expect(sheet.getCell("N2").value).toEqual("Yes");
      expect(sheet.getCell("O2").value).toEqual(
        "patientReportedOutcomes | adverseEvents | concomitantMeds"
      );
      expect(sheet.getCell("P2").value).toEqual("Yes");

      // File Types columns should have only headers
      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (only File Types)", async () => {
      const mockForm = questionnaireDataFactory.build({
        files: [
          { type: "FASTQ", extension: ".fastq.gz", count: 120, amount: "240 GB" },
          { type: "DICOM", extension: ".dcm", count: 3500, amount: "1.2 TB" },
          { type: "VCF", extension: ".vcf.gz", count: 42, amount: "6.3 GB" },
          { type: "BAM", extension: ".bam", count: 15, amount: "90 GB" },
          { type: "CSV", extension: ".csv", count: 200, amount: "15 MB" },
        ],
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // File Types
      expect(sheet.getColumn("Q").values).toEqual([
        undefined,
        expect.any(String),
        "FASTQ",
        "DICOM",
        "VCF",
        "BAM",
        "CSV",
      ]);
      expect(sheet.getColumn("R").values).toEqual([
        undefined,
        expect.any(String),
        ".fastq.gz",
        ".dcm",
        ".vcf.gz",
        ".bam",
        ".csv",
      ]);
      expect(sheet.getColumn("S").values).toEqual([
        undefined,
        expect.any(String),
        120,
        3500,
        42,
        15,
        200,
      ]);
      expect(sheet.getColumn("T").values).toEqual([
        undefined,
        expect.any(String),
        "240 GB",
        "1.2 TB",
        "6.3 GB",
        "90 GB",
        "15 MB",
      ]);
    });

    it("should generate SectionD sheet with partial data (only data de-identified)", async () => {
      const mockForm = questionnaireDataFactory.build({
        dataDeIdentified: true,
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Data De-identified
      expect(sheet.getCell("U2").value).toEqual("Yes");

      // File Types columns should have only headers
      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (only Cell Lines & Model Systems)", async () => {
      const mockForm = questionnaireDataFactory.build({
        cellLines: true,
        modelSystems: false,
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Cell Lines & Model Systems
      expect(sheet.getCell("V2").value).toEqual("Yes");
      expect(sheet.getCell("W2").value).toEqual("No");

      // File Types columns should have only headers
      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (only Additional Comment)", async () => {
      const mockForm = questionnaireDataFactory.build({
        submitterComment:
          "This submission includes harmonized data with detailed provenance, validation notes, and curation steps.",
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Additional Comment
      expect(sheet.getCell("X2").value).toEqual(
        "This submission includes harmonized data with detailed provenance, validation notes, and curation steps."
      );

      // File Types columns should have only headers
      for (const col of ["Q", "R", "S", "T"]) {
        expect(sheet.getColumn(col).values).toEqual([undefined, expect.any(String)]);
      }
    });

    it("should generate SectionD sheet with partial data (all null)", async () => {
      const mockForm = questionnaireDataFactory.build({
        targetedSubmissionDate: null,
        targetedReleaseDate: null,
        dataTypes: [],
        imagingDataDeIdentified: null,
        otherDataTypes: null,
        clinicalData: {
          dataTypes: [],
          otherDataTypes: null,
          futureDataTypes: null,
        },
        files: [],
        dataDeIdentified: null,
        cellLines: null,
        modelSystems: null,
        submitterComment: null,
      });

      const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

      // @ts-expect-error Private member
      const sheet = await middleware.serializeSectionD();

      // @ts-expect-error Private member
      const wb = middleware.workbook;
      expect(wb.getWorksheet("Data Types")).toEqual(sheet);

      // Target Dates
      expect(sheet.getCell("A2").value).toBeNull();
      expect(sheet.getCell("B2").value).toBeNull();

      // Data Types
      expect(sheet.getCell("C2").value).toEqual("No");
      expect(sheet.getCell("D2").value).toEqual("No");
      expect(sheet.getCell("E2").value).toEqual("No");
      expect(sheet.getCell("F2").value).toBeNull();
      expect(sheet.getCell("G2").value).toEqual("No");
      expect(sheet.getCell("H2").value).toBeNull();

      // Clinical Data Types
      expect(sheet.getCell("I2").value).toEqual("No");
      expect(sheet.getCell("J2").value).toEqual("No");
      expect(sheet.getCell("K2").value).toEqual("No");
      expect(sheet.getCell("L2").value).toEqual("No");
      expect(sheet.getCell("M2").value).toEqual("No");
      expect(sheet.getCell("N2").value).toEqual("No");
      expect(sheet.getCell("O2").value).toBeNull();
      expect(sheet.getCell("P2").value).toEqual("No");

      const dynamicCols = ["Q", "R", "S", "T"];
      for (const col of dynamicCols) {
        const { values } = sheet.getColumn(col);

        expect(values[0]).toBeUndefined();
        expect(values[1]).toEqual(expect.any(String));

        values.slice(2)?.forEach((value) => {
          expect(value === null).toBe(true);
        });
      }

      // Data de-identified
      expect(sheet.getCell("U2").value).toBeNull();

      // Cell Lines & Model Systems
      expect(sheet.getCell("V2").value).toEqual("No");
      expect(sheet.getCell("W2").value).toEqual("No");

      // Additional Comment
      expect(sheet.getCell("X2").value).toBeNull();
    });
  });
});

describe("Parsing", () => {
  it("should parse the metadata section correctly", async () => {
    vi.setSystemTime(new Date("2025-03-15T22:36:00Z"));

    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeMetadata();

    // Modify columns to force different values
    sheet.getCell("A2").value = "some uuid";
    sheet.getCell("H2").value = "invalid dev tier";
    sheet.getCell("I2").value = "invalid template version";

    // @ts-expect-error Private member
    middleware.dependencies.application = applicationFactory.build({
      _id: "a different uuid",
    });

    // @ts-expect-error Private member
    const result = await middleware.parseMetadata();

    await waitFor(() => {
      expect(Logger.info).toHaveBeenCalled();
    });

    expect(result).toEqual(true);

    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received mismatched devTier."),
      expect.objectContaining({
        expected: "mock-dev-tier",
        received: "invalid dev tier",
      })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received mismatched templateVersion."),
      expect.objectContaining({
        expected: expect.any(String), // Internal variable
        received: "invalid template version",
      })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received mismatched submissionId."),
      expect.objectContaining({
        expected: "a different uuid",
        received: "some uuid",
      })
    );
  });

  it("should handle a missing metadata sheet", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeMetadata();

    sheet.destroy();

    // @ts-expect-error Private member
    await expect(middleware.parseMetadata()).resolves.toEqual(false);
  });

  it("should log info message when app version differs between import and current", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeMetadata();

    // Modify the App Version column to have a different version
    sheet.getCell("J2").value = "2.5.6";

    // @ts-expect-error Private member
    const result = await middleware.parseMetadata();

    await waitFor(() => {
      expect(Logger.info).toHaveBeenCalled();
    });

    expect(result).toEqual(true);

    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received mismatched appVersion."),
      expect.objectContaining({
        expected: "5.5.0",
        received: "2.5.6",
      })
    );
  });

  it("should not log when app versions match", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeMetadata();

    // App Version column should have the same version (5.5.0)
    expect(sheet.getCell("J2").value).toEqual("5.5.0");

    // @ts-expect-error Private member
    const result = await middleware.parseMetadata();

    expect(result).toEqual(true);

    // Should not log any app version mismatch
    expect(Logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Received mismatched appVersion."),
      expect.any(Object)
    );
  });

  it("should parse the SectionA sheet correctly", async () => {
    const mockForm = questionnaireDataFactory.build({
      pi: piFactory.build({
        firstName: "benjamin",
        lastName: "bunny",
        position: "Some PI Position",
        email: "benjamin.bunny@example.com",
        ORCID: "1234-5678-9012-3456",
        institution: "A Mock Institution",
        institutionID: null,
        address: "123 Bunny Lane, Bunnyville, USA 20001",
      }),
      piAsPrimaryContact: false,
      primaryContact: contactFactory.build({
        firstName: "Radish",
        lastName: "Rabbit",
        position: "Some Contact Position",
        email: "radish.rabbit@example.com",
        institution: "Another Mock Institution",
        institutionID: null,
        phone: "957-123-9393",
      }),
      additionalContacts: contactFactory.build(3, (idx) => ({
        firstName: `Contact ${idx + 1} First`,
        lastName: `Contact ${idx + 1} Last`,
        position: `Contact ${idx + 1} Position`,
        email: `contact${idx + 1}@example.com`,
        institution: `Contact ${idx + 1} Institution`,
        institutionID: null,
        phone: `555-123-${9000 + idx}`,
      })),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.pi).toEqual({ ...mockForm.pi, institutionID: "" });
    expect(output.primaryContact).toEqual({ ...mockForm.primaryContact, institutionID: "" });
    expect(output.additionalContacts).toEqual(
      mockForm.additionalContacts?.map((c) => ({ ...c, institutionID: "" }))
    );
  });

  it("should handle missing SectionA sheet", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeSectionA();

    sheet.destroy();

    // @ts-expect-error Private member
    await expect(middleware.parseSectionA()).resolves.toEqual(false);
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining(`parseSectionA: No sheet found for PI and Contact. Skipping`)
    );
  });

  it("should ignore Primary Contact if piAsPrimaryContact is set", async () => {
    const mockForm = questionnaireDataFactory.build({
      pi: null,
      piAsPrimaryContact: true, // NOTE: This will cause the parsing to ignore PC
      primaryContact: contactFactory.build({
        firstName: "Radish",
        lastName: "Rabbit",
        position: "Some Contact Position",
        email: "radish.rabbit@example.com",
        institution: "Another Mock Institution",
        institutionID: null,
        phone: "957-123-9393",
      }),
      additionalContacts: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.primaryContact).toBeNull();
  });

  it("should set the institutionID correctly", async () => {
    const mockForm = questionnaireDataFactory.build({
      pi: piFactory.build({
        institution: "api-option-1",
        institutionID: "this uuid will be replaced by API data because of the name",
      }),
      piAsPrimaryContact: false,
      primaryContact: contactFactory.build({
        institution: "This one is new",
        institutionID: null,
      }),
      additionalContacts: contactFactory.build(3, (idx) => ({
        firstName: `Contact ${idx + 2}`, // NOTE: Required otherwise additionalContacts would be ignored
        institution: `api-option-${idx + 2}`,
        institutionID: `f5f76325-7fe9-41df-b419-c6f7bb6e539${idx + 2}`,
      })),
    });

    const mockInstitutions = vi.fn().mockResolvedValue({
      data: {
        listInstitutions: {
          total: 3,
          institutions: [
            ...institutionFactory.build(3, (idx) => ({
              _id: `f5f76325-7fe9-41df-b419-c6f7bb6e539${idx + 1}`,
              name: `api-option-${idx + 1}`,
            })),
          ],
        },
      },
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {
      getInstitutions: mockInstitutions,
    });

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.pi).toEqual(
      expect.objectContaining({
        institution: "api-option-1",
        institutionID: "f5f76325-7fe9-41df-b419-c6f7bb6e5391",
      })
    );
    expect(output.primaryContact).toEqual(
      expect.objectContaining({
        institution: "This one is new",
        institutionID: "", // No match from API
      })
    );
    expect(output.additionalContacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          institution: "api-option-2",
          institutionID: "f5f76325-7fe9-41df-b419-c6f7bb6e5392",
        }),
        expect.objectContaining({
          institution: "api-option-3",
          institutionID: "f5f76325-7fe9-41df-b419-c6f7bb6e5393",
        }),
        expect.objectContaining({
          institution: "api-option-4",
          institutionID: "",
        }),
      ])
    );
  });

  it("should log an error when parsing SectionA if the dependent sheets are invalid", async () => {
    const middleware = new QuestionnaireExcelMiddleware(questionnaireDataFactory.build(), {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    expect(result).toEqual(true);

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "SectionA.ts: The institution sheet is missing or invalid."
      );
    });
  });

  it("should set the status of Section A correctly (In Progress, PI)", async () => {
    const mockForm = questionnaireDataFactory.build({
      pi: piFactory.build({
        firstName: "this obscure value triggers in progress",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.sections.find((s) => s.name === "A")).toEqual(
      expect.objectContaining({
        status: "In Progress",
      })
    );
  });

  it("should set the status of Section A correctly (In Progress, PC)", async () => {
    const mockForm = questionnaireDataFactory.build({
      primaryContact: contactFactory.build({
        institution: "this obscure value triggers in progress",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.sections.find((s) => s.name === "A")).toEqual(
      expect.objectContaining({
        status: "In Progress",
      })
    );
  });

  it("should set the status of Section A correctly (In Progress, Additional Contact)", async () => {
    const mockForm = questionnaireDataFactory.build({
      additionalContacts: [
        contactFactory.build({
          firstName: "this obscure value triggers in progress",
        }),
      ],
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.sections.find((s) => s.name === "A")).toEqual(
      expect.objectContaining({
        status: "In Progress",
      })
    );
  });

  it("should set the status of Section A correctly (Not Started)", async () => {
    const mockForm = questionnaireDataFactory.build({});

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionA();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionA();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.sections.find((s) => s.name === "A")).toEqual(
      expect.objectContaining({
        status: "Not Started",
      })
    );
  });

  it("should parse the SectionB sheet correctly", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "Other",
        name: "Program 1",
        abbreviation: "P1",
        description: "Program Description",
      }),
      study: studyFactory.build({
        name: "Test Study",
        abbreviation: "TS",
        description: "Test Study Description",
        funding: [
          fundingFactory.build({
            agency: "Test Agency",
            grantNumbers: "12345",
            nciProgramOfficer: "John Doe",
          }),
          fundingFactory.build({
            agency: "Test Agency 2",
            grantNumbers: "6789",
            nciProgramOfficer: "Jane Smith",
          }),
        ],
        publications: [
          publicationFactory.build({
            title: "Test Publication",
            pubmedID: "12345678",
            DOI: "10.1234/test",
          }),
          publicationFactory.build({
            title: "Test Publication 2",
            pubmedID: "87654321",
            DOI: "10.1234/random2",
          }),
        ],
        plannedPublications: [
          plannedPublicationFactory.build({
            title: "Test Planned Publication",
            expectedDate: "01/01/2026",
          }),
          plannedPublicationFactory.build({
            title: "Test Planned Publication 2",
            expectedDate: "01/01/2027",
          }),
        ],
        repositories: [
          repositoryFactory.build({
            name: "Repository 1",
            studyID: "02ec12d2-12c2-45b6-b12d-9fd954f696b8",
            dataTypesSubmitted: ["clinicalTrial", "genomics", "imaging", "proteomics"],
            otherDataTypesSubmitted: "other 1 | other 2 | other 3",
          }),
          repositoryFactory.build({
            name: "Repository 2",
            studyID: "03ec12d2-12c2-45b6-b12d-9fd954f696b8",
            dataTypesSubmitted: [],
            otherDataTypesSubmitted: "other 1",
          }),
        ],
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.program).toEqual(
      expect.objectContaining({
        _id: "Other",
        name: "Program 1",
        abbreviation: "P1",
        description: "Program Description",
      })
    );
    expect(output.study).toEqual(
      expect.objectContaining({
        name: "Test Study",
        abbreviation: "TS",
        description: "Test Study Description",
      })
    );
    expect(output.study.funding).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agency: "Test Agency",
          grantNumbers: "12345",
          nciProgramOfficer: "John Doe",
        }),
        expect.objectContaining({
          agency: "Test Agency 2",
          grantNumbers: "6789",
          nciProgramOfficer: "Jane Smith",
        }),
      ])
    );

    expect(output.study.publications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Test Publication",
          pubmedID: "12345678",
          DOI: "10.1234/test",
        }),
        expect.objectContaining({
          title: "Test Publication 2",
          pubmedID: "87654321",
          DOI: "10.1234/random2",
        }),
      ])
    );

    expect(output.study.plannedPublications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Test Planned Publication",
          expectedDate: "01/01/2026",
        }),
        expect.objectContaining({
          title: "Test Planned Publication 2",
          expectedDate: "01/01/2027",
        }),
      ])
    );

    expect(output.study.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Repository 1",
          studyID: "02ec12d2-12c2-45b6-b12d-9fd954f696b8",
          dataTypesSubmitted: ["clinicalTrial", "genomics", "imaging", "proteomics"],
          otherDataTypesSubmitted: "other 1 | other 2 | other 3",
        }),
        expect.objectContaining({
          name: "Repository 2",
          studyID: "03ec12d2-12c2-45b6-b12d-9fd954f696b8",
          dataTypesSubmitted: [],
          otherDataTypesSubmitted: "other 1",
        }),
      ])
    );
  });

  it("should handle missing SectionB sheet", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeSectionB();

    sheet.destroy();

    // @ts-expect-error Private member
    await expect(middleware.parseSectionB()).resolves.toEqual(false);
    expect(Logger.info).toHaveBeenCalledWith(
      "parseSectionB: No sheet found for Section B. Skipping"
    );
  });

  it("should ignore program data when program is 'Not Applicable'", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "Not Applicable",
        name: "Should Be Ignored",
        abbreviation: "SBI",
        description: "This should be ignored when parsing.",
      }),
      study: studyFactory.build({
        name: "Study X",
        abbreviation: "SX",
        description: "Desc",
        funding: [],
        publications: [],
        plannedPublications: [],
        repositories: [],
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // Reset data before parsing
    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.program.name).toBe(InitialQuestionnaire.program.name);
    expect(output.program.abbreviation).toBe(InitialQuestionnaire.program.abbreviation);
    expect(output.program.description).toBe(InitialQuestionnaire.program.description);
  });

  it("should allow empty program when program is not specified", async () => {
    const mockForm = questionnaireDataFactory.build();

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // Reset data before parsing
    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.program._id).toBe(InitialQuestionnaire.program._id);
    expect(output.program.name).toBe(InitialQuestionnaire.program.name);
    expect(output.program.abbreviation).toBe(InitialQuestionnaire.program.abbreviation);
    expect(output.program.description).toBe(InitialQuestionnaire.program.description);
  });

  it("should allow study name to be 1000 characters", async () => {
    const mockForm = questionnaireDataFactory.build();

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // Reset data before parsing
    // @ts-expect-error Private member
    middleware.data = {
      ...InitialQuestionnaire,
      study: { ...InitialQuestionnaire.study, name: "A".repeat(1_000) },
      sections: [...InitialSections],
    };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.study.name).toBe("A".repeat(1_000));
  });

  it("should allow selecting existing program", async () => {
    const _id = v4();
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id,
        name: null,
        abbreviation: null,
        description: null,
      }),
      study: studyFactory.build({
        name: "Study Y",
        abbreviation: "SY",
        description: "Desc",
        funding: [],
        publications: [],
        plannedPublications: [],
        repositories: [],
      }),
    });

    const mockPrograms = vi.fn().mockResolvedValue({
      data: {
        listPrograms: {
          programs: [
            {
              _id,
              name: "Existing Program",
              abbreviation: "EP",
              description: "An existing program.",
              readOnly: false,
            },
          ],
        },
      },
    });
    const middleware = new QuestionnaireExcelMiddleware(mockForm, {
      getPrograms: mockPrograms,
    });

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.program).toEqual(expect.objectContaining({ _id }));
    expect(output.program?.name).toBe("Existing Program");
    expect(output.program?.abbreviation).toBe("EP");
    expect(output.program?.description).toBe("An existing program.");
  });

  it("should parse the MM/DD/YYYY date from Planned Publications", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "Other",
        name: "Program A",
        abbreviation: "PA",
        description: "Program A Desc",
      }),
      study: studyFactory.build({
        name: "Date Parsing Study",
        abbreviation: "DPS",
        description: "Testing date parsing.",
        funding: [],
        publications: [],
        plannedPublications: [
          plannedPublicationFactory.build({
            title: "DateTest #1",
            expectedDate: "2000-01-01",
          }),
          plannedPublicationFactory.build({
            title: "DateTest #2",
            expectedDate: "2001-01-01",
          }),
        ],
        repositories: [],
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // @ts-expect-error Private member
    const wb = middleware.workbook;
    const sheet = wb.getWorksheet("Program and Study");
    sheet.getCell("O2").value = new Date("2030-02-28T12:34:56Z");
    sheet.getCell("O3").value = new Date("2031-12-31T23:59:59Z");

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    const pp1 = output.study.plannedPublications.find((p) => p.title === "DateTest #1");
    const pp2 = output.study.plannedPublications.find((p) => p.title === "DateTest #2");
    expect(pp1).toBeDefined();
    expect(pp2).toBeDefined();

    expect(pp1.expectedDate).toEqual("02/28/2030");
    expect(pp2.expectedDate).toEqual("12/31/2031");
  });

  it("should convert repository data types to an array of only valid options", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "Other",
        name: "Program B",
        abbreviation: "PB",
        description: "Program B Desc",
      }),
      study: studyFactory.build({
        name: "Repository Types Study",
        abbreviation: "RTS",
        description: "Testing type filtering.",
        funding: [],
        publications: [],
        plannedPublications: [],
        repositories: [
          repositoryFactory.build({
            name: "Repo Filter 1",
            studyID: "RF1",
            dataTypesSubmitted: [
              "genomics",
              "imaging",
              "INVALID",
              "unknown",
            ] as Repository["dataTypesSubmitted"],
            otherDataTypesSubmitted: "metabolomics",
          }),
          repositoryFactory.build({
            name: "Repo Filter 2",
            studyID: "RF2",
            dataTypesSubmitted: [
              "clinicalTrial",
              "proteomics",
              "nonsense",
            ] as Repository["dataTypesSubmitted"],
            otherDataTypesSubmitted: "",
          }),
          repositoryFactory.build({
            name: "Repo Filter 3",
            studyID: "RF3",
            dataTypesSubmitted: [],
            otherDataTypesSubmitted: "something else",
          }),
        ],
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    const repo1 = output.study.repositories.find((r) => r.name === "Repo Filter 1");
    const repo2 = output.study.repositories.find((r) => r.name === "Repo Filter 2");
    const repo3 = output.study.repositories.find((r) => r.name === "Repo Filter 3");

    expect(repo1).toBeDefined();
    expect(repo2).toBeDefined();
    expect(repo3).toBeDefined();

    // Only valid options should remain:
    expect(repo1.dataTypesSubmitted).toEqual(expect.arrayContaining(["genomics", "imaging"]));
    expect(repo1.dataTypesSubmitted).toHaveLength(2);

    expect(repo2.dataTypesSubmitted).toEqual(
      expect.arrayContaining(["clinicalTrial", "proteomics"])
    );
    expect(repo2.dataTypesSubmitted).toHaveLength(2);

    expect(repo3.dataTypesSubmitted).toEqual([]);
  });

  it("should default to 'Other' when program name is not found", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "INVALID_PROGRAM",
        name: "Program B",
        abbreviation: "PB",
        description: "Program B Desc",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionB();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.program).toEqual(
      expect.objectContaining({
        _id: "Other",
        name: "Program B",
        abbreviation: "PB",
        description: "Program B Desc",
      })
    );
  });

  it("should be graceful when program dependencies are invalid", async () => {
    const mockForm = questionnaireDataFactory.build({
      program: programInputFactory.build({
        _id: "ABC",
        name: "Program B",
        abbreviation: "PB",
        description: "Program B Desc",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {
      getPrograms: null,
    });

    const stubProgramSheet = {
      name: "ProgramList",
      rowCount: 2,
      getColumn: vi.fn().mockImplementation((n: number) => {
        if (n === 1) {
          return undefined;
        }
        return { values: [] };
      }),
      getCell: vi.fn(),
      addRow: vi.fn(),
      state: "veryHidden",
    } as unknown as Worksheet;

    // @ts-expect-error Private member
    const originalCreateProgramsSheet = middleware.createProgramsSheet.bind(middleware);
    // @ts-expect-error Private member
    middleware.createProgramsSheet = vi.fn().mockResolvedValue(stubProgramSheet);

    // @ts-expect-error Private member
    const sheet = await middleware.serializeSectionB();

    expect(sheet.getCell("A2").value).toEqual("Other");
    expect(sheet.getCell("B2").value).toEqual("Program B");
    expect(sheet.getCell("C2").value).toEqual("PB");
    expect(sheet.getCell("D2").value).toEqual("Program B Desc");

    // @ts-expect-error Private member
    middleware.createProgramsSheet = originalCreateProgramsSheet;

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionB();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.program).toEqual(
      expect.objectContaining({
        _id: "Other",
        name: "Program B",
        abbreviation: "PB",
        description: "Program B Desc",
      })
    );
  });

  it.each<[string, string]>([
    [HIDDEN_SHEET_NAMES.programs, "SectionB.ts: The programs sheet is missing or invalid."],
  ])(
    "should log an error when parsing SectionB if the dependent sheets are invalid (%s)",
    async (sheetName, expectedMessage) => {
      const middleware = new QuestionnaireExcelMiddleware(questionnaireDataFactory.build(), {});

      // @ts-expect-error Private member
      await middleware.serializeSectionB();

      // @ts-expect-error Private member
      middleware.workbook.getWorksheet(sheetName)?.destroy();

      // @ts-expect-error Private member
      middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

      // @ts-expect-error Private member
      const result = await middleware.parseSectionB();

      expect(result).toEqual(true);

      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalledWith(expectedMessage);
      });
    }
  );

  it("should parse the SectionC sheet correctly", async () => {
    const mockForm = questionnaireDataFactory.build({
      accessTypes: ["Open Access", "Controlled Access"],
      study: studyFactory.build({
        isDbGapRegistered: true,
        dbGaPPPHSNumber: "phs100009.v6.p3",
        GPAName: "Benjamin 'Gpa' Bunny",
      }),
      cancerTypes: cancerTypeOptions.slice(1, 10),
      otherCancerTypes: "Some option | Another Option | xyz 123",
      preCancerTypes: "Pre-cancer type 1 | Pre-cancer type 2",
      species: speciesOptions.slice(0, speciesOptions.length - 1),
      otherSpeciesOfSubjects: "Mythical Creature",
      numberOfParticipants: 150_000,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.accessTypes).toContain("Open Access");
    expect(output.accessTypes).toContain("Controlled Access");
    expect(output.study).toEqual(
      expect.objectContaining({
        isDbGapRegistered: true,
        dbGaPPPHSNumber: "phs100009.v6.p3",
        GPAName: "Benjamin 'Gpa' Bunny",
      })
    );
    expect(output.cancerTypes).toEqual(cancerTypeOptions.slice(1, 10));
    expect(output.otherCancerTypes).toEqual("Some option | Another Option | xyz 123");
    expect(output.preCancerTypes).toEqual("Pre-cancer type 1 | Pre-cancer type 2");
    expect(output.species).toEqual(speciesOptions.slice(0, speciesOptions.length - 1));
    expect(output.otherSpeciesOfSubjects).toEqual("Mythical Creature");
    expect(output.numberOfParticipants).toEqual(150_000);
  });

  it("should ignore invalid Cancer Type options in SectionC", async () => {
    const mockForm = questionnaireDataFactory.build({
      cancerTypes: [
        "this-option-will-never-exist",
        "another-very-invalid-option",
        cancerTypeOptions[3],
      ],
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.cancerTypes).toEqual([cancerTypeOptions[3]]);
  });

  it.each<string>([
    "phs0012345",
    "phs00123",
    "phs001234.v",
    "phs001234.p1",
    "phs001234.v12.p",
    "phs001234.v1.p2x",
    "phsabc123",
  ])('should ignore invalid dbGaPPHSNumber "%s" in SectionC', async (input) => {
    const mockForm = questionnaireDataFactory.build({
      study: studyFactory.build({
        isDbGapRegistered: true,
        dbGaPPPHSNumber: input,
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.study.dbGaPPPHSNumber).toEqual(InitialQuestionnaire.study.dbGaPPPHSNumber);
  });

  it("should allow partial dbGaPPHSNumber with no versioning in SectionC", async () => {
    const mockForm = questionnaireDataFactory.build({
      study: studyFactory.build({
        isDbGapRegistered: true,
        dbGaPPPHSNumber: "phs001234",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.study.dbGaPPPHSNumber).toEqual("phs001234");
  });

  it.each<[input: string, expected: string]>([
    ["phs001234", "phs001234"],
    ["phs001234.v2", "phs001234.v2"],
    ["phs001234.v2.p3", "phs001234.v2.p3"],
    ["  phs001234  ", "phs001234"],
  ])('should allow valid dbGaPPHSNumber "%s" in SectionC', async (input, expected) => {
    const mockForm = questionnaireDataFactory.build({
      study: studyFactory.build({
        isDbGapRegistered: true,
        dbGaPPPHSNumber: input,
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.study.dbGaPPPHSNumber).toEqual(expected);
  });

  it("should clear all Cancer Type options if 'Not Applicable' is selected", async () => {
    const mockForm = questionnaireDataFactory.build({
      cancerTypes: [...cancerTypeOptions.slice(1, 5), CUSTOM_CANCER_TYPES.NOT_APPLICABLE],
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.cancerTypes).toEqual([CUSTOM_CANCER_TYPES.NOT_APPLICABLE]);
  });

  it("should ignore invalid Species options in SectionC", async () => {
    const mockForm = questionnaireDataFactory.build({
      species: ["this-option-will-never-exist", "another-very-invalid-option", speciesOptions[3]],
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.species).toEqual([speciesOptions[3]]);
  });

  it("should coerce Number of Participants to a number", async () => {
    const mockForm = questionnaireDataFactory.build({
      numberOfParticipants: "150000" as unknown as number,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;
    expect(output.numberOfParticipants).toEqual(150000);
  });

  it.each<[string, string]>([
    [HIDDEN_SHEET_NAMES.cancerTypes, "SectionC.ts: The cancer types sheet is missing or invalid."],
    [HIDDEN_SHEET_NAMES.speciesOptions, "SectionC.ts: The species sheet is missing or invalid."],
  ])(
    "should log an error when parsing SectionC if the dependent sheets are invalid (%s)",
    async (sheetName, expectedMessage) => {
      const middleware = new QuestionnaireExcelMiddleware(questionnaireDataFactory.build(), {});

      // @ts-expect-error Private member
      await middleware.serializeSectionC();

      // @ts-expect-error Private member
      middleware.workbook.getWorksheet(sheetName)?.destroy();

      // @ts-expect-error Private member
      middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

      // @ts-expect-error Private member
      const result = await middleware.parseSectionC();

      expect(result).toEqual(true);

      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalledWith(expectedMessage);
      });
    }
  );

  it("should handle missing SectionC sheet", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeSectionC();

    sheet.destroy();

    // @ts-expect-error Private member
    await expect(middleware.parseSectionC()).resolves.toEqual(false);
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining(`parseSectionC: No sheet found for Data Access and Disease. Skipping`)
    );
  });

  it("should set the status of SectionC correctly (In Progress)", async () => {
    const mockForm = questionnaireDataFactory.build({
      study: studyFactory.build({
        GPAName: "this obscure value triggers in progress",
      }),
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionC();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionC();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.sections.find((s) => s.name === "C")).toEqual(
      expect.objectContaining({
        status: "In Progress",
      })
    );
  });

  it("should parse the SectionD sheet correctly", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: "03/15/2030",
      targetedReleaseDate: "03/15/2030",
      dataTypes: [
        "clinicalTrial",
        "genomics",
        "imaging",
        "proteomics",
        "invalid",
      ] as QuestionnaireData["dataTypes"],
      imagingDataDeIdentified: true,
      otherDataTypes: "other 1 | other 2 | other 3",
      clinicalData: {
        dataTypes: [
          "biospecimenData",
          "demographicData",
          "diagnosisData",
          "outcomeData",
          "relapseRecurrenceData",
          "treatmentData",
        ],
        otherDataTypes: "other 1 | other 2 | other 3",
        futureDataTypes: true,
      },
      files: fileInfoFactory.build(3, (index) => ({
        type: `type-${index + 1}`,
        extension: `ext${index + 1}`,
        count: index + 1,
        amount: `${(index + 1) * 10} MB`,
      })),
      dataDeIdentified: true,
      cellLines: true,
      modelSystems: true,
      submitterComment: "Lorem Ipsum",
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    // Target Dates
    expect(output.targetedSubmissionDate).toEqual("03/15/2030");
    expect(output.targetedReleaseDate).toEqual("03/15/2030");

    // Data Types
    expect(output.dataTypes).toEqual(
      expect.arrayContaining(["clinicalTrial", "genomics", "imaging", "proteomics"])
    );
    expect(output.dataTypes?.length).toBe(4);
    expect(output.imagingDataDeIdentified).toBe(true);
    expect(output.otherDataTypes).toEqual("other 1 | other 2 | other 3");

    // Clinical Data Types
    expect(output.clinicalData?.dataTypes).toEqual(
      expect.arrayContaining([
        "biospecimenData",
        "demographicData",
        "diagnosisData",
        "outcomeData",
        "relapseRecurrenceData",
        "treatmentData",
      ])
    );
    expect(output.clinicalData?.dataTypes?.length).toBe(6);
    expect(output.clinicalData?.otherDataTypes).toEqual("other 1 | other 2 | other 3");
    expect(output.clinicalData?.futureDataTypes).toBe(true);

    // File Types
    expect(output.files).toHaveLength(3);
    expect(output.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "type-1",
          extension: "ext1",
          count: 1,
          amount: "10 MB",
        }),
        expect.objectContaining({
          type: "type-2",
          extension: "ext2",
          count: 2,
          amount: "20 MB",
        }),
        expect.objectContaining({
          type: "type-3",
          extension: "ext3",
          count: 3,
          amount: "30 MB",
        }),
      ])
    );

    // Data de-identified
    expect(output.dataDeIdentified).toBe(true);

    // Cell Lines & Model Systems
    expect(output.cellLines).toBe(true);
    expect(output.modelSystems).toBe(true);

    // Additional Comment
    expect(output.submitterComment).toEqual("Lorem Ipsum");
  });

  it("should parse the MM/DD/YYYY date from target dates", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: "01/01/2000",
      targetedReleaseDate: "01/01/2000",
      dataTypes: [],
      imagingDataDeIdentified: null,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [],
        otherDataTypes: "",
        futureDataTypes: null,
      },
      files: [],
      dataDeIdentified: null,
      cellLines: null,
      modelSystems: null,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    const wb = middleware.workbook;
    const sheet = wb.getWorksheet("Data Types");
    sheet.getCell("A2").value = "2032-02-29";
    sheet.getCell("B2").value = "2033-12-25";

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.targetedSubmissionDate).toEqual("02/29/2032");
    expect(output.targetedReleaseDate).toEqual("12/25/2033");
  });

  it("should allow current date for target dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1, 4, 4, 4));

    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: "01/01/2000",
      targetedReleaseDate: "01/01/2000",
      dataTypes: [],
      imagingDataDeIdentified: null,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [],
        otherDataTypes: "",
        futureDataTypes: null,
      },
      files: [],
      dataDeIdentified: null,
      cellLines: null,
      modelSystems: null,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.targetedSubmissionDate).toEqual("01/01/2000");
    expect(output.targetedReleaseDate).toEqual("01/01/2000");

    vi.useRealTimers();
  });

  it("should not allow past dates for target dates and persist value", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: "01/01/2000",
      targetedReleaseDate: "01/01/2000",
      dataTypes: [],
      imagingDataDeIdentified: null,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [],
        otherDataTypes: "",
        futureDataTypes: null,
      },
      files: [],
      dataDeIdentified: null,
      cellLines: null,
      modelSystems: null,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);
    expect(output.targetedSubmissionDate).toEqual("01/01/2000");
    expect(output.targetedReleaseDate).toEqual("01/01/2000");
  });

  it("should handle missing SectionD sheet", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const sheet = await middleware.serializeSectionD();

    sheet.destroy();

    // @ts-expect-error Private member
    await expect(middleware.parseSectionD()).resolves.toEqual(false);
    expect(Logger.info).toHaveBeenCalledWith(
      "parseSectionD: No sheet found for Section D. Skipping"
    );
  });

  it("should parse all switches as only yes/no values", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: null,
      targetedReleaseDate: null,
      dataTypes: ["genomics", "imaging", "proteomics"],
      imagingDataDeIdentified: false,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [],
        otherDataTypes: "",
        futureDataTypes: true,
      },
      files: [],
      dataDeIdentified: false,
      cellLines: true,
      modelSystems: false,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.imagingDataDeIdentified).toBe(false);
    expect(output.clinicalData?.futureDataTypes).toBe(false);
    expect(output.dataTypes).toEqual(["genomics", "imaging", "proteomics"]);
    expect(output.dataDeIdentified).toBe(false);
    expect(output.cellLines).toBe(true);
    expect(output.modelSystems).toBe(false);
  });

  it("should ignore invalid clinical dataTypes", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: null,
      targetedReleaseDate: null,
      dataTypes: ["clinicalTrial"],
      imagingDataDeIdentified: null,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [
          "biospecimenData",
          "diagnosisData",
          "outcomeData",
          "demographicData",
          "relapseRecurrenceData",
          "treatmentData",
          "INVALID",
        ] as ClinicalData["dataTypes"],
        otherDataTypes: "random | treatmentData | extra",
        futureDataTypes: false,
      },
      files: [],
      dataDeIdentified: null,
      cellLines: null,
      modelSystems: null,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.clinicalData?.dataTypes).toEqual(
      expect.arrayContaining([
        "biospecimenData",
        "diagnosisData",
        "outcomeData",
        "demographicData",
        "relapseRecurrenceData",
        "treatmentData",
      ])
    );
    expect(output.clinicalData?.dataTypes).toHaveLength(6);

    expect(output.clinicalData?.dataTypes).not.toContain("INVALID");
  });

  it("should not include clinical data types if the clinicalTrial data type is not a 'Yes'", async () => {
    const mockForm = questionnaireDataFactory.build({
      targetedSubmissionDate: null,
      targetedReleaseDate: null,
      // clinicalTrial not selected
      dataTypes: ["genomics", "imaging"],
      imagingDataDeIdentified: null,
      otherDataTypes: "",
      clinicalData: {
        dataTypes: [
          "biospecimenData",
          "demographicData",
          "diagnosisData",
          "outcomeData",
          "relapseRecurrenceData",
          "treatmentData",
        ],
        otherDataTypes: "ignored because clinicalTrial is No",
        futureDataTypes: true,
      },
      files: [],
      dataDeIdentified: null,
      cellLines: null,
      modelSystems: null,
      submitterComment: null,
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {});

    // @ts-expect-error Private member
    await middleware.serializeSectionD();

    // @ts-expect-error Private member
    middleware.data = { ...InitialQuestionnaire, sections: [...InitialSections] };

    // @ts-expect-error Private member
    const result = await middleware.parseSectionD();

    // @ts-expect-error Private member
    const output = middleware.data;

    expect(result).toEqual(true);

    expect(output.dataTypes).toEqual(expect.arrayContaining(["genomics", "imaging"]));
    expect(output.clinicalData?.dataTypes ?? []).toHaveLength(0);
  });

  it("normalizeCellValue handles primitives, Date, nullish, hyperlink, formula, shared formula, rich text, and error", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});
    const call = (v: ExcelJS.CellValue | undefined) =>
      // @ts-expect-error Private member
      middleware.normalizeCellValue(v);

    const d = new Date("2024-01-01T00:00:00Z");

    // primitives and Date
    expect(call("hello")).toBe("hello");
    expect(call(123 as unknown as ExcelJS.CellValue)).toBe(123);
    expect(call(true as unknown as ExcelJS.CellValue)).toBe(true);
    expect(call(d as unknown as ExcelJS.CellValue)).toBe("1/1/2024");

    // nullish
    expect(call(null as unknown as ExcelJS.CellValue)).toBeNull();
    expect(call(undefined)).toBeNull();

    // hyperlink
    const hyperlink: ExcelJS.CellHyperlinkValue = {
      text: "example@example.com",
      hyperlink: "mailto:example@example.com",
    };
    expect(call(hyperlink)).toBe("example@example.com");

    // formula (with/without result)
    const formulaWithResult: ExcelJS.CellFormulaValue = { formula: "1+1", result: 2 };
    const formulaNoResult: ExcelJS.CellFormulaValue = { formula: "A1+B1" };
    expect(call(formulaWithResult)).toBe(2);
    expect(call(formulaNoResult)).toBeNull();

    // shared formula (with/without result)
    const sharedWithResult: ExcelJS.CellSharedFormulaValue = {
      sharedFormula: "A1",
      result: "ok",
    };
    const sharedNoResult: ExcelJS.CellSharedFormulaValue = { sharedFormula: "B2" };
    expect(call(sharedWithResult)).toBe("ok");
    expect(call(sharedNoResult)).toBeNull();

    // rich text
    const rich: ExcelJS.CellRichTextValue = { richText: [{ text: "Hello " }, { text: "World" }] };
    expect(call(rich)).toBe("Hello World");

    // error
    expect(Logger.error).toHaveBeenCalledTimes(0);
    const err: ExcelJS.CellErrorValue = { error: "#DIV/0!" };
    expect(call(err)).toBe(null);

    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "QuestionnaireExcelMiddleware: Found unknown value while normalizing data:",
        expect.objectContaining({
          error: "#DIV/0!",
        })
      );
    });

    // unknown object shape
    const unknownObj = { foo: "bar", nested: { a: 1 } } as unknown as ExcelJS.CellValue;
    expect(call(unknownObj)).toBe(null);
    await waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        "QuestionnaireExcelMiddleware: Found unknown value while normalizing data:",
        unknownObj
      );
    });
  });

  it("headerKey returns normalized string keys and null for nullish", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});
    const call = (v: ExcelJS.CellValue | undefined) =>
      // @ts-expect-error Private member
      middleware.headerKey(v);

    const hyperlinkHeader: ExcelJS.CellHyperlinkValue = {
      text: "Email",
      hyperlink: "mailto:x@y.com",
    };
    expect(call(hyperlinkHeader)).toBe("Email");

    const richHeader: ExcelJS.CellRichTextValue = {
      richText: [{ text: "Col" }, { text: " Name" }],
    };
    expect(call(richHeader)).toBe("Col Name");

    expect(call("Status")).toBe("Status");
    expect(call(123 as unknown as ExcelJS.CellValue)).toBe("123");

    expect(call(null as unknown as ExcelJS.CellValue)).toBeNull();
    expect(call(undefined)).toBeNull();
  });

  it("extractValuesFromWorksheet skips columns with invalid headers", async () => {
    const middleware = new QuestionnaireExcelMiddleware(null, {});

    // @ts-expect-error Private member
    const wb = middleware.workbook;
    const ws = wb.addWorksheet("Tmp Extract Test");

    // Row 1 headers (1-indexed). Column B header is null -> should be skipped.
    // eslint-disable-next-line no-sparse-arrays
    ws.getRow(1).values = [, "ColA", null, "ColC"];

    // Data row
    // eslint-disable-next-line no-sparse-arrays
    ws.getRow(2).values = [, "A2", "SHOULD_SKIP", "C2"];

    // @ts-expect-error Private member
    const map = await middleware.extractValuesFromWorksheet(ws);

    expect(map.size).toBe(2);
    expect(map.get("ColA")).toEqual(["A2"]);
    expect(map.get("ColC")).toEqual(["C2"]);

    const allValues = Array.from(map.values()).flat();
    expect(allValues).not.toContain("SHOULD_SKIP");
  });
});

describe("IO Symmetry", () => {
  // NOTE: This is currently disabled because the middleware.serialize call never resolves
  // I tracked it to the writeBuffer promise, but can't figure out what it is beyond that.
  it.todo("should return the same QuestionnaireObject provided", async () => {
    const mockForm = questionnaireDataFactory.build(); // Need to fill this out

    const mockInstitutions = vi.fn().mockResolvedValue({
      data: {
        listInstitutions: {
          total: 3,
          institutions: [
            ...institutionFactory.build(3, (idx) => ({
              _id: `f5f76325-7fe9-41df-b419-c6f7bb6e539${idx + 1}`,
              name: `api-option-${idx + 1}`,
            })),
          ],
        },
      },
    });

    const mockPrograms = vi.fn().mockResolvedValue({
      data: {
        listPrograms: {
          programs: [
            ...programInputFactory.build(3, (idx) => ({
              _id: `program-${idx + 1}`,
              name: `Program ${idx + 1}`,
              abbreviation: `P${idx + 1}`,
              description: `Description for Program ${idx + 1}`,
              readOnly: false,
            })),
          ],
        },
      },
    });

    const middleware = new QuestionnaireExcelMiddleware(mockForm, {
      application: applicationFactory.build({
        _id: "mock-uuid-v4-here",
        applicant: applicantFactory.build({
          applicantName: "Robert L. Smith",
          applicantID: "mock-applicant-id",
        }),
      }),
      getInstitutions: mockInstitutions,
      getPrograms: mockPrograms,
    });

    const serializedExcel = await middleware.serialize();
    const file = new File([serializedExcel], "filename.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(mockInstitutions).toHaveBeenCalled();
    expect(mockPrograms).toHaveBeenCalled();

    const data = await QuestionnaireExcelMiddleware.parse(file, {});

    expect(data).toEqual(mockForm);
  });
});
