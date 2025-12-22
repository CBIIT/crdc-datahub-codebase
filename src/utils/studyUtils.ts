/**
 * Formats access types based on controlled and open access flags.
 *
 * @param {boolean} controlledAccess - Indicates whether controlled access is enabled.
 * @param {boolean} openAccess - Indicates whether open access is enabled.
 * @returns A formatted string listing the enabled access types separated by a comma and space.
 *          - Returns "Controlled, Open" if both are enabled.
 *          - Returns "Controlled" if only controlled access is enabled.
 *          - Returns "Open" if only open access is enabled.
 *          - Returns an empty string if neither is enabled.
 */
export const formatAccessTypes = (controlledAccess: boolean, openAccess: boolean): string => {
  const properties: AccessType[] = [];
  if (typeof controlledAccess === "boolean" && controlledAccess === true) {
    properties.push("Controlled");
  }
  if (typeof openAccess === "boolean" && openAccess === true) {
    properties.push("Open");
  }

  return properties.join(", ");
};

/**
 *  Loosely validates a dbGaP PHS accession number, with optional versioning and participant identifiers.
 *
 * @param input - The PHS accession number to validate.
 * @returns True if the input is a valid PHS accession number, false otherwise.
 * @example
 * validatePHSNumber("phs001234.v1.p1"); // true
 * validatePHSNumber("phs001234.v1"); // true
 * validatePHSNumber("phs001234"); // true
 * validatePHSNumber("phs00123"); // false
 * validatePHSNumber("phs001234.p1"); // false
 */
export const validatePHSNumber = (input: string): boolean => {
  const trimmedInput = input?.trim();
  const BASE_DIGIT_COUNT = 6;
  const pattern = new RegExp(`^phs\\d{${BASE_DIGIT_COUNT}}(?:\\.v\\d+(?:\\.p\\d+)?)?$`, "i");

  if (!trimmedInput?.length) {
    return false;
  }

  return pattern.test(trimmedInput);
};
