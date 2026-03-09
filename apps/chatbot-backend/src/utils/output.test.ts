import { describe, expect, it } from "vitest";
import {
  generateCitationEvent,
  generateErrorEvent,
  generatePulseEvent,
  generateResponseEvent,
  generateSessionEvent,
} from "./output.ts";

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

describe("generateSessionEvent", () => {
  it("returns a session event with the provided session ID", () => {
    const sessionId = "c42e2bfb-3d88-4f40-a107-52b75c9f0922";

    const result = generateSessionEvent(sessionId);

    expect(result).toEqual({
      type: "session",
      sessionId,
    });
  });

  it("returns a new object for each call", () => {
    const sessionId = "c42e2bfb-3d88-4f40-a107-52b75c9f0922";

    const first = generateSessionEvent(sessionId);
    const second = generateSessionEvent(sessionId);

    expect(first).not.toBe(second);
  });
});

describe("generateResponseEvent", () => {
  it("returns a response event with the provided output", () => {
    const output = "Here is a generated response.";

    const result = generateResponseEvent(output);

    expect(result).toEqual({
      type: "response",
      output,
    });
  });

  it("returns a new object for each call", () => {
    const output = "Chunk";

    const first = generateResponseEvent(output);
    const second = generateResponseEvent(output);

    expect(first).not.toBe(second);
  });
});

describe("generateErrorEvent", () => {
  it("returns an error event with the provided message", () => {
    const message = "Unable to complete request";

    const result = generateErrorEvent(message);

    expect(result).toEqual({
      type: "error",
      message,
    });
  });

  it("returns a new object for each call", () => {
    const message = "Unable to complete request";

    const first = generateErrorEvent(message);
    const second = generateErrorEvent(message);

    expect(first).not.toBe(second);
  });
});
