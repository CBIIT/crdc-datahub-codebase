import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "./logger.ts";

describe("Logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:34:56.789Z"));
    process.env.NODE_ENV = "development";
    consoleErrorSpy = vi.spyOn(globalThis.console, "error").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(globalThis.console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(globalThis.console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("logs error messages with the expected format", () => {
    Logger.error("Test error message");

    expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] [2026-02-10T12:34:56.789Z] Test error message");
  });

  it("logs info messages with the expected format and style", () => {
    Logger.info("Test INFO message");

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "%c[INFO] [2026-02-10T12:34:56.789Z] Test INFO message",
      "color: #90D5FF;"
    );
  });

  it("passes through additional parameters for error logs", () => {
    Logger.error("Test error message", "Additional parameter", { detail: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ERROR] [2026-02-10T12:34:56.789Z] Test error message",
      "Additional parameter",
      { detail: true }
    );
  });

  it("passes through additional parameters for info logs", () => {
    Logger.info("Test INFO message", 123);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "%c[INFO] [2026-02-10T12:34:56.789Z] Test INFO message",
      "color: #90D5FF;",
      123
    );
  });

  it("logs warn messages with the expected format and style", () => {
    Logger.warn("Test WARN message");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "%c[WARN] [2026-02-10T12:34:56.789Z] Test WARN message",
      "color: #FFD700;"
    );
  });

  it("passes through additional parameters for warn logs", () => {
    Logger.warn("Test WARN message", false, { detail: "warning" });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "%c[WARN] [2026-02-10T12:34:56.789Z] Test WARN message",
      "color: #FFD700;",
      false,
      { detail: "warning" }
    );
  });

  it('skips logging when NODE_ENV is "test"', () => {
    process.env.NODE_ENV = "test";

    Logger.error("Test error message");
    Logger.info("Test INFO message");
    Logger.warn("Test WARN message");

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
