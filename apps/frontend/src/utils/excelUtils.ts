import type ExcelJS from "exceljs";

/**
 * Quotes a string for Excel formulas, escaping internal quotes.
 *
 * @param s The string to quote
 * @returns The quoted string
 * @example
 * q("hello") // returns '"hello"'
 * q('say "hi"') // returns '"say ""hi"""'
 */
export const q = (s: string): string => `"${String(s).replace(/"/g, '""')}"`;

/**
 * Converts "D2" into an absolute address "$D$2".
 * Handles multi-letter columns like "AA10".
 *
 * @param addr The address to convert
 * @returns The absolute address
 * @example
 * abs("D2") // returns "$D$2"
 * abs("AA10") // returns "$AA$10"
 */
export const abs = (addr: string): string =>
  addr.replace(/^\$?([A-Z]+)\$?(\d+)$/i, (_m, c, r) => `$${c.toUpperCase()}$${r}`);

/**
 * Returns an absolute reference for a keyed cell on a given row.
 * Example: refFromRow(row, "email") -> "$D$2"
 *
 * @param row The row containing the cell
 * @param key The key of the cell
 * @returns The absolute reference of the cell
 * @example
 * refFromRow(row, "email") // returns "$D$2" if email cell is at D2
 * refFromRow(row, "name") // returns "$A$5" if name cell is at A5
 */
export const refFromRow = (row: ExcelJS.Row, key: string): string => abs(row.getCell(key).address);

/**
 * Combines multiple conditions with AND
 *
 * @param xs The conditions to combine
 * @returns The combined formula string
 * @example
 * AND("A1>0", "B1<10") // returns "AND(A1>0,B1<10)"
 * AND("C1=1", "D1=2", "E1=3") // returns "AND(C1=1,D1=2,E1=3)"
 */
export const AND = (...xs: string[]) => `AND(${xs.join(",")})`;
/**
 * Combines multiple conditions with OR
 *
 * @param xs The conditions to combine
 * @returns The combined formula string
 * @example
 * OR("A1=1", "A1=2") // returns "OR(A1=1,A1=2)"
 * OR("B1>5", "C1<3", "D1=0") // returns "OR(B1>5,C1<3,D1=0)"
 */
export const OR = (...xs: string[]) => `OR(${xs.join(",")})`;

/**
 * Negates a condition
 *
 * @param x The condition to negate
 * @returns The negated formula string
 * @example
 * NOT("A1=5") // returns "NOT(A1=5)"
 * NOT("ISBLANK(B1)") // returns "NOT(ISBLANK(B1))"
 */
export const NOT = (x: string) => `NOT(${x})`;

/**
 * Creates an IF formula
 *
 * @param cond The condition to evaluate
 * @param t The value if true
 * @param f The value if false
 * @returns The IF formula string
 * @example
 * IF("A1>10", '"High"', '"Low"') // returns 'IF(A1>10,"High","Low")'
 * IF("B1=0", '"Empty"', 'B1') // returns 'IF(B1=0,"Empty",B1)'
 */
export const IF = (cond: string, t: string, f: string) => `IF(${cond},${t},${f})`;

/**
 * Checks if two values are equal
 *
 * @param a The first value
 * @param b The second value
 * @returns The equality formula string
 * @example
 * EQ("A1", "B1") // returns "A1=B1"
 * EQ("$C$1", '"test"') // returns '$C$1="test"'
 */
export const EQ = (a: string, b: string) => `${a}=${b}`;

/**
 * Checks if two values are not equal
 *
 * @param a The first value
 * @param b The second value
 * @returns The inequality formula string
 * @example
 * NEQ("A1", "B1") // returns "A1<>B1"
 * NEQ("$C$1", '"test"') // returns '$C$1<>"test"'
 */
export const NEQ = (a: string, b: string) => `${a}<>${b}`;

/**
 * Checks if a value is less than another value
 *
 * @param a The first value
 * @param b The second value
 * @returns The less than formula string
 * @example
 * LT("A1", "10") // returns "A1<10"
 * LT("B1", "C1") // returns "B1<C1"
 */
export const LT = (a: string, b: string) => `${a}<${b}`;

/**
 * Checks if a value is less than or equal to another value
 *
 * @param a The first value
 * @param b The second value
 * @returns The less than or equal to formula string
 * @example
 * LTE("A1", "100") // returns "A1<=100"
 * LTE("B1", "C1") // returns "B1<=C1"
 */
export const LTE = (a: string, b: string) => `${a}<=${b}`;

/**
 * Checks if a value is greater than another value
 *
 * @param a The first value
 * @param b The second value
 * @returns The greater than formula string
 * @example
 * GT("A1", "0") // returns "A1>0"
 * GT("B1", "C1") // returns "B1>C1"
 */
export const GT = (a: string, b: string) => `${a}>${b}`;

/**
 * Checks if a value is greater than or equal to another value
 *
 * @param a The first value
 * @param b The second value
 * @returns The greater than or equal to formula string
 * @example
 * GTE("A1", "18") // returns "A1>=18"
 * GTE("B1", "C1") // returns "B1>=C1"
 */
export const GTE = (a: string, b: string) => `${a}>=${b}`;

/**
 * Returns the length of a string
 *
 * @param x The string to measure
 * @returns The length formula string
 * @example
 * LEN("A1") // returns "LEN(A1)"
 * LEN("$B$2") // returns "LEN($B$2)"
 */
export const LEN = (x: string) => `LEN(${x})`;

/**
 * Returns a trimmed version of a string
 *
 * @param x The string to trim
 * @returns The trimmed string formula
 * @example
 * TRIM("A1") // returns "TRIM(A1)"
 * TRIM("$B$2") // returns "TRIM($B$2)"
 */
export const TRIM = (x: string) => `TRIM(${x})`;

/**
 * Returns a left-aligned portion of a string
 *
 * @param x The string to extract from
 * @param n The number of characters to extract
 * @returns The left-aligned portion formula string
 * @example
 * LEFT("A1", 3) // returns "LEFT(A1,3)"
 * LEFT("$B$2", 5) // returns "LEFT($B$2,5)"
 */
export const LEFT = (x: string, n: number) => `LEFT(${x},${n})`;

/**
 * Returns a middle portion of a string
 *
 * @param x The string to extract from
 * @param i The starting position
 * @param n The number of characters to extract
 * @returns The middle portion formula string
 * @example
 * MID("A1", 2, 3) // returns "MID(A1,2,3)"
 * MID("$B$2", 5, 1) // returns "MID($B$2,5,1)"
 */
export const MID = (x: string, i: number, n: number) => `MID(${x},${i},${n})`;

/**
 * Returns a right-aligned portion of a string
 *
 * @param x The string to extract from
 * @param n The number of characters to extract
 * @returns The right-aligned portion formula string
 * @example
 * RIGHT("A1", 2) // returns "RIGHT(A1,2)"
 * RIGHT("$B$2", 4) // returns "RIGHT($B$2,4)"
 */
export const RIGHT = (x: string, n: number) => `RIGHT(${x},${n})`;

/**
 * Replaces occurrences of a substring within a string
 *
 * @param x The string to modify
 * @param find The substring to find
 * @param repl The replacement substring
 * @returns The modified string formula
 * @example
 * SUB("A1", "old", "new") // returns 'SUBSTITUTE(A1,"old","new")'
 * SUB("$B$2", " ", "_") // returns 'SUBSTITUTE($B$2," ","_")'
 */
export const SUB = (x: string, find: string, repl: string) =>
  `SUBSTITUTE(${x},${q(find)},${q(repl)})`;

/**
 * Returns an uppercased version of a string
 *
 * @param x The string to convert
 * @returns The uppercased string formula
 * @example
 * UPPER("A1") // returns "UPPER(A1)"
 * UPPER("$B$2") // returns "UPPER($B$2)"
 */
export const UPPER = (x: string) => `UPPER(${x})`;

/**
 * Converts a text string that represents a number to a numeric value
 *
 * @param x The string to convert
 * @returns The numeric value formula
 * @example
 * VALUE("A1") // returns "VALUE(A1)"
 * VALUE("$B$2") // returns "VALUE($B$2)"
 */
export const VALUE = (x: string) => `VALUE(${x})`;

/**
 * Checks if a value is a number
 *
 * @param x The value to check
 * @returns The ISNUMBER formula string
 * @example
 * ISNUMBER("A1") // returns "ISNUMBER(A1)"
 * ISNUMBER("$B$2") // returns "ISNUMBER($B$2)"
 */
export const ISNUMBER = (x: string) => `ISNUMBER(${x})`;

/**
 * Searches for a substring within a string
 *
 * @param needle The substring to find
 * @param hay The string to search within
 * @returns The SEARCH formula string
 * @example
 * SEARCH("@", "A1") // returns 'SEARCH("@",A1)'
 * SEARCH(".", "$B$2") // returns 'SEARCH(".",$B$2)'
 */
export const SEARCH = (needle: string, hay: string) => `SEARCH(${q(needle)},${hay})`;

/**
 * Returns a reference to a cell
 *
 * @param c The cell to reference
 * @returns The cell reference formula
 * @example
 * CELL("A1") // returns "$A$1"
 * CELL(someCell) // returns "$D$5" if someCell is at D5
 */
export const CELL = (c: ExcelJS.Cell | string) => {
  const a1 = typeof c === "string" ? c : c.address;
  return abs(a1);
};

/**
 * Checks if a string is equal to another string
 *
 * @param c The cell to check
 * @param v The value to compare against
 * @returns The equality formula string
 * @example
 * STR_EQ("A1", "test") // returns '$A$1="test"'
 * STR_EQ(someCell, "value") // returns '$D$5="value"' if someCell is at D5
 */
export const STR_EQ = (c: ExcelJS.Cell | string, v: string) => EQ(CELL(c), q(v));

/**
 * Checks if a cell contains a value from a list of values
 *
 * @param c The cell to check
 * @param values The list of values to check against
 * @returns The formula string
 * @example
 * IN("A1", ["red", "blue", "green"]) // returns 'OR($A$1="red",$A$1="blue",$A$1="green")'
 * IN(someCell, ["yes", "no"]) // returns 'OR($D$5="yes",$D$5="no")' if someCell is at D5
 */
export const IN = (c: ExcelJS.Cell | string, values: string[]) =>
  OR(...values.map((v) => STR_EQ(c, v)));

/**
 * Checks if a cell is required (non-empty after TRIM)
 *
 * @param c The cell to check
 * @returns The formula string
 * @example
 * REQUIRED("A1") // returns "LEN(TRIM($A$1))>0"
 * REQUIRED(someCell) // returns "LEN(TRIM($D$5))>0" if someCell is at D5
 */
export const REQUIRED = (c: ExcelJS.Cell | string) => `${LEN(TRIM(CELL(c)))}>0`;

/**
 * Checks if the text length of a cell is within the maximum bounds
 *
 * @param c The cell to check
 * @param n The maximum length
 * @returns The formula string
 * @example
 * TEXT_MAX("A1", 50) // returns "LEN($A$1)<=50"
 * TEXT_MAX(someCell, 100) // returns "LEN($D$5)<=100" if someCell is at D5
 */
export const TEXT_MAX = (c: ExcelJS.Cell | string, n: number) => `${LEN(CELL(c))}<=${n}`;

/**
 * Checks if the text length of a cell is within the minimum bounds
 *
 * @param c The cell to check
 * @param n The minimum length
 * @returns The formula string
 * @example
 * TEXT_MIN("A1", 3) // returns "LEN($A$1)>=3"
 * TEXT_MIN(someCell, 5) // returns "LEN($D$5)>=5" if someCell is at D5
 */
export const TEXT_MIN = (c: ExcelJS.Cell | string, n: number) => `${LEN(CELL(c))}>=${n}`;

/**
 * Checks if a cell contains a valid email address
 *
 * @param c The cell to check
 * @returns The formula string
 * @example
 * EMAIL("A1") // returns complex AND formula checking for @ and . in $A$1
 * EMAIL(someCell) // returns email validation formula for cell at D5
 */
export const EMAIL = (c: ExcelJS.Cell | string) => {
  const x = CELL(c);
  return AND(
    ISNUMBER(SEARCH("@", x)),
    ISNUMBER(SEARCH(".", x)),
    `${LEN(x)}-${LEN(SUB(x, ".", ""))}>=1`,
    `${LEN(x)}-${LEN(SUB(x, "@", ""))}=1`
  );
};

/**
 * Checks if a cell contains a valid ORCID
 *
 * @param c The cell to check
 * @returns The formula string
 * @example
 * ORCID("A1") // returns complex AND formula validating ORCID format in $A$1
 * ORCID(someCell) // returns ORCID validation formula for "0000-0000-0000-0000" format
 */
export const ORCID = (c: ExcelJS.Cell | string) => {
  const x = CELL(c);
  return AND(
    `${LEN(x)}=19`,
    EQ(MID(x, 5, 1), '"-"'),
    EQ(MID(x, 10, 1), '"-"'),
    EQ(MID(x, 15, 1), '"-"'),
    ISNUMBER(VALUE(LEFT(x, 4))),
    ISNUMBER(VALUE(MID(x, 6, 4))),
    ISNUMBER(VALUE(MID(x, 11, 4))),
    ISNUMBER(VALUE(MID(x, 16, 3))),
    OR(ISNUMBER(VALUE(RIGHT(x, 1))), `${UPPER(RIGHT(x, 1))}="X"`)
  );
};

/**
 * Checks if a cell contains a valid UUID v4
 *
 * @param c The cell to check
 * @returns The formula string
 * @example
 * UUIDV4("A1") // returns complex AND formula validating UUID v4 format in $A$1
 * UUIDV4(someCell) // returns UUID v4 validation formula for "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" format
 */
export const UUIDV4 = (c: ExcelJS.Cell | string) => {
  const x = CELL(c);
  return AND(
    `${LEN(x)}=36`,
    EQ(MID(x, 9, 1), '"-"'),
    EQ(MID(x, 14, 1), '"-"'),
    EQ(MID(x, 19, 1), '"-"'),
    EQ(MID(x, 24, 1), '"-"'),
    EQ(MID(x, 15, 1), '"4"'),
    OR(
      `${UPPER(MID(x, 20, 1))}="8"`,
      `${UPPER(MID(x, 20, 1))}="9"`,
      `${UPPER(MID(x, 20, 1))}="A"`,
      `${UPPER(MID(x, 20, 1))}="B"`
    )
  );
};

/**
 * Provides the Excel formula string to check if the cell contains a valid phone number (numeric, space, and dash)
 *
 * @param c The cell to check
 * @returns The formula string
 */
export const PHONE = (c: ExcelJS.Cell | string) => {
  const x = CELL(c);
  return AND(`${LEN(TRIM(x))}>0`, `ISNUMBER(SUBSTITUTE(SUBSTITUTE(TRIM(${x})," ",""),"-","")+0)`);
};

/**
 * Quotes a sheet name for Excel ('Sheet 1' -> ''Sheet 1'') and wraps in single quotes.
 * Safe to use for all sheet names (with or without spaces/special chars).
 *
 * @example SHEET("My Sheet") // returns "'My Sheet'"
 */
export const SHEET = (name: string) => `'${String(name).replace(/'/g, "''")}'`;

/**
 * Builds an A1 address from column + row.
 *
 * @example A1("b", 3) // "B3"
 */
export const A1 = (col: string, row: number) => `${col.toUpperCase()}${row}`;

/**
 * Builds an absolute A1 address from column + row.
 *
 * @example ABS_ADDR("B", 3) // "$B$3"
 */
export const ABS_ADDR = (col: string, row: number) => abs(A1(col, row));

/**
 * Absolute range from two refs (strings like "B1" or ExcelJS.Cell).
 * Uses CELL() to ensure absolute references.
 *
 * @example
 * RANGE("B1", "B10") // "$B$1:$B$10"
 * RANGE(cellA, cellB) // "$D$5:$D$25"
 */
export const RANGE = (a: ExcelJS.Cell | string, b: ExcelJS.Cell | string) =>
  `${CELL(a)}:${CELL(b)}`;

/**
 * Sheet-qualified absolute range.
 *
 * @example SHEET_RANGE("My Sheet", "B1", "B10") // "'My Sheet'!$B$1:$B$10"
 */
export const SHEET_RANGE = (sheet: string, a: ExcelJS.Cell | string, b: ExcelJS.Cell | string) =>
  `${SHEET(sheet)}!${RANGE(a, b)}`;

/**
 * Convenience: produce a list data-validation formula for a single column between 2 rows.
 * Includes the leading "=" expected by Excel for list ranges.
 *
 * @example LIST_FORMULA("My Sheet", "B", 1, 10) // "='My Sheet'!$B$1:$B$10"
 */
export const LIST_FORMULA = (sheet: string, col: string, startRow: number, endRow: number) =>
  `=${SHEET_RANGE(sheet, ABS_ADDR(col, startRow), ABS_ADDR(col, endRow))}`;

/**
 * Returns the formula for today's date.
 *
 * @returns The formula string for today's date.
 */
export const TODAY = () => "TODAY()";

/**
 * Checks if a cell contains a valid date not before today.
 *
 * @param c The cell to check
 * @param opts Options for the validation
 * @returns The formula string for the validation
 */
export const DATE_NOT_BEFORE_TODAY = (c: ExcelJS.Cell | string, opts: { allowBlank?: boolean }) => {
  const allowBlank = opts?.allowBlank ?? false;
  const x = CELL(c);

  const base = AND(ISNUMBER(x), GTE(x, TODAY()));
  return allowBlank ? OR(NOT(REQUIRED(x)), base) : base;
};

/**
 * Converts a boolean value to a Yes/No string.
 *
 * @param value The boolean value to convert.
 * @returns The Yes/No string representation.
 */
export const toYesNo = (value: boolean | null | undefined) => {
  if (value === true) {
    return "Yes";
  }
  if (value === false) {
    return "No";
  }

  return null;
};

/**
 * Checks if a cell contains a valid hyperlink.
 *
 * @param v The cell value to check.
 * @returns True if the cell contains a hyperlink, false otherwise.
 */
export const isHyperlinkValue = (v: ExcelJS.CellValue): v is ExcelJS.CellHyperlinkValue =>
  typeof v === "object" && v !== null && "hyperlink" in v && "text" in v;

/**
 * Checks if a cell contains a valid formula.
 *
 * @param v The cell value to check.
 * @returns True if the cell contains a formula, false otherwise.
 */
export const isFormulaValue = (v: ExcelJS.CellValue): v is ExcelJS.CellFormulaValue =>
  typeof v === "object" && v !== null && "formula" in v;

/**
 * Checks if a cell contains a valid shared formula.
 *
 * @param v The cell value to check.
 * @returns True if the cell contains a shared formula, false otherwise.
 */
export const isSharedFormulaValue = (v: ExcelJS.CellValue): v is ExcelJS.CellSharedFormulaValue =>
  typeof v === "object" && v !== null && "sharedFormula" in v;

/**
 * Checks if a cell contains a valid rich text value.
 *
 * @param v The cell value to check.
 * @returns True if the cell contains a rich text value, false otherwise.
 */
export const isRichTextValue = (v: ExcelJS.CellValue): v is ExcelJS.CellRichTextValue =>
  typeof v === "object" &&
  v !== null &&
  "richText" in v &&
  Array.isArray((v as { richText: unknown }).richText);

/**
 * Checks if a cell contains a valid error value.
 * @param v The cell value to check.
 * @returns True if the cell contains an error value, false otherwise.
 */
export const isErrorValue = (v: ExcelJS.CellValue): v is ExcelJS.CellErrorValue =>
  typeof v === "object" && v !== null && "error" in v;

/**
 * Checks if a cell contains a valid PHS identifier.
 *
 * @note Aims to match validatePHSNumber loose implementation.
 * @param {ExcelJS.Cell} c The cell to check.
 * @returns The formula string for the validation.
 */
export const PHS_OK = (c: ExcelJS.Cell | string) => {
  const x = TRIM(CELL(c));
  const pIdx = `IFERROR(FIND(".p",LOWER(${x})),0)`;

  return OR(
    AND(`LEN(${x})=9`, `LEFT(${x},3)="phs"`, `IFERROR(ISNUMBER(VALUE(RIGHT(${x},6))),FALSE)`),
    AND(
      `LEFT(${x},3)="phs"`,
      `IFERROR(ISNUMBER(VALUE(MID(${x},4,6))),FALSE)`,
      `LOWER(MID(${x},10,2))=".v"`,
      `LEN(${x})>11`,
      `IFERROR(ISNUMBER(VALUE(MID(${x},12,LEN(${x})-11))),FALSE)`,
      `NOT(${pIdx}>0)`
    ),
    AND(
      `LEFT(${x},3)="phs"`,
      `IFERROR(ISNUMBER(VALUE(MID(${x},4,6))),FALSE)`,
      `LOWER(MID(${x},10,2))=".v"`,
      `${pIdx}>12`,
      `IFERROR(ISNUMBER(VALUE(MID(${x},12,${pIdx}-12))),FALSE)`,
      `LOWER(IFERROR(MID(${x},${pIdx},2),""))=".p"`,
      `LEN(${x})>${pIdx}+1`,
      `IFERROR(ISNUMBER(VALUE(MID(${x},${pIdx}+2,LEN(${x})-${pIdx}))),FALSE)`
    )
  );
};
