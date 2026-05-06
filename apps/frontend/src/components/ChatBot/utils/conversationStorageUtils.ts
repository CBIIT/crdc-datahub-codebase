import { Logger } from "@/utils";

const DB_NAME = "chatbot_conversation_db";
const DB_VERSION = 1;
const STORE_NAME = "messages";
const SESSION_KEY = "chatbot_conversation_session";

/**
 * Checks if the current session is valid by verifying the session key in sessionStorage.
 *
 * @returns {boolean} True if the session is valid, false otherwise.
 */
const isSessionValid = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "active";
  } catch {
    return false;
  }
};

/**
 * Marks the current session as active in sessionStorage.
 */
const markSessionActive = (): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, "active");
  } catch {
    Logger.error("conversationStorageUtils: Failed to mark session as active in sessionStorage");
  }
};

/**
 * Clears the session key from sessionStorage.
 */
const clearSessionKey = (): void => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    Logger.error("conversationStorageUtils: Failed to clear session key from sessionStorage");
  }
};

/**
 * Opens the IndexedDB database, creating the object store if needed.
 *
 * @returns {Promise<IDBDatabase>} The opened database instance.
 */
const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    // When a new version number higher than its current version is passed, it will create a new object store
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });

/**
 * Stores all conversation messages in IndexedDB.
 *
 * @param {ChatMessage[]} messages - The messages to store.
 * @returns {Promise<void>}
 */
export const storeConversationMessages = async (messages: ChatMessage[]): Promise<void> => {
  try {
    markSessionActive();
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.clear();
    messages.forEach((message) => {
      store.add(message);
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(new Error("Failed to store conversation messages"));
      };
    });
  } catch (error) {
    Logger.error(
      "conversationStorageUtils: Failed to store conversation messages in IndexedDB",
      error
    );
  }
};

/**
 * Retrieves all stored conversation messages from IndexedDB.
 *
 * @returns {Promise<ChatMessage[]>} The stored messages, or empty array.
 */
export const getStoredConversationMessages = async (): Promise<ChatMessage[]> => {
  try {
    if (!isSessionValid()) {
      await clearConversationMessages();
      return [];
    }

    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    return await new Promise<ChatMessage[]>((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const messages: ChatMessage[] = request.result;
        messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        resolve(messages);
      };
      request.onerror = () => {
        db.close();
        reject(new Error("Failed to retrieve conversation messages"));
      };
    });
  } catch (error) {
    Logger.error(
      "conversationStorageUtils: Failed to retrieve conversation messages from IndexedDB",
      error
    );
    return [];
  }
};

/**
 * Clears all stored conversation messages from IndexedDB.
 *
 * @returns {Promise<void>}
 */
export const clearConversationMessages = async (): Promise<void> => {
  try {
    clearSessionKey();

    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(new Error("Failed to clear conversation messages"));
      };
    });
  } catch (error) {
    Logger.error(
      "conversationStorageUtils: Failed to clear conversation messages from IndexedDB",
      error
    );
  }
};
