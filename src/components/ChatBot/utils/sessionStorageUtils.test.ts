import { Logger } from "@/utils";

import * as utils from "./sessionStorageUtils";

vi.mock("@/utils", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

describe("getStoredSessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("should return session ID when stored", () => {
    sessionStorage.setItem("chatbot_session_id", "test-session");
    expect(utils.getStoredSessionId()).toBe("test-session");
  });

  it("should return null when no session ID is stored", () => {
    expect(utils.getStoredSessionId()).toBeNull();
  });

  it("should return null when sessionStorage throws error", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage error");
    });
    expect(utils.getStoredSessionId()).toBeNull();
    expect(Logger.error).toHaveBeenCalledWith("Failed to retrieve session ID from session storage");
    spy.mockRestore();
  });
});

describe("storeSessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("should store session ID in sessionStorage", () => {
    utils.storeSessionId("new-session");
    expect(sessionStorage.getItem("chatbot_session_id")).toBe("new-session");
  });

  it("should log error when sessionStorage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage error");
    });

    utils.storeSessionId("session-id");
    expect(Logger.error).toHaveBeenCalledWith("Failed to store session ID in session storage");
    spy.mockRestore();
  });
});

describe("clearStoredSessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("should remove session ID from sessionStorage", () => {
    sessionStorage.setItem("chatbot_session_id", "test-session");
    utils.clearStoredSessionId();
    expect(sessionStorage.getItem("chatbot_session_id")).toBeNull();
  });

  it("should log error when sessionStorage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage error");
    });

    utils.clearStoredSessionId();
    expect(Logger.error).toHaveBeenCalledWith("Failed to clear session ID from session storage");
    spy.mockRestore();
  });
});
