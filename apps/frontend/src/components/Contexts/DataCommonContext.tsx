import React, { FC, createContext, useContext, useEffect, useMemo, useState } from "react";

import { DataCommons } from "../../config/DataCommons";
import { fetchManifest } from "../../utils";

type LoadingState = {
  status: Status.LOADING;
  DataCommon: null;
  error: null;
};

type LoadedState = {
  status: Status.LOADED;
  DataCommon: DataCommon;
  error: null;
};

type ErrorState = {
  status: Status.ERROR;
  DataCommon: null;
  error: Error;
};

export type ContextState = LoadingState | LoadedState | ErrorState;

export enum Status {
  LOADING = "LOADING",
  LOADED = "LOADED",
  ERROR = "ERROR",
}

const initialState: ContextState = {
  status: Status.LOADING,
  DataCommon: null,
  error: null,
};

/**
 * Data Common Context Provider
 *
 * NOTE: Do NOT use this context directly. Use the useDataCommonContext hook instead.
 *       this is exported for testing purposes only.
 *
 * @see ContextState
 * @see useDataCommonContext
 */
export const Context = createContext<ContextState>(null);
Context.displayName = "DataCommonContext";

/**
 * Data Common Context Hook
 *
 * Note:
 * - This fetches the manifest for the data common assets and caches it in the session
 * - If it fails to fetch the manifest, it will throw an error
 * - It will provide the DataCommon information, configuration, and model assets
 *
 * @see DataCommonProvider
 * @see ContextState
 * @returns {ContextState} - DataCommon context
 */
export const useDataCommonContext = (): ContextState => {
  const context = useContext<ContextState>(Context);

  if (!context) {
    throw new Error(
      "useDataCommonContext cannot be used outside of the DataCommonProvider component"
    );
  }

  return context;
};

type ProviderProps = {
  /**
   * The display name of the Data Common to populate the context with.
   *
   * This must match one of the entries in the `DataCommons` configuration.
   *
   * @see {@link DataCommons} for the list of available Data Commons.
   */
  displayName: DataCommon["displayName"];
  /**
   * The children to render within the context provider.
   */
  children: React.ReactNode;
};

/**
 * Creates a Data Common context provider
 *
 * @see {@link useDataCommonContext} for consuming the context.
 * @returns The DataCommonProvider component
 */
export const DataCommonProvider: FC<ProviderProps> = ({ displayName, children }: ProviderProps) => {
  const [state, setState] = useState<ContextState>(initialState);

  const dataCommon = useMemo<DataCommon | null>(
    () => DataCommons.find((dc) => dc.displayName === displayName) ?? null,
    [displayName]
  );

  useEffect(() => {
    if (!dataCommon || !dataCommon?.name) {
      setState({
        status: Status.ERROR,
        DataCommon: null,
        error: new Error("The provided Data Common is not supported"),
      });
      return;
    }

    setState(initialState);

    (async () => {
      const manifest = await fetchManifest().catch(() => null);
      if (!manifest?.[dataCommon.name]) {
        setState({
          status: Status.ERROR,
          DataCommon: null,
          error: new Error(`Unable to fetch manifest for ${dataCommon.name}.`),
        });
        return;
      }

      setState({
        status: Status.LOADED,
        DataCommon: {
          ...dataCommon,
          assets: { ...manifest[dataCommon.name] },
        },
        error: null,
      });
    })();
  }, [dataCommon]);

  return <Context.Provider value={state}>{children}</Context.Provider>;
};
