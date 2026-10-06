/**
 * This is a special program option that is used
 * when the user selects "Other" from the program dropdown.
 *
 * NOTE: You probably don't need to modify this.
 *
 * @see ProgramInput
 */
export const OtherProgram: ProgramInput = {
  _id: "Other",
  name: "",
  abbreviation: "",
  description: "",
};

/**
 * This is the legacy "Not Applicable" program option.
 *
 * NOTE: You probably don't need to modify this.
 *
 * @see ProgramInput
 * @deprecated Use `buildNotApplicableProgram` instead.
 */
export const NotApplicableProgram: ProgramInput = {
  _id: "Not Applicable",
  name: "",
  abbreviation: "",
  description: "",
};
