import { chatMessageFactory } from "@/test-utils/factories/chatbot/ChatMessageFactory";
import { Logger } from "@/utils";

import * as utils from "./conversationStorageUtils";

vi.mock("@/utils", () => ({
  Logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const createMockIndexedDB = () => {
  let store: Record<string, unknown> = {};

  const mockObjectStore = {
    add: vi.fn((item: unknown) => {
      const itemWithId = item as { id: string };
      store[itemWithId.id] = item;
      return { onsuccess: null, onerror: null };
    }),
    clear: vi.fn(() => {
      store = {};
      return { onsuccess: null, onerror: null };
    }),
    getAll: vi.fn(() => {
      const request = {
        result: Object.values(store),
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
  };

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
    oncomplete: null,
    onerror: null,
  };

  const mockDb = {
    transaction: vi.fn(() => {
      setTimeout(() => mockTransaction.oncomplete?.(), 0);
      return mockTransaction;
    }),
    createObjectStore: vi.fn(),
    objectStoreNames: { contains: vi.fn(() => false) },
    close: vi.fn(),
  };

  const mockRequest = {
    result: mockDb,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  const mockIndexedDB = {
    open: vi.fn(() => {
      setTimeout(() => {
        mockRequest.onupgradeneeded?.({ target: { result: mockDb } });
        mockRequest.onsuccess?.();
      }, 0);
      return mockRequest;
    }),
  };

  return {
    mockIndexedDB,
    mockDb,
    mockTransaction,
    mockObjectStore,
    store,
    clearStore: () => {
      store = {};
    },
  };
};

describe("storeConversationMessages", () => {
  let mockIDB: ReturnType<typeof createMockIndexedDB>;
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockIDB = createMockIndexedDB();
    globalThis.indexedDB = mockIDB.mockIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
  });

  it("should store messages in IndexedDB", async () => {
    const messages = [
      chatMessageFactory.build({ id: "msg-1" }),
      chatMessageFactory.build({ id: "msg-2" }),
    ];

    await utils.storeConversationMessages(messages);

    expect(mockIDB.mockIndexedDB.open).toHaveBeenCalledWith("chatbot_conversation_db", 1);
    expect(mockIDB.mockObjectStore.clear).toHaveBeenCalled();
    expect(mockIDB.mockObjectStore.add).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("chatbot_conversation_session")).toBe("active");
  });

  it("should mark session as active when storing messages", async () => {
    const messages = [chatMessageFactory.build()];

    await utils.storeConversationMessages(messages);

    expect(sessionStorage.getItem("chatbot_conversation_session")).toBe("active");
  });

  it("should handle errors gracefully", async () => {
    globalThis.indexedDB = {
      open: vi.fn(() => {
        const request = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      }),
    } as unknown as IDBFactory;

    await utils.storeConversationMessages([chatMessageFactory.build()]);

    expect(Logger.error).toHaveBeenCalled();
  });

  it("should close db and log error when transaction fails", async () => {
    mockIDB.mockDb.transaction = vi.fn(() => {
      setTimeout(() => mockIDB.mockTransaction.onerror?.(), 0);
      return mockIDB.mockTransaction;
    });

    await utils.storeConversationMessages([chatMessageFactory.build()]);

    expect(mockIDB.mockDb.close).toHaveBeenCalled();
    expect(Logger.error).toHaveBeenCalledWith(
      "conversationStorageUtils: Failed to store conversation messages in IndexedDB",
      expect.any(Error)
    );
  });

  it("should log error when markSessionActive fails", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage error");
    });

    await utils.storeConversationMessages([chatMessageFactory.build()]);

    expect(Logger.error).toHaveBeenCalledWith(
      "conversationStorageUtils: Failed to mark session as active in sessionStorage"
    );

    setItemSpy.mockRestore();
  });
});

describe("getStoredConversationMessages", () => {
  let mockIDB: ReturnType<typeof createMockIndexedDB>;
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockIDB = createMockIndexedDB();
    globalThis.indexedDB = mockIDB.mockIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
  });

  it("should return empty array if session is not active", async () => {
    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);
  });

  it("should retrieve messages when session is active", async () => {
    sessionStorage.setItem("chatbot_conversation_session", "active");

    const storedMessage = chatMessageFactory.build({
      id: "msg-1",
      text: "Test",
      sender: "user",
      timestamp: new Date("2026-01-01T12:00:00.000Z"),
      senderName: "User",
      variant: "default",
    });

    mockIDB.mockObjectStore.getAll = vi.fn(() => {
      const request = {
        result: [storedMessage],
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    });

    const result = await utils.getStoredConversationMessages();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg-1");
    expect(result[0].timestamp).toBeInstanceOf(Date);
  });

  it("should clear messages and return empty array when session is invalid", async () => {
    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);
  });

  it("should handle errors gracefully and return empty array", async () => {
    sessionStorage.setItem("chatbot_conversation_session", "active");
    globalThis.indexedDB = {
      open: vi.fn(() => {
        const request = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      }),
    } as unknown as IDBFactory;

    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);
    expect(Logger.error).toHaveBeenCalled();
  });

  it("should clear stored messages when browser session ends", async () => {
    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);
  });

  it("should close db and log error when request fails", async () => {
    sessionStorage.setItem("chatbot_conversation_session", "active");

    mockIDB.mockObjectStore.getAll = vi.fn(() => {
      const request = {
        result: [],
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => request.onerror?.(), 0);
      return request;
    });

    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);
    expect(mockIDB.mockDb.close).toHaveBeenCalled();
    expect(Logger.error).toHaveBeenCalledWith(
      "conversationStorageUtils: Failed to retrieve conversation messages from IndexedDB",
      expect.any(Error)
    );
  });

  it("should return false and empty array when sessionStorage.getItem throws", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage error");
    });

    const result = await utils.getStoredConversationMessages();

    expect(result).toEqual([]);

    getItemSpy.mockRestore();
  });
});

describe("clearConversationMessages", () => {
  let mockIDB: ReturnType<typeof createMockIndexedDB>;
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockIDB = createMockIndexedDB();
    globalThis.indexedDB = mockIDB.mockIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
  });

  it("should clear all messages from IndexedDB", async () => {
    sessionStorage.setItem("chatbot_conversation_session", "active");

    await utils.clearConversationMessages();

    expect(mockIDB.mockObjectStore.clear).toHaveBeenCalled();
    expect(sessionStorage.getItem("chatbot_conversation_session")).toBeNull();
  });

  it("should clear session marker", async () => {
    sessionStorage.setItem("chatbot_conversation_session", "active");

    await utils.clearConversationMessages();

    expect(sessionStorage.getItem("chatbot_conversation_session")).toBeNull();
  });

  it("should handle errors gracefully", async () => {
    globalThis.indexedDB = {
      open: vi.fn(() => {
        const request = {
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
        };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      }),
    } as unknown as IDBFactory;

    await utils.clearConversationMessages();

    expect(Logger.error).toHaveBeenCalled();
  });

  it("should close db and log error when transaction fails", async () => {
    mockIDB.mockDb.transaction = vi.fn(() => {
      setTimeout(() => mockIDB.mockTransaction.onerror?.(), 0);
      return mockIDB.mockTransaction;
    });

    await utils.clearConversationMessages();

    expect(mockIDB.mockDb.close).toHaveBeenCalled();
    expect(Logger.error).toHaveBeenCalledWith(
      "conversationStorageUtils: Failed to clear conversation messages from IndexedDB",
      expect.any(Error)
    );
  });

  it("should log error when clearSessionKey fails", async () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage error");
    });

    await utils.clearConversationMessages();

    expect(Logger.error).toHaveBeenCalledWith(
      "conversationStorageUtils: Failed to clear session key from sessionStorage"
    );

    removeItemSpy.mockRestore();
  });
});
