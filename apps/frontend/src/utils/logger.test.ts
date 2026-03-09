import env from "../env";

import { Logger } from "./logger";

describe("Logger", () => {
  const originalEnv = process.env;

  let consoleErrorSpy;

  beforeEach(() => {
    // Reset the environment variables back to their original values
    process.env = { ...originalEnv };

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("should log with the correct output format", () => {
    env.NODE_ENV = "development"; // Override 'test' to log the message

    Logger.error("Test error message");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[ERROR\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test error message/
      )
    );
  });

  it("should support logging error levels", () => {
    env.NODE_ENV = "development"; // Override 'test' to log the message

    Logger.error("Test ERROR message");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[ERROR\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test ERROR message/
      )
    );
  });

  it("should support logging info levels", () => {
    env.NODE_ENV = "development"; // Override 'test' to log the message
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    Logger.info("Test INFO message");

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /%c\[INFO\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test INFO message/
      ),
      "color: #90D5FF;"
    );
  });

  it("should support logging additional parameters", () => {
    env.NODE_ENV = "development"; // Override 'test' to log the message

    Logger.error("Test error message", "Additional parameter");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[ERROR\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test error message/
      ),
      "Additional parameter"
    );
  });

  it("should support logging Error objects", () => {
    env.NODE_ENV = "development"; // Override 'test' to log the message

    Logger.error("Test error message", new Error("Test error"));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /\[ERROR\] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Test error message/
      ),
      expect.any(Error)
    );
  });

  it('should not log anything if NODE_ENV is "test"', () => {
    env.NODE_ENV = "test"; // This is the default value, but explicitly setting it here just in case

    Logger.error("Test error message");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it.each<AppEnv["VITE_DEV_TIER"]>(["stage", "prod"])(
    "should not log on the upper tier '%s'",
    (tier) => {
      env.NODE_ENV = "development"; // Override 'test' to log the message

      env.VITE_DEV_TIER = tier;

      Logger.error("A message that should not be visible");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    }
  );
});
