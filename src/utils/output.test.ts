import { describe, expect, it } from "vitest";
import { GenerateEvent } from "./output.ts";

describe("GenerateEvent", () => {
  it("returns a pulse event with the provided description", () => {
    const result = GenerateEvent("Processing request");

    expect(result).toEqual({
      type: "pulse",
      description: "Processing request",
    });
  });

  it("returns a new object for each call", () => {
    const first = GenerateEvent("First");
    const second = GenerateEvent("Second");

    expect(first).not.toBe(second);
  });
});
