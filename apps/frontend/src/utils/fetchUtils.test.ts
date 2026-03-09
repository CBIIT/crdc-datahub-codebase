import * as utils from "./fetchUtils";

describe("fetchReleaseNotes", () => {
  const mockReleaseNotes = "# Release Notes\n\n- Feature 1\n- Feature 2";

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("should successfully handle fetching of release notes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockReleaseNotes),
    });

    expect(await utils.fetchReleaseNotes()).toBe(mockReleaseNotes);
  });

  it("should cache successful responses in sessionStorage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockReleaseNotes),
    });

    expect(sessionStorage.getItem("releaseNotes")).toBeNull();

    await utils.fetchReleaseNotes();

    expect(sessionStorage.getItem("releaseNotes")).toBe(mockReleaseNotes);
  });

  it("should return cached release notes from sessionStorage", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    sessionStorage.setItem("releaseNotes", mockReleaseNotes);

    const result = await utils.fetchReleaseNotes();

    expect(result).toBe(mockReleaseNotes);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should forward fetch errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Test network error"));

    await expect(utils.fetchReleaseNotes()).rejects.toThrow("Test network error");
  });

  it("should handle non-200 HTTP responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(utils.fetchReleaseNotes()).rejects.toThrow(
      "Failed to fetch release notes: HTTP Error 404"
    );
  });

  it("should handle an empty release notes document", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });

    await expect(utils.fetchReleaseNotes()).rejects.toThrow("Release notes document is empty.");
  });

  it("should  handle an error thrown while retrieving the response text", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockRejectedValue(new Error("some mock text error")),
    });

    await expect(utils.fetchReleaseNotes()).rejects.toThrow("some mock text error");
  });
});

describe("authenticationLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully handle a successful logout request (API)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: true }),
    });

    expect(await utils.authenticationLogout()).toBe(true);
  });

  it("should handle a failed logout request (API)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: false }),
    });

    expect(await utils.authenticationLogout()).toBe(false);
  });

  it("should handle a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Test network error"));

    await expect(utils.authenticationLogout()).resolves.toBe(false);
  });

  it("should handle an abort error", async () => {
    global.fetch = vi.fn().mockRejectedValue({ name: "AbortError" });

    await expect(utils.authenticationLogout()).resolves.toBe(false);
  });

  it("should handle a json promise rejection", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error("Test json error")),
    });

    await expect(utils.authenticationLogout()).resolves.toBe(false);
  });
});

describe("authenticationLogin", () => {
  it("should successfully handle a successful login request (API)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ timeout: 1000, error: undefined }),
    });

    expect(await utils.authenticationLogin("test-code")).toEqual({
      success: true,
      error: undefined,
    });
  });

  it("should handle a failed login request (API)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ timeout: null, error: "Test login error" }),
    });

    expect(await utils.authenticationLogin("test-code")).toEqual({
      success: false,
      error: "Test login error",
    });
  });

  it("should handle a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Test network error"));

    await expect(utils.authenticationLogin("test-code")).resolves.toEqual({
      success: false,
      error: "An unknown error occurred during login.",
    });
  });

  it("should short-circuit on an abort signal", async () => {
    const abortController = new AbortController();
    const { signal } = abortController;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "AbortError")); // Simulate an abort error

    abortController.abort(); // Mark the signal was aborted so signal.aborted is true

    await expect(utils.authenticationLogin("test-code", signal)).resolves.toEqual({
      success: false,
      error: undefined,
    });
  });

  it("should handle failed json parsing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error("Test json error")),
    });

    await expect(utils.authenticationLogin("test-code")).resolves.toEqual({
      success: false,
      error: "An unknown error occurred during login.",
    });
  });
});

describe("fetchAllData", () => {
  type MockDT = { id: number; value: string };
  type MockQR = { items: MockDT[]; total: number };
  type MockQI = { filter?: string; first: number; offset: number };

  it("should fetch all data across multiple pages", async () => {
    const mockQuery = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: 1, value: "Item 1" },
            { id: 2, value: "Item 2" },
            { id: 3, value: "Item 3" },
          ],
          total: 5,
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: 4, value: "Item 4" },
            { id: 5, value: "Item 5" },
          ],
          total: 5,
        },
        error: undefined,
      });

    const getDataPath = (data: MockQR) => data.items;
    const totalPath = (data: MockQR) => data.total;

    const result = await utils.fetchAllData<MockQR, MockQI, MockDT>(
      mockQuery,
      {},
      getDataPath,
      totalPath,
      { pageSize: 3 } // NOTE: Explicitly set page size to 3 so the query is called x2
    );

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: 1, value: "Item 1" },
      { id: 2, value: "Item 2" },
      { id: 3, value: "Item 3" },
      { id: 4, value: "Item 4" },
      { id: 5, value: "Item 5" },
    ]);
  });

  it("should fetch all data in a single page", async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      data: {
        items: [
          { id: 1, value: "Item 1" },
          { id: 2, value: "Item 2" },
        ],
        total: 2,
      },
      error: undefined,
    });

    const getDataPath = (data: MockQR) => data.items;
    const totalPath = (data: MockQR) => data.total;

    const result = await utils.fetchAllData<MockQR, MockQI, MockDT>(
      mockQuery,
      {},
      getDataPath,
      totalPath
    );

    expect(result).toEqual([
      { id: 1, value: "Item 1" },
      { id: 2, value: "Item 2" },
    ]);
  });

  it("should fallback to the default page size if not provided", async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 1, value: "Item 1" }],
        total: 1,
      },
      error: undefined,
    });

    const getDataPath = (data: MockQR) => data.items;
    const totalPath = (data: MockQR) => data.total;

    await utils.fetchAllData<MockQR, MockQI, MockDT>(mockQuery, {}, getDataPath, totalPath, {
      pageSize: undefined,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ first: 1000 }),
      })
    );
  });

  it("should forward the input parameters to the query", async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 1, value: "Item 1" }],
        total: 1,
      },
      error: undefined,
    });

    const getDataPath = (data: MockQR) => data.items;
    const totalPath = (data: MockQR) => data.total;

    const inputParams = { filter: "test-filter" };

    await utils.fetchAllData<MockQR, MockQI, MockDT>(
      mockQuery,
      inputParams,
      getDataPath,
      totalPath
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining(inputParams),
      })
    );
  });

  it("should call the getDataPath and totalPath functions correctly", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      data: {
        items: [{ id: 1, value: "Item 1" }],
        total: 1,
      },
      error: undefined,
    });

    const mockGetDataPath = vi.fn((data: MockQR) => data.items);
    const mockTotalPath = vi.fn((data: MockQR) => data.total);

    await utils.fetchAllData<MockQR, MockQI, MockDT>(mockQuery, {}, mockGetDataPath, mockTotalPath);

    expect(mockGetDataPath).toHaveBeenCalledWith({
      items: [{ id: 1, value: "Item 1" }],
      total: 1,
    });

    expect(mockTotalPath).toHaveBeenCalledWith({
      items: [{ id: 1, value: "Item 1" }],
      total: 1,
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-array-constructor
  it.each([undefined, null, new Array(), {}, ""])(
    "should handle getDataPath returning an unexpected value (%s)",
    async (returnValue) => {
      const mockQuery = vi.fn().mockResolvedValue({
        data: {
          items: [{ id: 1, value: "Item 1" }],
          total: 1,
        },
        error: undefined,
      });

      const mockGetDataPath = vi.fn((data: MockQR) => returnValue as unknown as MockDT[]); // Casting to avoid TypeScript error
      const mockTotalPath = vi.fn((data: MockQR) => data.total);

      const result = await utils.fetchAllData<MockQR, MockQI, MockDT>(
        mockQuery,
        {},
        mockGetDataPath,
        mockTotalPath
      );

      expect(result).toEqual([]);
    }
  );

  it("should handle totalPath returning a falsy value by not continuing", async () => {
    const mockQuery = vi
      .fn()
      .mockResolvedValue({
        data: {
          items: [{ id: 1, value: "Item 1" }],
          total: 1000,
        },
        error: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 1, value: "Item 1" }],
          total: 1000,
        },
        error: undefined,
      });

    const mockGetDataPath = vi.fn((data: MockQR) => data.items);
    const mockTotalPath = vi.fn((data: MockQR) => null);

    const result = await utils.fetchAllData<MockQR, MockQI, MockDT>(
      mockQuery,
      {},
      mockGetDataPath,
      mockTotalPath
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1, value: "Item 1" }]);
  });

  it("should throw an error if any of the queries return an error", async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      data: {
        items: [{ id: 1, value: "Item 1" }],
        total: 1,
      },
      error: new Error("Test error"),
    });

    const getDataPath = (data: MockQR) => data.items;
    const totalPath = (data: MockQR) => data.total;

    await expect(
      utils.fetchAllData<MockQR, MockQI, MockDT>(mockQuery, {}, getDataPath, totalPath)
    ).rejects.toThrow("Test error");
  });
});
