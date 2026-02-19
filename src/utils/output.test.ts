import { describe, expect, it } from "vitest";
import { generateCitationEvent, generatePulseEvent } from "./output.ts";

describe("generatePulseEvent", () => {
  it("returns a pulse event with the provided description", () => {
    const result = generatePulseEvent("Processing request");

    expect(result).toEqual({
      type: "pulse",
      description: "Processing request",
    });
  });

  it("returns a new object for each call", () => {
    const first = generatePulseEvent("First");
    const second = generatePulseEvent("Second");

    expect(first).not.toBe(second);
  });
});

describe("generateCitationEvent", () => {
  it("returns a citations event with the provided citations", () => {
    const citations = [
      { documentName: "Doc A", documentLink: "https://example.com/doc-a" },
      { documentName: "Doc B", documentLink: null },
    ];

    const result = generateCitationEvent(citations);

    expect(result).toEqual({
      type: "citations",
      citations,
    });
  });

  it("returns a new object for each call", () => {
    const citations = [{ documentName: "Doc A", documentLink: null }];

    const first = generateCitationEvent(citations);
    const second = generateCitationEvent(citations);

    expect(first).not.toBe(second);
  });
});
