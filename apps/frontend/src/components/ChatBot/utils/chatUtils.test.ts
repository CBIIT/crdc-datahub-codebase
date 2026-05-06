import { beforeEach, describe, expect, it, vi } from "vitest";

import * as utils from "./chatUtils";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

describe("getViewportHeightPx", () => {
  it("should return window.innerHeight when window is available", () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const result = utils.getViewportHeightPx(500);

    expect(result).toBe(1024);

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("should return fallback value when different window height is set", () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });

    const result = utils.getViewportHeightPx(500);

    expect(result).toBe(768);

    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it("should return fallback value when window is undefined", () => {
    const originalWindow = global.window;
    delete global.window;

    const result = utils.getViewportHeightPx(500);

    expect(result).toBe(500);

    global.window = originalWindow;
  });
});

describe("isAbortError", () => {
  it("should return true for AbortError", () => {
    const error = new Error("Aborted");
    error.name = "AbortError";

    const result = utils.isAbortError(error);

    expect(result).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("Regular error");

    const result = utils.isAbortError(error);

    expect(result).toBe(false);
  });

  it("should return false for non-Error objects", () => {
    const notError = { name: "AbortError" };

    const result = utils.isAbortError(notError);

    expect(result).toBe(false);
  });

  it("should return false for null", () => {
    const result = utils.isAbortError(null);

    expect(result).toBe(false);
  });

  it("should return false for undefined", () => {
    const result = utils.isAbortError(undefined);

    expect(result).toBe(false);
  });

  it("should return false for string", () => {
    const result = utils.isAbortError("AbortError");

    expect(result).toBe(false);
  });

  it("should return false for TypeError", () => {
    const error = new TypeError("Type error");

    const result = utils.isAbortError(error);

    expect(result).toBe(false);
  });
});

describe("createId", () => {
  it("should create ID with prefix and UUID", () => {
    const result = utils.createId("test_");

    expect(result).toBe("test_mock-uuid-1234");
  });

  it("should create ID with different prefix", () => {
    const result = utils.createId("message_");

    expect(result).toBe("message_mock-uuid-1234");
  });

  it("should create ID with empty prefix", () => {
    const result = utils.createId("");

    expect(result).toBe("mock-uuid-1234");
  });

  it("should create IDs with UUID format", () => {
    const result1 = utils.createId("id_");
    const result2 = utils.createId("id_");

    expect(result1).toContain("id_");
    expect(result2).toContain("id_");
    expect(result1).toContain("mock-uuid-1234");
  });
});

describe("createChatMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create message with required fields", () => {
    const result = utils.createChatMessage({
      text: "Hello world",
      sender: "user",
      senderName: "John Doe",
    });

    expect(result).toMatchObject({
      text: "Hello world",
      sender: "user",
      senderName: "John Doe",
      variant: "default",
    });
    expect(result.id).toContain("chat_msg_");
    expect(result.timestamp).toEqual(new Date("2024-01-15T10:30:00Z"));
  });

  it("should create message with custom variant", () => {
    const result = utils.createChatMessage({
      text: "Error occurred",
      sender: "bot",
      senderName: "Support Bot",
      variant: "error",
    });

    expect(result.variant).toBe("error");
  });

  it("should create message with info variant", () => {
    const result = utils.createChatMessage({
      text: "Information",
      sender: "bot",
      senderName: "Support Bot",
      variant: "info",
    });

    expect(result.variant).toBe("info");
  });

  it("should create message with custom id", () => {
    const result = utils.createChatMessage({
      text: "Custom message",
      sender: "user",
      senderName: "Jane Doe",
      id: "custom-id-123",
    });

    expect(result.id).toBe("custom-id-123");
  });

  it("should generate unique id when not provided", () => {
    const result = utils.createChatMessage({
      text: "Auto ID message",
      sender: "bot",
      senderName: "Bot",
    });

    expect(result.id).toContain("chat_msg_mock-uuid-1234");
  });

  it("should create message with bot sender", () => {
    const result = utils.createChatMessage({
      text: "Bot response",
      sender: "bot",
      senderName: "Support Bot",
    });

    expect(result.sender).toBe("bot");
    expect(result.senderName).toBe("Support Bot");
  });

  it("should create message with user sender", () => {
    const result = utils.createChatMessage({
      text: "User question",
      sender: "user",
      senderName: "User Name",
    });

    expect(result.sender).toBe("user");
    expect(result.senderName).toBe("User Name");
  });

  it("should set timestamp to current time", () => {
    const result = utils.createChatMessage({
      text: "Timestamp test",
      sender: "user",
      senderName: "Test User",
    });

    expect(result.timestamp).toEqual(new Date("2024-01-15T10:30:00Z"));
  });

  it("should create different timestamps for messages at different times", () => {
    const result1 = utils.createChatMessage({
      text: "First message",
      sender: "user",
      senderName: "User",
    });

    vi.setSystemTime(new Date("2024-01-15T10:31:00Z"));

    const result2 = utils.createChatMessage({
      text: "Second message",
      sender: "user",
      senderName: "User",
    });

    expect(result1.timestamp).toEqual(new Date("2024-01-15T10:30:00Z"));
    expect(result2.timestamp).toEqual(new Date("2024-01-15T10:31:00Z"));
  });
});
