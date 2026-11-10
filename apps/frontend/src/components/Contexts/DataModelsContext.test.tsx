import { MANIFEST_CACHE_KEY, MODEL_FILE_REPO } from "@/config/ModelNavigator";
import env from "@/env";
import { manifestAssetsFactory } from "@/factories/data-common/ManifestAssetsFactory";
import { act, renderHook, waitFor } from "@/test-utils";
import { Logger } from "@/utils/logger";

import { DataModelsProvider, useDataModels } from "./DataModelsContext";

const mockFetch = vi.fn<typeof fetch>();
const oneDay = 24 * 60 * 60 * 1000;

const response = (manifest: unknown, status = 200) =>
  new Response(JSON.stringify(manifest), { status });

const writeCache = (data: unknown, fetchedAt = Date.now()) =>
  localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify({ fetchedAt, data }));

const renderDataModels = () => renderHook(() => useDataModels(), { wrapper: DataModelsProvider });

describe("useDataModels", () => {
  let originalTier: AppEnv["VITE_DEV_TIER"];

  beforeEach(() => {
    originalTier = env.VITE_DEV_TIER;
    env.VITE_DEV_TIER = undefined;
    localStorage.clear();
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    env.VITE_DEV_TIER = originalTier;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useDataModels())).toThrow(
      "useDataModels cannot be used outside of the DataModelsProvider component"
    );
  });

  it("loads the manifest and caches it with a timestamp", async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const assets = manifestAssetsFactory.build({
      "display-name": "GC",
      versions: ["1.0", "2.0"],
    });
    const manifest = { CDS: assets };
    mockFetch.mockResolvedValue(response(manifest));

    const { result } = renderDataModels();

    expect(result.current).toEqual({ status: "LOADING", models: [], visibleModels: [] });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(`${MODEL_FILE_REPO}prod/cache/content.json`, {
      signal: expect.any(AbortSignal),
    });

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    const model = { name: "CDS", displayName: "GC", isHidden: false, assets };
    expect(result.current.models).toEqual([model]);
    expect(result.current.visibleModels).toEqual([model]);
    expect(JSON.parse(localStorage.getItem(MANIFEST_CACHE_KEY))).toEqual({
      fetchedAt: now,
      data: manifest,
    });
  });

  it("fetches the configured tier", () => {
    env.VITE_DEV_TIER = "dev2";

    renderDataModels();

    expect(mockFetch).toHaveBeenCalledWith(`${MODEL_FILE_REPO}dev2/cache/content.json`, {
      signal: expect.any(AbortSignal),
    });
  });

  it("exposes all models while excluding hidden models from visibleModels", async () => {
    const manifest = {
      VISIBLE: manifestAssetsFactory.build(),
      HIDDEN: manifestAssetsFactory.build({ isHidden: true }),
    };
    mockFetch.mockResolvedValue(response(manifest));

    const { result } = renderDataModels();

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    expect(result.current.models.map(({ name }) => name)).toEqual(["VISIBLE", "HIDDEN"]);
    expect(result.current.visibleModels.map(({ name }) => name)).toEqual(["VISIBLE"]);
  });

  it("serves the cached models immediately, then replaces and caches them after revalidation", async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const cachedAssets = manifestAssetsFactory.build({ "display-name": "Cached" });
    const freshAssets = manifestAssetsFactory.build({ "display-name": "Fresh" });
    const freshManifest = { FRESH: freshAssets };
    writeCache({ CACHED: cachedAssets }, now - 1);
    let resolveFetch: (value: Response) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderDataModels();

    expect(result.current).toEqual({
      status: "LOADED",
      models: [{ name: "CACHED", displayName: "Cached", isHidden: false, assets: cachedAssets }],
      visibleModels: [
        { name: "CACHED", displayName: "Cached", isHidden: false, assets: cachedAssets },
      ],
    });
    expect(mockFetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFetch(response(freshManifest));
    });

    expect(result.current.models).toEqual([
      { name: "FRESH", displayName: "Fresh", isHidden: false, assets: freshAssets },
    ]);
    expect(JSON.parse(localStorage.getItem(MANIFEST_CACHE_KEY))).toEqual({
      fetchedAt: now,
      data: freshManifest,
    });
  });

  it("applies changed visibility and versions when a cached model is refreshed", async () => {
    const cachedAssets = manifestAssetsFactory.build({ versions: ["1.0"] });
    const freshAssets = manifestAssetsFactory.build({ isHidden: true, versions: ["2.0"] });
    writeCache({ CDS: cachedAssets });
    let resolveFetch: (value: Response) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderDataModels();

    expect(result.current.visibleModels[0].assets.versions).toEqual(["1.0"]);

    await act(async () => {
      resolveFetch(response({ CDS: freshAssets }));
    });

    expect(result.current.models[0]).toMatchObject({
      name: "CDS",
      isHidden: true,
      assets: { versions: ["2.0"] },
    });
    expect(result.current.visibleModels).toEqual([]);
  });

  it.each([
    ["exactly 24 hours old", oneDay, "LOADED", ["CACHED"]],
    ["older than 24 hours", oneDay + 1, "LOADING", []],
    ["in the future", -60_000, "LOADING", []],
  ])("handles a cache entry %s", (_description, age, status, names) => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    writeCache({ CACHED: manifestAssetsFactory.build() }, now - age);

    const { result } = renderDataModels();

    expect(result.current.status).toBe(status);
    expect(result.current.models.map(({ name }) => name)).toEqual(names);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing timestamp", { data: { CDS: {} } }],
    ["non-numeric timestamp", { fetchedAt: "now", data: { CDS: {} } }],
    ["null data", { fetchedAt: Date.now(), data: null }],
    ["array data", { fetchedAt: Date.now(), data: [] }],
  ])("ignores a malformed cache with %s", (_description, cached) => {
    localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(cached));

    const { result } = renderDataModels();

    expect(result.current).toEqual({ status: "LOADING", models: [], visibleModels: [] });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it.each([
    [{ CACHED: manifestAssetsFactory.build() }, ["CACHED"]],
    [{}, []],
  ])("retains a valid cached manifest if the refresh fails", async (manifest, names) => {
    writeCache(manifest);
    const cached = localStorage.getItem(MANIFEST_CACHE_KEY);
    const error = new Error("offline");
    mockFetch.mockRejectedValue(error);
    const logError = vi.spyOn(Logger, "error");

    const { result } = renderDataModels();

    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        "DataModelsProvider: Unable to fetch the model manifest",
        error
      )
    );
    expect(result.current.status).toBe("LOADED");
    expect(result.current.models.map(({ name }) => name)).toEqual(names);
    expect(localStorage.getItem(MANIFEST_CACHE_KEY)).toBe(cached);
  });

  it("finishes loading with no models if the fetch fails without a cache", async () => {
    const error = new Error("offline");
    mockFetch.mockRejectedValue(error);
    const logError = vi.spyOn(Logger, "error");

    const { result } = renderDataModels();

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    expect(result.current.models).toEqual([]);
    expect(result.current.visibleModels).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      "DataModelsProvider: Unable to fetch the model manifest",
      error
    );
  });

  it("finishes loading with no models if the fetch fails with an expired cache", async () => {
    writeCache({ CACHED: manifestAssetsFactory.build() }, Date.now() - oneDay - 1);
    mockFetch.mockRejectedValue(new Error("offline"));

    const { result } = renderDataModels();

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    expect(result.current.models).toEqual([]);
  });

  it("rejects an unsuccessful HTTP response even if its body is valid JSON", async () => {
    mockFetch.mockResolvedValue(response({ CDS: manifestAssetsFactory.build() }, 404));
    const logError = vi.spyOn(Logger, "error");

    const { result } = renderDataModels();

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    expect(result.current.models).toEqual([]);
    expect(localStorage.getItem(MANIFEST_CACHE_KEY)).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      "DataModelsProvider: Unable to fetch the model manifest",
      expect.objectContaining({ message: expect.stringContaining("HTTP 404") })
    );
  });

  it.each([
    ["an unsuccessful HTTP response", () => response({ OTHER: {} }, 503)],
    ["invalid JSON", () => new Response("{not-json", { status: 200 })],
    ["an invalid manifest", () => response([])],
  ])("retains the cached manifest after %s", async (_description, makeResponse) => {
    writeCache({ CACHED: manifestAssetsFactory.build() });
    const cached = localStorage.getItem(MANIFEST_CACHE_KEY);
    mockFetch.mockResolvedValue(makeResponse());
    const logError = vi.spyOn(Logger, "error");

    const { result } = renderDataModels();

    await waitFor(() => expect(logError).toHaveBeenCalled());
    expect(result.current.status).toBe("LOADED");
    expect(result.current.models.map(({ name }) => name)).toEqual(["CACHED"]);
    expect(localStorage.getItem(MANIFEST_CACHE_KEY)).toBe(cached);
  });

  it.each([null, [], "string", 1, true])(
    "rejects a manifest that is not an object (%s)",
    async (manifest) => {
      mockFetch.mockResolvedValue(response(manifest));
      const logError = vi.spyOn(Logger, "error");

      const { result } = renderDataModels();

      await waitFor(() => expect(result.current.status).toBe("LOADED"));
      expect(result.current.models).toEqual([]);
      expect(localStorage.getItem(MANIFEST_CACHE_KEY)).toBeNull();
      expect(logError).toHaveBeenCalled();
    }
  );

  it("rejects an invalid JSON response", async () => {
    mockFetch.mockResolvedValue(new Response("{not-json", { status: 200 }));
    const logError = vi.spyOn(Logger, "error");

    const { result } = renderDataModels();

    await waitFor(() => expect(result.current.status).toBe("LOADED"));
    expect(result.current.models).toEqual([]);
    expect(logError).toHaveBeenCalled();
  });

  it("does not let an unmounted provider overwrite a newer provider's cache", async () => {
    let resolveOldFetch: (value: Response) => void;
    const oldRequest = new Promise<Response>((resolve) => {
      resolveOldFetch = resolve;
    });
    const freshManifest = { FRESH: manifestAssetsFactory.build() };
    mockFetch.mockReturnValueOnce(oldRequest).mockResolvedValueOnce(response(freshManifest));

    env.VITE_DEV_TIER = "dev";
    const { unmount } = renderDataModels();
    unmount();
    expect(mockFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
    env.VITE_DEV_TIER = "qa";
    const { result } = renderDataModels();
    await waitFor(() => expect(result.current.status).toBe("LOADED"));

    await act(async () => {
      resolveOldFetch(response({ OLD: manifestAssetsFactory.build() }));
    });

    expect(mockFetch).toHaveBeenNthCalledWith(1, `${MODEL_FILE_REPO}dev/cache/content.json`, {
      signal: expect.any(AbortSignal),
    });
    expect(mockFetch).toHaveBeenNthCalledWith(2, `${MODEL_FILE_REPO}qa/cache/content.json`, {
      signal: expect.any(AbortSignal),
    });
    expect(result.current.models.map(({ name }) => name)).toEqual(["FRESH"]);
    expect(JSON.parse(localStorage.getItem(MANIFEST_CACHE_KEY)).data).toEqual(freshManifest);
  });
});
