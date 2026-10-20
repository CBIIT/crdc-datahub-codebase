import * as utils from "./dateUtils";

describe("secondsToMinuteString utility function", () => {
  it.each<[number, string]>([
    [0, "00:00"],
    [59, "00:59"],
    [60, "01:00"],
    [61, "01:01"],
    [119, "01:59"],
    [120, "02:00"],
    [121, "02:01"],
    [300, "05:00"],
    [3599, "59:59"],
  ])("should handle format %p seconds to %p", (seconds, expected) => {
    expect(utils.secondsToMinuteString(seconds)).toBe(expected);
  });
});

describe("formatMessageTime utility function", () => {
  it.each<[string, string]>([
    ["2024-01-15T09:15:00", "09:15 AM"],
    ["2024-01-15T15:45:00", "03:45 PM"],
    ["2024-01-15T00:00:00", "12:00 AM"],
    ["2024-01-15T12:00:00", "12:00 PM"],
  ])("should format %p as %p", (date, expected) => {
    expect(utils.formatMessageTime(new Date(date))).toBe(expected);
  });
});

describe("formatMessageDate utility function", () => {
  it("should format the date with the full month name", () => {
    expect(utils.formatMessageDate(new Date("2026-02-19T10:00:00"))).toBe("February 19, 2026");
  });
});
