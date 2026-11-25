const {
  escapeRegexLiteral,
  sanitizeMongoDBInput,
  sanitizeTierName,
} = require("../../utility/string-util");

describe("escapeRegexLiteral", () => {
  it("escapes regex metacharacters for literal substring match", () => {
    expect(escapeRegexLiteral("*")).toBe("\\*");
    expect(escapeRegexLiteral("***")).toBe("\\*\\*\\*");
    expect(escapeRegexLiteral("foo*bar")).toBe("foo\\*bar");
    expect(escapeRegexLiteral("a+b")).toBe("a\\+b");
    expect(escapeRegexLiteral("(test)")).toBe("\\(test\\)");
  });

  it("leaves alphanumeric text unchanged", () => {
    expect(escapeRegexLiteral("phs001234")).toBe("phs001234");
    expect(escapeRegexLiteral("test study")).toBe("test study");
  });

  it("handles null and undefined", () => {
    expect(escapeRegexLiteral(null)).toBe("");
    expect(escapeRegexLiteral(undefined)).toBe("");
  });
});

describe("sanitizeMongoDBInput", () => {
  it("still trims and handles dot-only input", () => {
    expect(sanitizeMongoDBInput("  x  ")).toBe("x");
    expect(sanitizeMongoDBInput("...")).toBe("''");
  });
});

describe("sanitizeTierName", () => {

  const testCases = [
    { tier: "dev", expected: "dev" },
    { tier: "QA", expected: "qa" },
    { tier: "dev-2", expected: "dev2" },
    { tier: " Stage ", expected: "stage" },
    { tier: "--", expected: null },
    { tier: "", expected: null },
    { tier: undefined, expected: null },
    { tier: null, expected: null },
    { tier: 123, expected: null },
  ];
  
  it.each(testCases)("should return $expected for $tier", ({ tier, expected }) => {
    expect(sanitizeTierName(tier)).toBe(expected);
  });
});
