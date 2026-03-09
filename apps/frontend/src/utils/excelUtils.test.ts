import type ExcelJS from "exceljs";

import * as utils from "./excelUtils";

describe("q", () => {
  it("quotes a string", () => {
    expect(utils.q("hello")).toBe('"hello"');
    expect(utils.q('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("abs", () => {
  it("converts address to absolute", () => {
    expect(utils.abs("D2")).toBe("$D$2");
    expect(utils.abs("AA10")).toBe("$AA$10");
  });

  it("handles invalid input gracefully", () => {
    expect(utils.abs("")).toBe("");
  });
});

describe("refFromRow", () => {
  it("returns absolute reference for keyed cell", () => {
    const row = { getCell: (key: string) => ({ address: "D2" }) } as ExcelJS.Row;
    expect(utils.refFromRow(row, "email")).toBe("$D$2");
  });
});

describe("AND", () => {
  it("combines conditions", () => {
    expect(utils.AND("A1>0", "B1<10")).toBe("AND(A1>0,B1<10)");
  });
});

describe("OR", () => {
  it("combines conditions", () => {
    expect(utils.OR("A1=1", "A1=2")).toBe("OR(A1=1,A1=2)");
  });
});

describe("NOT", () => {
  it("negates condition", () => {
    expect(utils.NOT("A1=5")).toBe("NOT(A1=5)");
  });
});

describe("IF", () => {
  it("creates IF formula", () => {
    expect(utils.IF("A1>10", '"High"', '"Low"')).toBe('IF(A1>10,"High","Low")');
  });
});

describe("EQ", () => {
  it("checks equality", () => {
    expect(utils.EQ("A1", "B1")).toBe("A1=B1");
  });
});

describe("NEQ", () => {
  it("checks inequality", () => {
    expect(utils.NEQ("A1", "B1")).toBe("A1<>B1");
  });
});

describe("LT", () => {
  it("checks less than", () => {
    expect(utils.LT("A1", "10")).toBe("A1<10");
  });
});

describe("LTE", () => {
  it("checks less than or equal", () => {
    expect(utils.LTE("A1", "100")).toBe("A1<=100");
  });
});

describe("GT", () => {
  it("checks greater than", () => {
    expect(utils.GT("A1", "0")).toBe("A1>0");
  });
});

describe("GTE", () => {
  it("checks greater than or equal", () => {
    expect(utils.GTE("A1", "18")).toBe("A1>=18");
  });
});

describe("LEN", () => {
  it("returns length formula", () => {
    expect(utils.LEN("A1")).toBe("LEN(A1)");
  });
});

describe("TRIM", () => {
  it("returns trim formula", () => {
    expect(utils.TRIM("A1")).toBe("TRIM(A1)");
  });
});

describe("LEFT", () => {
  it("returns left formula", () => {
    expect(utils.LEFT("A1", 3)).toBe("LEFT(A1,3)");
  });
});

describe("MID", () => {
  it("returns mid formula", () => {
    expect(utils.MID("A1", 2, 3)).toBe("MID(A1,2,3)");
  });
});

describe("RIGHT", () => {
  it("returns right formula", () => {
    expect(utils.RIGHT("A1", 2)).toBe("RIGHT(A1,2)");
  });
});

describe("SUB", () => {
  it("returns substitute formula", () => {
    expect(utils.SUB("A1", "old", "new")).toBe('SUBSTITUTE(A1,"old","new")');
  });
});

describe("UPPER", () => {
  it("returns upper formula", () => {
    expect(utils.UPPER("A1")).toBe("UPPER(A1)");
  });
});

describe("VALUE", () => {
  it("returns value formula", () => {
    expect(utils.VALUE("A1")).toBe("VALUE(A1)");
  });
});

describe("ISNUMBER", () => {
  it("returns isnumber formula", () => {
    expect(utils.ISNUMBER("A1")).toBe("ISNUMBER(A1)");
  });
});

describe("SEARCH", () => {
  it("returns search formula", () => {
    expect(utils.SEARCH("@", "A1")).toBe('SEARCH("@",A1)');
  });
});

describe("CELL", () => {
  it("returns absolute cell address from string", () => {
    expect(utils.CELL("D2")).toBe("$D$2");
  });

  it("returns the cell address for an ExcelJS Cell value", () => {
    const mockCell = { address: "X92" } as ExcelJS.Cell;
    expect(utils.CELL(mockCell)).toBe("$X$92");
  });
});

describe("STR_EQ", () => {
  it("returns string equality formula", () => {
    expect(utils.STR_EQ("A1", "test")).toBe('$A$1="test"');
  });
});

describe("IN", () => {
  it("returns OR formula for values", () => {
    expect(utils.IN("A1", ["red", "blue"])).toBe('OR($A$1="red",$A$1="blue")');
  });
});

describe("REQUIRED", () => {
  it("returns required formula", () => {
    expect(utils.REQUIRED("A1")).toBe("LEN(TRIM($A$1))>0");
  });
});

describe("TEXT_MAX", () => {
  it("returns text max formula", () => {
    expect(utils.TEXT_MAX("A1", 50)).toBe("LEN($A$1)<=50");
  });
});

describe("TEXT_MIN", () => {
  it("returns text min formula", () => {
    expect(utils.TEXT_MIN("A1", 3)).toBe("LEN($A$1)>=3");
  });
});

describe("EMAIL", () => {
  it("returns email validation formula", () => {
    expect(utils.EMAIL("A1")).toEqual(
      `AND(ISNUMBER(SEARCH("@",$A$1)),ISNUMBER(SEARCH(".",$A$1)),LEN($A$1)-LEN(SUBSTITUTE($A$1,".",""))>=1,LEN($A$1)-LEN(SUBSTITUTE($A$1,"@",""))=1)`
    );

    expect(utils.EMAIL("D99")).toEqual(
      `AND(ISNUMBER(SEARCH("@",$D$99)),ISNUMBER(SEARCH(".",$D$99)),LEN($D$99)-LEN(SUBSTITUTE($D$99,".",""))>=1,LEN($D$99)-LEN(SUBSTITUTE($D$99,"@",""))=1)`
    );
  });
});

describe("ORCID", () => {
  it("returns ORCID validation formula", () => {
    expect(utils.ORCID("X4")).toEqual(
      `AND(LEN($X$4)=19,MID($X$4,5,1)="-",MID($X$4,10,1)="-",MID($X$4,15,1)="-",ISNUMBER(VALUE(LEFT($X$4,4))),ISNUMBER(VALUE(MID($X$4,6,4))),ISNUMBER(VALUE(MID($X$4,11,4))),ISNUMBER(VALUE(MID($X$4,16,3))),OR(ISNUMBER(VALUE(RIGHT($X$4,1))),UPPER(RIGHT($X$4,1))="X"))`
    );
  });
});

describe("UUIDV4", () => {
  it("returns UUID v4 validation formula", () => {
    expect(utils.UUIDV4("Y7")).toEqual(
      `AND(LEN($Y$7)=36,MID($Y$7,9,1)="-",MID($Y$7,14,1)="-",MID($Y$7,19,1)="-",MID($Y$7,24,1)="-",MID($Y$7,15,1)="4",OR(UPPER(MID($Y$7,20,1))="8",UPPER(MID($Y$7,20,1))="9",UPPER(MID($Y$7,20,1))="A",UPPER(MID($Y$7,20,1))="B"))`
    );
  });
});

describe("PHONE", () => {
  it("generates correct formula for a simple cell reference", () => {
    expect(utils.PHONE("A1")).toBe(
      'AND(LEN(TRIM($A$1))>0,ISNUMBER(SUBSTITUTE(SUBSTITUTE(TRIM($A$1)," ",""),"-","")+0))'
    );
  });

  it("generates correct formula for a multi-letter cell reference", () => {
    expect(utils.PHONE("AA10")).toBe(
      'AND(LEN(TRIM($AA$10))>0,ISNUMBER(SUBSTITUTE(SUBSTITUTE(TRIM($AA$10)," ",""),"-","")+0))'
    );
  });

  it("handles cell references with lowercase letters", () => {
    expect(utils.PHONE("b2")).toBe(
      'AND(LEN(TRIM($B$2))>0,ISNUMBER(SUBSTITUTE(SUBSTITUTE(TRIM($B$2)," ",""),"-","")+0))'
    );
  });

  it("returns a formula that requires non-empty input", () => {
    const formula = utils.PHONE("C3");
    expect(formula).toContain("LEN(TRIM($C$3))>0");
  });

  it("returns a formula that allows spaces and dashes", () => {
    const formula = utils.PHONE("D4");
    expect(formula).toContain('SUBSTITUTE(SUBSTITUTE(TRIM($D$4)," ",""),"-","")');
  });

  it("returns a formula that checks for numeric value after removing spaces and dashes", () => {
    const formula = utils.PHONE("E5");
    expect(formula).toContain('ISNUMBER(SUBSTITUTE(SUBSTITUTE(TRIM($E$5)," ",""),"-","")+0)');
  });
});

describe("SHEET", () => {
  it("quotes sheet name", () => {
    expect(utils.SHEET("Sheet 1")).toBe("'Sheet 1'");
    expect(utils.SHEET("O'Brien")).toBe("'O''Brien'");
  });
});

describe("A1", () => {
  it("returns A1 address", () => {
    expect(utils.A1("b", 3)).toBe("B3");
  });
});

describe("ABS_ADDR", () => {
  it("returns absolute address", () => {
    expect(utils.ABS_ADDR("B", 3)).toBe("$B$3");
  });
});

describe("RANGE", () => {
  it("returns absolute range", () => {
    expect(utils.RANGE("B1", "B10")).toBe("$B$1:$B$10");
  });
});

describe("SHEET_RANGE", () => {
  it("returns sheet-qualified range", () => {
    expect(utils.SHEET_RANGE("My Sheet", "B1", "B10")).toBe("'My Sheet'!$B$1:$B$10");
  });
});

describe("LIST_FORMULA", () => {
  it("returns list formula", () => {
    expect(utils.LIST_FORMULA("My Sheet", "B", 1, 10)).toBe("='My Sheet'!$B$1:$B$10");
  });
});

describe("TODAY", () => {
  it("returns TODAY formula", () => {
    expect(utils.TODAY()).toBe("TODAY()");
  });
});

describe("DATE_NOT_BEFORE_TODAY", () => {
  it("returns date validation formula", () => {
    expect(utils.DATE_NOT_BEFORE_TODAY("A1", {})).toEqual("AND(ISNUMBER($A$1),$A$1>=TODAY())");
    expect(utils.DATE_NOT_BEFORE_TODAY("X4", { allowBlank: true })).toEqual(
      `OR(NOT(LEN(TRIM($X$4))>0),AND(ISNUMBER($X$4),$X$4>=TODAY()))`
    );
  });
});

describe("toYesNo", () => {
  it("returns Yes for true", () => {
    expect(utils.toYesNo(true)).toBe("Yes");
  });

  it("returns No for false", () => {
    expect(utils.toYesNo(false)).toBe("No");
  });

  it("returns null for null/undefined", () => {
    expect(utils.toYesNo(null)).toBeNull();
    expect(utils.toYesNo(undefined)).toBeNull();
  });
});

describe("isHyperlinkValue", () => {
  it("returns true for { text, hyperlink } shape", () => {
    const v: ExcelJS.CellHyperlinkValue = {
      text: "example@example.com",
      hyperlink: "mailto:example@example.com",
    };

    expect(utils.isHyperlinkValue(v)).toBe(true);
  });

  it("returns false for primitives and null", () => {
    expect(utils.isHyperlinkValue("hello" as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isHyperlinkValue(123 as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isHyperlinkValue(null as unknown as ExcelJS.CellValue)).toBe(false);
  });

  it("returns false for objects missing required keys", () => {
    const missingText = { hyperlink: "mailto:x@y.com" } as unknown as ExcelJS.CellValue;
    const missingLink = { text: "x@y.com" } as unknown as ExcelJS.CellValue;

    expect(utils.isHyperlinkValue(missingText)).toBe(false);
    expect(utils.isHyperlinkValue(missingLink)).toBe(false);
  });
});

describe("isFormulaValue", () => {
  it("returns true for { formula } shape (with/without result)", () => {
    const v1: ExcelJS.CellFormulaValue = { formula: "A1+B1" };
    const v2: ExcelJS.CellFormulaValue = {
      formula: "SUM(A1:A3)",
      result: 6,
    };

    expect(utils.isFormulaValue(v1)).toBe(true);
    expect(utils.isFormulaValue(v2)).toBe(true);
  });

  it("returns false for shared formula", () => {
    const v: ExcelJS.CellSharedFormulaValue = {
      sharedFormula: "A1",
      result: 1,
    };

    expect(utils.isFormulaValue(v)).toBe(false);
  });

  it("returns false for non-formula objects and primitives", () => {
    const hyperlink: ExcelJS.CellHyperlinkValue = { text: "x@y.com", hyperlink: "mailto:x@y.com" };

    expect(utils.isFormulaValue(hyperlink)).toBe(false);
    expect(utils.isFormulaValue("=A1" as unknown as ExcelJS.CellValue)).toBe(false);
  });
});

describe("isSharedFormulaValue", () => {
  it("returns true for { sharedFormula } shape (with/without result)", () => {
    const v1: ExcelJS.CellSharedFormulaValue = { sharedFormula: "A1" };
    const v2: ExcelJS.CellSharedFormulaValue = {
      sharedFormula: "B2",
      result: 42,
    };

    expect(utils.isSharedFormulaValue(v1)).toBe(true);
    expect(utils.isSharedFormulaValue(v2)).toBe(true);
  });

  it("returns false for regular formula", () => {
    const v: ExcelJS.CellFormulaValue = { formula: "A1+B1" };
    expect(utils.isSharedFormulaValue(v)).toBe(false);
  });

  it("returns false for other shapes", () => {
    expect(utils.isSharedFormulaValue({} as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isSharedFormulaValue("foo" as unknown as ExcelJS.CellValue)).toBe(false);
  });
});

describe("isRichTextValue", () => {
  it("returns true for { richText: Array<{ text: string }> }", () => {
    const v: ExcelJS.CellRichTextValue = { richText: [{ text: "Hello" }, { text: "World" }] };

    expect(utils.isRichTextValue(v)).toBe(true);
  });

  it("returns false when richText is not an array", () => {
    const bad = { richText: "Hello" } as unknown as ExcelJS.CellValue;

    expect(utils.isRichTextValue(bad)).toBe(false);
  });

  it("returns false for primitives and null", () => {
    expect(utils.isRichTextValue("Hello" as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isRichTextValue(null as unknown as ExcelJS.CellValue)).toBe(false);
  });
});

describe("isErrorValue", () => {
  it("returns true for { error } shape", () => {
    const v: ExcelJS.CellErrorValue = { error: "#DIV/0!" };

    expect(utils.isErrorValue(v)).toBe(true);
  });

  it("returns false for non-error values", () => {
    const date = new Date();

    expect(utils.isErrorValue(date as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isErrorValue({} as unknown as ExcelJS.CellValue)).toBe(false);
    expect(utils.isErrorValue("error" as unknown as ExcelJS.CellValue)).toBe(false);
  });
});

describe("PHS_OK", () => {
  it("returns a valid OR-of-ANDs formula string for a cell reference", () => {
    const formula = utils.PHS_OK("A1");

    expect(typeof formula).toBe("string");
    expect(formula.includes("OR(")).toBe(true);

    const andCount = (formula.match(/AND\(/g) || []).length;
    expect(andCount).toBe(3);

    [
      "TRIM(",
      'FIND(".p"',
      "IFERROR(",
      "ISNUMBER",
      "VALUE(",
      "LEFT(",
      "RIGHT(",
      "MID(",
      "LEN(",
      '".v"',
    ].forEach((token) => expect(formula).toContain(token));
  });

  it("wraps the incoming ref with TRIM(CELL(...)) semantics", () => {
    const f1 = utils.PHS_OK("A1");
    const f2 = utils.PHS_OK("  A1  ");
    expect(f1).toContain("TRIM(");
    expect(f2).toContain("TRIM(");
  });

  it("produces a formula fragment (no leading '=') suitable for data validation", () => {
    const formula = utils.PHS_OK("A1");
    expect(formula.trim().startsWith("=")).toBe(false);
  });

  it("returns the exact expected formula for A1", () => {
    const actual = utils.PHS_OK("A1");

    const expected =
      "OR(" +
      "AND(" +
      "LEN(TRIM($A$1))=9," +
      'LEFT(TRIM($A$1),3)="phs",' +
      "IFERROR(ISNUMBER(VALUE(RIGHT(TRIM($A$1),6))),FALSE)" +
      ")," +
      "AND(" +
      'LEFT(TRIM($A$1),3)="phs",' +
      "IFERROR(ISNUMBER(VALUE(MID(TRIM($A$1),4,6))),FALSE)," +
      'LOWER(MID(TRIM($A$1),10,2))=".v",' +
      "LEN(TRIM($A$1))>11," +
      "IFERROR(ISNUMBER(VALUE(MID(TRIM($A$1),12,LEN(TRIM($A$1))-11))),FALSE)," +
      'NOT(IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)>0)' +
      ")," +
      "AND(" +
      'LEFT(TRIM($A$1),3)="phs",' +
      "IFERROR(ISNUMBER(VALUE(MID(TRIM($A$1),4,6))),FALSE)," +
      'LOWER(MID(TRIM($A$1),10,2))=".v",' +
      'IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)>12,' +
      'IFERROR(ISNUMBER(VALUE(MID(TRIM($A$1),12,IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)-12))),FALSE),' +
      'LOWER(IFERROR(MID(TRIM($A$1),IFERROR(FIND(".p",LOWER(TRIM($A$1))),0),2),""))=".p",' +
      'LEN(TRIM($A$1))>IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)+1,' +
      'IFERROR(ISNUMBER(VALUE(MID(TRIM($A$1),IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)+2,LEN(TRIM($A$1))-IFERROR(FIND(".p",LOWER(TRIM($A$1))),0)))),FALSE)' +
      ")" +
      ")";

    const normalize = (s: string) => s.replace(/\s+/g, "");
    expect(normalize(actual)).toBe(normalize(expected));
  });
});
