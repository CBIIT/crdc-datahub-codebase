import React, { FC, createContext, useContext, useEffect, useMemo, useState } from "react";

import { MANIFEST_CACHE_KEY, MANIFEST_CACHE_TTL, MODEL_FILE_REPO } from "@/config/ModelNavigator";
import env from "@/env";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { buildDataModels } from "@/utils/dataModelUtils";
import { isRecord } from "@/utils/jsonUtils";
import { Logger } from "@/utils/logger";

export type DataModelsStatus = "LOADING" | "LOADED";

export type DataModelsCtxState = {
  /**
   * The current status of the Data Models
   */
  status: DataModelsStatus;
  /**
   * Whether the manifest is still being fetched from the model repository.
   * While true, any Data Models provided are from the cache and may be outdated.
   */
  isRefreshing: boolean;
  /**
   * All Data Models defined in the content manifest, including hidden models
   */
  models: DataCommon[];
  /**
   * The Data Models that are not hidden from the UI
   */
  visibleModels: DataCommon[];
};

type ManifestCache = {
  fetchedAt: number;
  data: Record<string, unknown>;
};

/**
 * Data Models Context
 *
 * @note Do NOT use this context directly. This is exported for testing purposes only.
 * @see {@link DataModelsCtxState} – Data Models context state
 * @see {@link useDataModels} – Data Models context hook
 */
export const DataModelsContext = createContext<DataModelsCtxState>(null);
DataModelsContext.displayName = "DataModelsContext";

/**
 * Provides access to the Data Models defined in the model repository content manifest.
 *
 * @see {@link DataModelsProvider} Must be wrapped in the provider component
 * @see {@link DataModelsCtxState} Context state returned by the hook
 * @returns The Data Models context state
 */
export const useDataModels = (): DataModelsCtxState => {
  const context = useContext<DataModelsCtxState>(DataModelsContext);

  if (!context) {
    throw new Error("useDataModels cannot be used outside of the DataModelsProvider component");
  }

  return context;
};

type ProviderProps = {
  children: React.ReactNode;
};

/**
 * Loads the model repository content manifest and provides the Data Models to the application.
 *
 * - A non-expired cached manifest is served immediately (if available)
 * - The manifest is always re-fetched in the background on mount
 * - If the fetch fails and no cache is available, no Data Models are provided
 *
 * @see {@link useDataModels} The context hook
 * @returns React Context Provider
 */
export const DataModelsProvider: FC<ProviderProps> = ({ children }: ProviderProps) => {
  const [cache, setCache] = useLocalStorage<ManifestCache | null>(MANIFEST_CACHE_KEY, null);
  const [fetchSettled, setFetchSettled] = useState<boolean>(false);

  const models = useMemo<DataCommon[] | null>(() => {
    const age = typeof cache?.fetchedAt === "number" ? Date.now() - cache.fetchedAt : NaN;
    const isFresh = age >= 0 && age <= MANIFEST_CACHE_TTL;

    return isFresh && isRecord(cache.data) ? buildDataModels(cache.data) : null;
  }, [cache]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${MODEL_FILE_REPO}${env.VITE_DEV_TIER || "prod"}/cache/content.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to fetch model manifest: HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((manifest: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!isRecord(manifest)) {
          throw new Error("The model manifest must be an object");
        }

        setCache({ fetchedAt: Date.now(), data: manifest });
        setFetchSettled(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        Logger.error("DataModelsProvider: Unable to fetch the model manifest", error);
        setFetchSettled(true);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const value = useMemo<DataModelsCtxState>(
    () => ({
      status: models || fetchSettled ? "LOADED" : "LOADING",
      isRefreshing: !fetchSettled,
      models: models || [],
      visibleModels: models?.filter((model) => !model.isHidden) || [],
    }),
    [models, fetchSettled]
  );

  return <DataModelsContext.Provider value={value}>{children}</DataModelsContext.Provider>;
};
