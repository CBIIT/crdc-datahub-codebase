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
