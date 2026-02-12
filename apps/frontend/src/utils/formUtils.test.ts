import { cloneDeep } from "lodash";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import { contactFactory } from "@/factories/application/ContactFactory";
import { fileInfoFactory } from "@/factories/application/FileInfoFactory";
import { fundingFactory } from "@/factories/application/FundingFactory";
import { plannedPublicationFactory } from "@/factories/application/PlannedPublicationFactory";
import { programInputFactory } from "@/factories/application/ProgramInputFactory";
import { publicationFactory } from "@/factories/application/PublicationFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { repositoryFactory } from "@/factories/application/RepositoryFactory";
import { studyFactory } from "@/factories/application/StudyFactory";

import * as PersistentColumns from "../classes/Excel/PersistentColumns";
import { NotApplicableProgram, OtherProgram } from "../config/ProgramConfig";

import * as utils from "./formUtils";
import { Logger } from "./logger";

describe("filterNonNumeric cases", () => {
  it("should filter non-numerics", () => {
    expect(utils.filterNonNumeric("123abc")).toEqual("123");
  });

  it("should preserve original strings", () => {
    expect(utils.filterNonNumeric("")).toEqual("");
  });

  it("should return empty strings if there is no numerics", () => {
    expect(utils.filterNonNumeric("abc")).toEqual("");
  });
});

describe("filterForNumbers cases", () => {
  it("should return empty string when given an empty string", () => {
    expect(utils.filterForNumbers("")).toBe("");
  });

  it("should return only numbers when given a string with numbers and other characters", () => {
    expect(utils.filterForNumbers("abc123def456")).toBe("123456");
  });

  it("should return only numbers and dashes when given a string with numbers, dashes, and other characters", () => {
    expect(utils.filterForNumbers("abc123-def456")).toBe("123-456");
  });

  it("should return the original string when given a string with numbers and spaces", () => {
    expect(utils.filterForNumbers("123 456")).toBe("123 456");
  });

  it("should filter special characters", () => {
    expect(utils.filterForNumbers("123!@#$%^&*()_+")).toEqual("123");
  });

  it("should filter newlines", () => {
    // NOTE: This tests against the usage of \s in the regex
    expect(utils.filterForNumbers("123\n")).toEqual("123");
  });

  it("should filter tabs", () => {
    // NOTE: This tests against the usage of \s in the regex
    expect(utils.filterForNumbers("123\t")).toEqual("123");
  });
});

describe("validateEmail cases", () => {
  it("should prevent domain-only emails", () => {
    expect(utils.validateEmail("abc.com")).toEqual(false);
  });

  it("should prevent domains without TLDs emails", () => {
    expect(utils.validateEmail("test-email@example")).toEqual(false);
  });

  it("should return false for invalid email", () => {
    expect(utils.validateEmail("testexample.com")).toBe(false);
  });

  it("should return false for email with spaces", () => {
    expect(utils.validateEmail("test example@example.com")).toBe(false);
  });

  it("should return false for email with special characters", () => {
    expect(utils.validateEmail("test!example@example.com")).toBe(false);
  });

  it("should return false for email with multiple @ symbols", () => {
    expect(utils.validateEmail("test@example@com")).toBe(false);
  });

  it("should allow periods", () => {
    expect(utils.validateEmail("abc.123@example.com")).toEqual(true);
  });

  it("should return true for valid email", () => {
    expect(utils.validateEmail("test@example.com")).toBe(true);
  });

  it("should allow valid NIH emails", () => {
    expect(utils.validateEmail("abc@nih.gov")).toEqual(true);
  });

  it("should allow dashes", () => {
    expect(utils.validateEmail("test-email@example.com")).toEqual(true);
  });
});

describe("mapObjectWithKey cases", () => {
  const object = [{ name: "test1" }, { name: "test2" }, { name: "test3" }];

  it("should not modify the original object", () => {
    expect(object.map(utils.mapObjectWithKey)).not.toBe(object);
  });

  it("should add a key to each object", () => {
    const newObject = object.map(utils.mapObjectWithKey);

    newObject.forEach((obj) => {
      expect(obj).toHaveProperty("key");
      expect(obj.key).not.toEqual("");
    });
  });
});

describe("findProgram", () => {
  const programOptions = [
    { _id: "program1", name: "Program 1" },
    { _id: "program2", name: "Program 2" },
  ];

  it("should return null if formProgram is null", () => {
    expect(utils.findProgram(null, programOptions)).toBeNull();
  });

  it("should return null if programOptions is empty", () => {
    expect(utils.findProgram({ _id: "test" }, [])).toBeNull();
  });

  it("should return NotApplicableProgram for legacy notApplicable input", () => {
    const formProgram: ProgramInput & { notApplicable: boolean } = {
      _id: "",
      name: "",
      abbreviation: "",
      description: "",
      notApplicable: true,
    };
    expect(utils.findProgram(formProgram, programOptions)).toEqual(NotApplicableProgram);
  });

  it("should return NotApplicableProgram when program _id matches", () => {
    const formProgram: ProgramInput = {
      _id: NotApplicableProgram._id,
      name: "",
      abbreviation: "",
      description: "",
    };
    expect(utils.findProgram(formProgram, programOptions)).toEqual(NotApplicableProgram);
  });

  it("should return null for empty formProgram without notApplicable", () => {
    const formProgram: ProgramInput = {};
    expect(utils.findProgram(formProgram, programOptions)).toBeNull();
  });

  it("should return an existing predefined program by _id", () => {
    const formProgram: ProgramInput = { _id: "program1" };
    expect(utils.findProgram(formProgram, programOptions)).toEqual(programOptions[0]);
  });

  it("should return OtherProgram with formProgram content if no match is found", () => {
    const formProgram: ProgramInput = { _id: "unknown", name: "Custom Program" };
    expect(utils.findProgram(formProgram, programOptions)).toEqual({
      ...formProgram,
      _id: OtherProgram._id,
    });
  });

  it("should return formProgram as-is if it matches OtherProgram", () => {
    const formProgram: ProgramInput = { _id: OtherProgram._id, name: "Custom Program" };
    expect(utils.findProgram(formProgram, programOptions)).toEqual(formProgram);
  });

  it("should include additional content from formProgram when returning OtherProgram", () => {
    const formProgram: ProgramInput = { name: "Custom Program", description: "Custom Description" };
    expect(utils.findProgram(formProgram, programOptions)).toEqual({
      ...formProgram,
      _id: OtherProgram._id,
    });
  });
});

describe("formatFullStudyName cases", () => {
  it("should return the abbreviation with the study name if both are available", () => {
    const studyName = "Study Name";
    const studyAbbreviation = "SN";
    expect(utils.formatFullStudyName(studyName, studyAbbreviation)).toBe("SN - Study Name");
  });

  it.each(["", undefined, null])(
    "should return only the study name if abbreviation is %s",
    (studyAbbreviation) => {
      const studyName = "Study Name";
      expect(utils.formatFullStudyName(studyName, studyAbbreviation)).toBe("Study Name");
    }
  );

  it("should ignore the study name if its equal to the abbreviation", () => {
    const studyName = "Study Name";
    const studyAbbreviation = "Study Name";
    const result = utils.formatFullStudyName(studyName, studyAbbreviation);
    expect(result).toBe("Study Name");
  });

  it("should ignore casing when comparing the study name and abbreviation", () => {
    const equalValuesWithDifferentCasing = utils.formatFullStudyName("study_name", "STUDY_NAME");
    expect(equalValuesWithDifferentCasing).toBe("STUDY_NAME"); // capitalized abbreviation

    const equalValuesWithDifferentCasing2 = utils.formatFullStudyName("STUDY_NAME", "study_name");
    expect(equalValuesWithDifferentCasing2).toBe("study_name"); // lowercase abbreviation
  });

  it("should remove extra spaces from the study name", () => {
    const studyName = "   Study Name   ";
    const result = utils.formatFullStudyName(studyName, "");
    expect(result).toBe("Study Name");
  });

  it("should remove extra spaces from the study abbreviation", () => {
    const studyName = "Study Name";
    const studyAbbreviation = "   SN   ";
    const result = utils.formatFullStudyName(studyName, studyAbbreviation);
    expect(result).toBe("SN - Study Name");
  });

  it("should return an empty string if the study name is not a string", () => {
    const studyName = 12345 as unknown as string;
    const result = utils.formatFullStudyName(studyName, "");
    expect(result).toBe("");
  });
});

describe("mapOrganizationStudyToId cases", () => {
  it("should return the id of the matching study", () => {
    const studies = [
      { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
    ] as ApprovedStudy[];

    const study = { studyName: "Study 1", studyAbbreviation: "S1" };
    const result = utils.mapOrganizationStudyToId(study, studies);

    expect(result).toBe("1");
  });

  it("should return the first matching study's id", () => {
    const studies = [
      { _id: "1", studyName: "MATCH", studyAbbreviation: "MA" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
      { _id: "3", studyName: "MATCH", studyAbbreviation: "MA" },
    ] as ApprovedStudy[];

    const study = { studyName: "MATCH", studyAbbreviation: "MA" };
    const result = utils.mapOrganizationStudyToId(study, studies);

    expect(result).toBe("1");
  });

  it("should short-circuit if the study already has an id", () => {
    const studies = [
      { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
    ] as ApprovedStudy[];

    const study = { _id: "id already exists", studyName: "Study 3", studyAbbreviation: "S3" };
    const result = utils.mapOrganizationStudyToId(study, studies);

    expect(result).toBe("id already exists");
  });

  it.each([null, undefined, 1])(
    "should return an empty string if no valid _id is provided and none match",
    (value) => {
      const studies = [
        { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
        { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
      ] as ApprovedStudy[];

      const study = { _id: value, studyName: "Study 3", studyAbbreviation: "S3" };
      const result = utils.mapOrganizationStudyToId(study, studies);

      expect(result).toBe("");
    }
  );

  it("should return an empty string if no matching study is found", () => {
    const studies = [
      { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
    ] as ApprovedStudy[];

    const study = { studyName: "Study 3", studyAbbreviation: "S3" };
    const result = utils.mapOrganizationStudyToId(study, studies);

    expect(result).toBe("");
  });

  it("should not throw an exception if the study is undefined", () => {
    const studies = [
      { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
    ] as ApprovedStudy[];

    expect(() => utils.mapOrganizationStudyToId(undefined, studies)).not.toThrow();
  });

  it("should not throw an exception if the study is null", () => {
    const studies = [
      { _id: "1", studyName: "Study 1", studyAbbreviation: "S1" },
      { _id: "2", studyName: "Study 2", studyAbbreviation: "S2" },
    ] as ApprovedStudy[];

    expect(() => utils.mapOrganizationStudyToId(null, studies)).not.toThrow();
  });

  it("should not throw an exception if the approved studies are corrupt", () => {
    const studies = [
      null,
      { invalidObject: "true" },
      { AAAA: undefined },
    ] as unknown as ApprovedStudy[];

    const study = { studyName: "Study 1", studyAbbreviation: "S1" };

    expect(() => utils.mapOrganizationStudyToId(study, studies)).not.toThrow();
  });

  it("should not throw an exception if the approved studies are undefined", () => {
    const study = { studyName: "Study 1", studyAbbreviation: "S1" };

    expect(() => utils.mapOrganizationStudyToId(study, undefined)).not.toThrow();
  });
});

describe("isValidORCID cases", () => {
  it("should return true for a valid ORCID", () => {
    expect(utils.isValidORCID("0000-0002-1825-0097")).toBe(true);
  });

  it("should return true for a valid ORCID with 'X' as the last character", () => {
    expect(utils.isValidORCID("0000-0002-1825-009X")).toBe(true);
  });

  it("should return false for an ORCID with less than 19 characters", () => {
    expect(utils.isValidORCID("0000-0002-1825-009")).toBe(false);
  });

  it("should return false for an ORCID with more than 19 characters", () => {
    expect(utils.isValidORCID("0000-0002-1825-0097X")).toBe(false);
  });

  it("should return false for an ORCID with invalid characters", () => {
    expect(utils.isValidORCID("0000-0002-1825-00!7")).toBe(false);
  });

  it("should return false for an ORCID with 'X' not as the last character", () => {
    expect(utils.isValidORCID("0000-0002-182X-0097")).toBe(false);
  });

  it("should return false for an ORCID with incorrect hyphen placement", () => {
    expect(utils.isValidORCID("0000-0002-182500-97")).toBe(false);
  });

  it("should return false if the input is not a string", () => {
    expect(utils.isValidORCID(123456789012e34 as unknown as string)).toBe(false);
  });

  it("should return false for an empty string", () => {
    expect(utils.isValidORCID("")).toBe(false);
  });

  it("should return false for a string with spaces", () => {
    expect(utils.isValidORCID("0000 0002 1825 0097")).toBe(false);
  });

  it("should return false for a string with special characters", () => {
    expect(utils.isValidORCID("0000-0002-1825-009@")).toBe(false);
  });

  it("should return false for a string with mixed case 'x' in the middle", () => {
    expect(utils.isValidORCID("0000-000X-1825-0097")).toBe(false);
  });
  it("should return false for a null or undefined value", () => {
    expect(utils.isValidORCID(null as unknown as string)).toBe(false);
    expect(utils.isValidORCID(undefined as unknown as string)).toBe(false);
  });
});

describe("formatORCIDInput cases", () => {
  it("should format a valid ORCID without hyphens", () => {
    expect(utils.formatORCIDInput("0000000218250097")).toBe("0000-0002-1825-0097");
  });

  it("should format a valid ORCID with hyphens", () => {
    expect(utils.formatORCIDInput("0000-0002-1825-0097")).toBe("0000-0002-1825-0097");
  });

  it("should convert lowercase 'x' to uppercase 'X'", () => {
    expect(utils.formatORCIDInput("000000021825009x")).toBe("0000-0002-1825-009X");
  });

  it("should remove invalid characters and format the input", () => {
    expect(utils.formatORCIDInput("0000-0002-1825-00!7")).toBe("0000-0002-1825-007");
  });

  it("should limit input to 16 valid characters and format correctly", () => {
    expect(utils.formatORCIDInput("00000002182500971234")).toBe("0000-0002-1825-0097");
  });

  it("should return an empty string for an empty input", () => {
    expect(utils.formatORCIDInput("")).toBe("");
  });

  it("should handle input with no valid characters", () => {
    expect(utils.formatORCIDInput("!!!")).toBe("");
  });

  it("should correctly format input with spaces", () => {
    expect(utils.formatORCIDInput("0000 0002 1825 0097")).toBe("0000-0002-1825-0097");
  });

  it("should correctly format input with mixed case 'x' in the middle", () => {
    expect(utils.formatORCIDInput("0000-000X-1825-0097")).toBe("0000-000X-1825-0097");
  });

  it("should handle a string that starts with invalid characters", () => {
    expect(utils.formatORCIDInput("!!0000000218250097")).toBe("0000-0002-1825-0097");
  });

  it("should handle a string that ends with invalid characters", () => {
    expect(utils.formatORCIDInput("0000000218250097!!")).toBe("0000-0002-1825-0097");
  });

  it("should return an empty string when the input is null or undefined", () => {
    expect(utils.formatORCIDInput(null)).toBe("");
    expect(utils.formatORCIDInput(undefined)).toBe("");
  });
});

describe("validateEmoji cases", () => {
  it("should return null for a string without emojis", () => {
    expect(utils.validateEmoji("This is a test string")).toBe(null);
  });

  it("should return null for a string containing numbers", () => {
    expect(utils.validateEmoji("Test123 string with numbers 456 789 101112")).toBe(null);
  });

  it("should return an error message for a string with emojis and other characters", () => {
    expect(utils.validateEmoji("This is a test string 😊 with emojis")).toEqual(expect.any(String));
  });

  it("should return an error message for a string with only emojis", () => {
    expect(utils.validateEmoji("😊😊😊😊😊")).toEqual(expect.any(String));
  });

  // NOTE: We're testing various different types of emojis here
  it.each<string>(["😊", "👨🏿‍🎤", "🔴", "1️⃣", "🇵🇷"])(
    "should return an error message for a string with emojis",
    (value) => {
      expect(utils.validateEmoji(value)).toEqual(expect.any(String));
    }
  );
});

describe("validateUTF8 cases", () => {
  it("should return null for a string without non-UTF8 characters", () => {
    expect(utils.validateUTF8("This is a test string")).toBe(null);
    expect(utils.validateUTF8("123 hello valid '@#$%^&*(")).toBe(null);
  });

  it("should handle large valid input", () => {
    const largeValidInput = "abc-123".repeat(10000);
    expect(utils.validateUTF8(largeValidInput)).toBe(null);
  });

  it("should handle null or undefined values", () => {
    expect(utils.validateUTF8(null as unknown as string)).toEqual(expect.any(String));
    expect(utils.validateUTF8(undefined as unknown as string)).toEqual(expect.any(String));
  });

  it.each<string>(["😊", "👨🏿‍🎤", "🔴", "1️⃣", "🇵🇷"])(
    "should return an error message for a string with emojis (%s)",
    (value) => {
      expect(utils.validateUTF8(value)).toEqual(expect.any(String));
    }
  );

  it.each<string>(["�", "ä", "ü", "ß", "è", "ò"])(
    "should return an error message for a string with non-UTF8 character %s",
    (value) => {
      expect(utils.validateUTF8(value)).toEqual(expect.any(String));
    }
  );
});

describe("combineQuestionnaireData cases", () => {
  it("should recursively merge plain objects", () => {
    const base = { a: 1, nested: { x: 1 } };
    const form = { b: 2, nested: { y: 2 } };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result).toEqual({ a: 1, b: 2, nested: { x: 1, y: 2 } });
  });

  it("should replace arrays rather than merging by index (questionnaire data)", () => {
    const base = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [fundingFactory.build({ agency: "1" }), fundingFactory.build({ agency: "2" })],
      }),
    });

    const form = { study: { funding: [fundingFactory.build({ agency: "3" })] } };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result.study.funding).toEqual([expect.objectContaining({ agency: "3" })]);
  });

  it("should replace nested arrays with empty arrays (questionnaire data)", () => {
    const base = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [fundingFactory.build({ agency: "1" }), fundingFactory.build({ agency: "2" })],
      }),
    });

    const form = { study: { funding: [] as Array<unknown> } };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result.study.funding).toEqual([]);
  });

  it("should not mutate the base object (deep clone first)", () => {
    const base = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [fundingFactory.build(), fundingFactory.build()],
      }),
    });
    const baseSnapshot = cloneDeep(base);

    const form = { study: { description: "Updated" } };

    const result = utils.combineQuestionnaireData(base, form);

    expect(base).toEqual(baseSnapshot);

    expect(result).not.toBe(base);
    expect(result.study).not.toBe(base.study);
    expect(result.study.funding).not.toBe(base.study.funding);
    expect(result.study.description).toBe("Updated");
  });

  it("should keep base value when form has undefined", () => {
    const base = { a: { x: 1 } };
    const form = { a: undefined as unknown as object };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result).toEqual({ a: { x: 1 } });
  });

  it("should overwrite with null when form sets null", () => {
    const base = { a: { x: 1 } };
    const form = { a: null as unknown as object };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result.a).toBeNull();
  });

  it("should return an equivalent value when form is empty, without sharing references (questionnaire data)", () => {
    const base = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [fundingFactory.build()],
      }),
    });
    const baseSnapshot = cloneDeep(base);

    const result = utils.combineQuestionnaireData(base, {});

    expect(result).toEqual(baseSnapshot);
    expect(result).not.toBe(base);
    expect(result.study).not.toBe(base.study);
    expect(result.study.funding).not.toBe(base.study.funding);
  });

  it("should handle top-level arrays by replacement", () => {
    const base = { tags: ["a", "b"] };
    const form = { tags: [] as string[] };

    const result = utils.combineQuestionnaireData(base, form);

    expect(result.tags).toEqual([]);
  });
});

describe("isValidDbGaPID cases", () => {
  it("should return true for a valid dbGaPID", () => {
    expect(utils.isValidDbGaPID("phs123456")).toBe(true);
  });

  it("should return true for a valid dbGaPID with different case", () => {
    expect(utils.isValidDbGaPID("PHS123456")).toBe(true);
    expect(utils.isValidDbGaPID("Phs123456")).toBe(true);
  });

  it("should return false for dbGaPID with less than 6 digits", () => {
    expect(utils.isValidDbGaPID("phs12345")).toBe(false);
  });

  it("should return false for dbGaPID with more than 6 digits", () => {
    expect(utils.isValidDbGaPID("phs1234567")).toBe(false);
  });

  it("should return false for dbGaPID without 'phs' prefix", () => {
    expect(utils.isValidDbGaPID("123456")).toBe(false);
  });

  it("should return false for dbGaPID with wrong prefix", () => {
    expect(utils.isValidDbGaPID("abc123456")).toBe(false);
  });

  it("should return false for strings that are too short", () => {
    expect(utils.isValidDbGaPID("phs123")).toBe(false);
    expect(utils.isValidDbGaPID("")).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(utils.isValidDbGaPID(null as unknown as string)).toBe(false);
    expect(utils.isValidDbGaPID(undefined as unknown as string)).toBe(false);
    expect(utils.isValidDbGaPID(123456789 as unknown as string)).toBe(false);
  });

  it("should return false for dbGaPID with letters in digit section", () => {
    expect(utils.isValidDbGaPID("phs12345a")).toBe(false);
  });

  it("should return false for dbGaPID with special characters", () => {
    expect(utils.isValidDbGaPID("phs123-456")).toBe(false);
    expect(utils.isValidDbGaPID("phs123.456")).toBe(false);
  });

  it("should return false for a dbGaPID with version or participant suffix", () => {
    expect(utils.isValidDbGaPID("phs123456.v1")).toBe(false);
    expect(utils.isValidDbGaPID("phs123456.p1")).toBe(false);
    expect(utils.isValidDbGaPID("phs123456.v1.p1")).toBe(false);
  });
});

describe("determineSectionStatus", () => {
  it('should return "Completed" if passed is true', () => {
    expect(utils.determineSectionStatus(true, true)).toBe("Completed");
    expect(utils.determineSectionStatus(true, false)).toBe("Completed");
  });

  it('should return "In Progress" if passed is false and hasData is true', () => {
    expect(utils.determineSectionStatus(false, true)).toBe("In Progress");
  });

  it('should return "Not Started" if both passed and hasData are false', () => {
    expect(utils.determineSectionStatus(false, false)).toBe("Not Started");
  });
});

describe("parseSchemaObject", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().int().min(0),
    nested: z.object({
      foo: z.string(),
      bar: z.number().optional(),
    }),
  });

  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(Logger, "error").mockImplementation(() => {});
    loggerInfoSpy = vi.spyOn(Logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerInfoSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should return passed=true and data if validation succeeds", () => {
    const data = {
      name: "Alice",
      age: 30,
      nested: { foo: "bar", bar: 1 },
    };
    const result = utils.parseSchemaObject(schema, data);

    expect(result.passed).toBe(true);
    expect(result.data).toEqual(data);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("should remove invalid fields and return passed=false if validation fails", () => {
    const data = {
      name: "Alice",
      age: "not-a-number",
      nested: { foo: 123, bar: 1 },
      extra: "should be removed",
    };

    const result = utils.parseSchemaObject(schema, data);
    expect(result.passed).toBe(false);
    // Should remove 'age' and 'nested.foo', but keep 'name', 'nested.bar', and 'extra'
    expect(result.data).toMatchObject({
      name: "Alice",
      nested: { bar: 1 },
      extra: "should be removed",
    });
    expect(result.data).not.toHaveProperty("age");
    expect(result.data.nested).not.toHaveProperty("foo");
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it("should handle deeply nested invalid fields", () => {
    const deepSchema = z.object({
      a: z.object({
        b: z.object({
          c: z.string(),
        }),
      }),
    });
    const data = { a: { b: { c: 123, d: "extra" } } };
    const result = utils.parseSchemaObject(deepSchema, data);

    expect(result.passed).toBe(false);
    expect(result.data).toEqual({ a: { b: { d: "extra" } } });
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it("should not unset anything if all fields are valid", () => {
    const data = { name: "Bob", age: 42, nested: { foo: "baz" } };
    const result = utils.parseSchemaObject(schema, data);

    expect(result.passed).toBe(true);
    expect(result.data).toEqual({ name: "Bob", age: 42, nested: { foo: "baz" } });
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("should handle empty data object", () => {
    const result = utils.parseSchemaObject(schema, {});
    expect(result.passed).toBe(false);
    expect(result.data).toEqual({});
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it("should persist value for a column key when shouldPersistColumnValue returns true", () => {
    const persistSchema = z.object({
      targetedSubmissionDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    });

    const data = {
      targetedSubmissionDate: "invalid-date", // fails regex
    };

    const shouldPersistSpy = vi
      .spyOn(PersistentColumns, "shouldPersistColumnValue")
      .mockImplementation((_columnKey, _value) => true);

    const result = utils.parseSchemaObject(persistSchema, data);

    expect(result.passed).toBe(false);
    expect(result.data).toEqual(data);

    expect(shouldPersistSpy).toHaveBeenCalledWith("targetedSubmissionDate", "invalid-date");

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      "parseSchemaObject: Persisting value for column key targetedSubmissionDate.",
      { value: "invalid-date" }
    );

    // Still expect an error log since validation failed
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});

describe("sectionHasData", () => {
  describe("Section A", () => {
    it("should return true for any PI data", () => {
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            pi: { ...contactFactory.build({ firstName: "smith" }), address: "" },
            primaryContact: null,
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            pi: { ...contactFactory.build(), address: "some data" },
            primaryContact: null,
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            pi: { ...contactFactory.build({ phone: "123-456-7890" }), address: "" },
            primaryContact: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for any primary contact data", () => {
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            primaryContact: contactFactory.build({ firstName: "jane" }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            primaryContact: contactFactory.build({ institution: "a mock institution" }),
          })
        )
      ).toBe(true);
    });

    it("should return true for any additional contact data", () => {
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            additionalContacts: [contactFactory.build({ firstName: "jane" })],
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            additionalContacts: [contactFactory.build({ phone: "240-989-0123" })],
          })
        )
      ).toBe(true);
    });

    it("should return false for no data", () => {
      expect(utils.sectionHasData("A", null)).toBe(false);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            pi: null,
            primaryContact: null,
            additionalContacts: [],
          })
        )
      ).toBe(false);
      expect(
        utils.sectionHasData(
          "A",
          questionnaireDataFactory.build({
            pi: null,
            primaryContact: null,
            additionalContacts: null,
          })
        )
      ).toBe(false);
    });
  });

  describe("Section B", () => {
    it("should return true for any program data", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            program: programInputFactory.build({
              name: "a mock program",
              abbreviation: null,
              description: null,
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            program: programInputFactory.build({
              name: null,
              abbreviation: "mock",
              description: null,
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            program: programInputFactory.build({
              name: null,
              abbreviation: null,
              description: "mock",
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            program: programInputFactory.build({
              _id: "12345",
              name: null,
              abbreviation: null,
              description: null,
            }),
          })
        )
      ).toBe(true);
    });

    it("should return true for study name, abbreviation, and description", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({ name: "mock", abbreviation: null, description: null }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({ name: null, abbreviation: "mock", description: null }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({ name: null, abbreviation: null, description: "mock" }),
          })
        )
      ).toBe(true);
    });

    it("should return true for funding agency data", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              funding: [
                fundingFactory.build({
                  agency: "mock",
                  grantNumbers: null,
                  nciProgramOfficer: null,
                }),
              ],
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              funding: [
                fundingFactory.build({
                  agency: null,
                  grantNumbers: "mock",
                  nciProgramOfficer: null,
                }),
              ],
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              funding: [
                fundingFactory.build({
                  agency: null,
                  grantNumbers: null,
                  nciProgramOfficer: "mock",
                }),
              ],
            }),
          })
        )
      ).toBe(true);
      // NOTE: Multiple funding entries with partial data should also return true
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              funding: [
                fundingFactory.build({
                  agency: null,
                  grantNumbers: null,
                  nciProgramOfficer: null,
                }),
                fundingFactory.build({
                  agency: "mock",
                  grantNumbers: null,
                  nciProgramOfficer: null,
                }),
              ],
            }),
          })
        )
      ).toBe(true);
    });

    it("should return true for publications", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              publications: [publicationFactory.build({ title: "mock" })],
            }),
          })
        )
      ).toBe(true);
    });

    it("should return true for planned publications", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              plannedPublications: [plannedPublicationFactory.build({ title: "mock" })],
            }),
          })
        )
      ).toBe(true);
    });

    it("should return true for repositories", () => {
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              repositories: [repositoryFactory.build({ name: "mock" })],
            }),
          })
        )
      ).toBe(true);
    });

    it("should return false for no data", () => {
      expect(utils.sectionHasData("B", null)).toBe(false);
      expect(
        utils.sectionHasData(
          "B",
          questionnaireDataFactory.build({
            program: null,
            study: null,
          })
        )
      ).toBe(false);
    });
  });

  describe("Section C", () => {
    it("should return true for access types", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            accessTypes: ["Controlled Access"],
          })
        )
      ).toBe(true);
    });

    it("should return true for dbGaP ID or GPA name data", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              isDbGapRegistered: null,
              dbGaPPPHSNumber: "phs000001",
              GPAName: null,
            }),
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            study: studyFactory.build({
              isDbGapRegistered: null,
              dbGaPPPHSNumber: null,
              GPAName: "Sam Bird",
            }),
          })
        )
      ).toBe(true);
    });

    it("should return true for Cancer Types", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            cancerTypes: ["Type 1"],
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return true for Other Cancer Types", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            otherCancerTypes: "Some mock data here",
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return true for Pre-Cancer Types", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            preCancerTypes: "Some other type",
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return true for Species", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            species: ["option 1", "option 2"],
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return true for Other Species", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            otherSpeciesOfSubjects: "some other species",
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return true for Number of Participants", () => {
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            numberOfParticipants: 999,
            study: null, // Clearing default study data
          })
        )
      ).toBe(true);
    });

    it("should return false for no data", () => {
      expect(utils.sectionHasData("C", null)).toBe(false);
      expect(
        utils.sectionHasData(
          "C",
          questionnaireDataFactory.build({
            study: null, // Clearing default study data
          })
        )
      ).toBe(false);
    });
  });

  describe("Section D", () => {
    it("should return true for Submission and Release dates", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            targetedReleaseDate: "02/19/2029",
            dataDeIdentified: null, // Reset factory default
            files: null,
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            targetedSubmissionDate: "02/19/2029",
            dataDeIdentified: null, // Reset factory default
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for Data Types", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            dataTypes: ["clinicalTrial"],
            dataDeIdentified: null, // Reset factory default
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for Other Data Types", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            otherDataTypes: "lorem | ipsum",
            dataDeIdentified: null, // Reset factory default
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for Files", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            files: [fileInfoFactory.build({ type: "PDF" })],
            dataDeIdentified: null, // Reset factory default
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            files: [fileInfoFactory.build({ extension: ".pdf" })],
            dataDeIdentified: null, // Reset factory default
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            files: [fileInfoFactory.build({ count: 9 })],
            dataDeIdentified: null, // Reset factory default
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            files: [fileInfoFactory.build({ amount: "90mb" })],
            dataDeIdentified: null, // Reset factory default
          })
        )
      ).toBe(true);
      // NOTE: Multiple files with partial data should also return true
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            files: [
              fileInfoFactory.build({ type: null, extension: null, count: null, amount: null }),
              fileInfoFactory.build({ type: "PDF", extension: null, count: null, amount: null }),
            ],
            dataDeIdentified: null, // Reset factory default
          })
        )
      ).toBe(true);
    });

    it("should return true for Data De-identified", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            dataDeIdentified: false,
            files: null,
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            dataDeIdentified: true,
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for Additional Comments", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            submitterComment: "lorem ipsum this is my comment",
            dataDeIdentified: null,
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return true for Cell Lines or Model Systems data", () => {
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            cellLines: true,
            dataDeIdentified: null,
            files: null,
          })
        )
      ).toBe(true);
      expect(
        utils.sectionHasData(
          "D",
          questionnaireDataFactory.build({
            modelSystems: true,
            dataDeIdentified: null,
            files: null,
          })
        )
      ).toBe(true);
    });

    it("should return false for no data", () => {
      expect(utils.sectionHasData("D", null)).toBe(false);
    });
  });

  it("should return false for an uncovered section", () => {
    expect(utils.sectionHasData("REVIEW", null)).toBe(false);
  });
});
