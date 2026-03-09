import { describe, expect, it } from "vitest";
import { safeParseJSON } from "./json.ts";

describe("safeParseJSON", () => {
  it("returns parsed object for valid JSON", () => {
    const result = safeParseJSON<{ name: string }>('{"name":"Ada"}');
    expect(result).toEqual({ name: "Ada" });
  });

  it("returns null for invalid JSON", () => {
    const result = safeParseJSON("{invalid json");
    expect(result).toBeNull();
  });
});
