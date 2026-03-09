import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SetURLSearchParams, useLocation, useSearchParams } from "react-router-dom";

export type LastSearchParams = { [key: string]: string } | null;

type ContextState = {
  lastSearchParams: LastSearchParams;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
};

/**
 * Search Params Context
 *
 * NOTE: Do NOT use this context directly. Use the useSearchParamsContext hook instead.
 *       this is exported for testing purposes only.
 *
 * @see ContextState – Search Params context state
 * @see useSearchParamsContext – Search Params context hook
 */
export const Context = createContext<ContextState>(null);
Context.displayName = "SearchParamsContext";

type ProviderProps = {
  children: React.ReactNode;
};

/**
 * Creates a Search Params context provider
 *
 * @see useSearchParamsContext
 * @param {ProviderProps} props
 * @returns {JSX.Element} Context provider
 */
export const SearchParamsProvider: React.FC<ProviderProps> = ({ children }) => {
  const [searchParams, setSearchParamsBase] = useSearchParams();
  const location = useLocation();

  const [lastSearchParams, setLastSearchParams] = useState<LastSearchParams>(null);

  useEffect(() => {
    if (location?.search === lastSearchParams?.[location?.pathname]) {
      return;
    }
    // if no previous search params for pathname, don't store empty search params
    if (!lastSearchParams?.[location.pathname] && !location?.search) {
      return;
    }

    setLastSearchParams((prev) => ({ ...prev, [location.pathname]: location.search }));
  }, [location]);

  const setSearchParams: SetURLSearchParams = (newSearchParams, options = {}) => {
    if (!setSearchParamsBase) {
      return;
    }
    setSearchParamsBase(newSearchParams, { replace: true, preventScrollReset: true, ...options });
  };

  const value = useMemo(
    () => ({
      lastSearchParams,
      searchParams,
      setSearchParams,
    }),
    [lastSearchParams, searchParams, setSearchParams]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

/**
 * Search Params Hook
 *
 * Note:
 * - The allows for maintaining searchParams state across components
 *
 * @see SearchParamsProvider – Must be wrapped in a SearchParamsProvider component
 * @see ContextState – Search Params context state returned by the hook
 * @returns {ContextState} - Search Params context and setter
 */
export const useSearchParamsContext = (): ContextState => {
  const context = useContext<ContextState>(Context);

  if (!context) {
    throw new Error(
      "useSearchParamsContext cannot be used outside of the SearchParamsProvider component"
    );
  }

  return context;
};
