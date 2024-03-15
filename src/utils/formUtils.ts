import { InitialQuestionnaire } from '../config/InitialValues';
import programOptions, { NotApplicableProgram, OptionalProgram } from '../config/ProgramConfig';

/**
 * Generic Email Validator
 *
 * @see https://mailtrap.io/blog/validate-emails-in-react/
 * @param {string} email The email to validate
 * @returns {boolean} True if the email is valid, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const re = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
  return re.test(email);
};

/**
 * Reduce Content Options
 *
 * NOTE:
 * - This util is for modifying the shape of the options
 *   into a form that FormGroupCheckbox accepts as a value.
 * - This is for when you want to contain checkboxes inside
 *   a single form group, but want separate properties/names
 *   for each checkbox. This will check the property value and
 *   name coming from data and add the name to the array if it's
 *   true, otherwise it will not include it.
 *
 * @param {SectionItemContentOption[]} options The options, usually coming from config
 * @returns {string[]} The re-shaped options. Ex. ["name1", "name2"]
 */
export const reshapeCheckboxGroupOptions = (options: FormGroupCheckboxOption[], data: QuestionnaireData): string[] => (
  options.reduce((acc, option) => (data[option.name] ? [...acc, option.value] : acc), [])
);

/**
 * Generic Non-Numeric Character Filter
 *
 * @param {string} value The value to filter
 * @returns {string} The filtered value
 */
export const filterNonNumeric = (value: string): string => value.replace(/[^0-9]/g, '');

/**
 * Filters input fields for Phone Numbers (numeric and dashes)
 *
 * @param {string} value The value to filter
 * @returns {string} The filtered value
 */
export const filterForNumbers = (value: string): string => value?.replace(/[^0-9- ]+/g, '');

/**
 * Adds a semi-stable key to the object
 *
 * NOTE:
 * - This should be used at the state level,
 *   not when rendering the object.
 *
 * @param {any} obj the object to map
 * @param {number} index the index of the object
 * @returns {any} the object with a key
 */
export const mapObjectWithKey = (obj, index: number) => ({
  ...obj,
  key: `${index}_${new Date().getTime()}`
});

/**
 * Finds the program option by its name.
 *
 * NOTE:
 * - This utility helps differentiate between a
 *   saved CUSTOM program and a PRESELECTED
 *   program option.
 *
 * @param {Program} program - The program object to search for.
 * @returns {ProgramOption} - Returns the program option if found,
 *                            otherwise returns program with initial values
 */
export const findProgram = (program: Program): ProgramOption => {
  const initialProgram: Program = {
    ...InitialQuestionnaire.program
  };
  if (!program) {
    return initialProgram;
  }
  if (program.notApplicable || program.name === NotApplicableProgram.name) {
    return NotApplicableProgram;
  }
  if (program.isCustom) {
    return OptionalProgram;
  }
  const newProgram: ProgramOption = programOptions.find((option) => option.name === program.name);
  if (!newProgram && (program.name?.length || program.abbreviation?.length || program.description?.length)) {
    return OptionalProgram;
  }
  return newProgram || initialProgram;
};

/**
 * Converts a program option to a select dropdown option.
 *
 * NOTE:
 * - The returned object has 'label' which combines program name and abbreviation
 *   and 'value' which is the program name.
 *
 * @param {ProgramOption} program - The program option to convert.
 * @returns {SelectOption} - Returns an object suitable for use in a select dropdown.
 */
export const programToSelectOption = (program: ProgramOption): SelectOption => ({
  label: `${program.name || ""}${program.abbreviation ? ` (${program.abbreviation})` : ""}`?.trim(),
  value: program.name || ""
});

/**
 * Formats an Approved Study Name and Abbreviation into a single string.
 * If the abbreviation is provided and not equal to the name, it will be included in parentheses.
 *
 * @example Alphabetic Study (AS)
 * @example Alphabetic Study
 * @param studyName The full name of the study
 * @param studyAbbreviation The abbreviation of the study
 * @returns The formatted study name
 */
export const formatFullStudyName = (studyName: string, studyAbbreviation: string): string => {
  if (studyAbbreviation === studyName) {
    return studyName.trim();
  }
  if (studyAbbreviation && studyAbbreviation.length > 0) {
    return `${studyName.trim()} (${studyAbbreviation.trim()})`;
  }

  return studyName.trim();
};

/**
 * Attempts to map a study name + abbreviation combination to an approved study ID.
 *
 * - Will return the first match found
 * - If no match is found, an empty string is returned
 *
 * @param Study information from Organization object
 * @param studies List of approved studies
 * @returns The ID of the study if found, otherwise an empty string
 */
export const mapOrganizationStudyToId = (
  orgStudy: Pick<ApprovedStudy, "studyName" | "studyAbbreviation">,
  studies: Pick<ApprovedStudy, "_id" | "studyName" | "studyAbbreviation">[]
): ApprovedStudy["_id"] => {
  const { studyName, studyAbbreviation } = orgStudy || {};

  return studies?.find((study) => study?.studyName === studyName && study?.studyAbbreviation === studyAbbreviation)?._id || "";
};
