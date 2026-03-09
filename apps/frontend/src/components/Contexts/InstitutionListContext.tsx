import { useQuery } from "@apollo/client";
import React, { FC, createContext, useContext, useEffect, useState } from "react";

import { LIST_INSTITUTIONS, ListInstitutionsInput, ListInstitutionsResp } from "../../graphql";

export type InstitutionCtxState = {
  /**
   * The current state of the context
   */
  status: InstitutionCtxStatus;
  /**
   * The total number of institutions
   */
  total: number;
  /**
   * An array of Submission Request institutions
   */
  data: Institution[];
};

export enum InstitutionCtxStatus {
  LOADING = "LOADING",
  LOADED = "LOADED",
  ERROR = "ERROR",
}

const initialState: InstitutionCtxState = {
  status: InstitutionCtxStatus.LOADING,
  total: 0,
  data: [],
};

/**
 * Institution List Context
 *
 * @note Do NOT use this context directly. This is exported for testing purposes only.
 * @see {@link InstitutionCtxState} – Institution context state
 * @see {@link useInstitutionList} – Institution context hook
 */
export const InstitutionCtx = createContext<InstitutionCtxState>(null);
InstitutionCtx.displayName = "InstitutionListContext";

/**
 * Submission Request Institution Context Hook
 *
 * @see {@link InstitutionProvider} Must be wrapped in the provider component
 * @see {@link InstitutionCtxState} Context state returned by the hook
 */
export const useInstitutionList = (): InstitutionCtxState => {
  const context = useContext<InstitutionCtxState>(InstitutionCtx);

  if (!context) {
    throw new Error(
      "useInstitutionList cannot be used outside of the InstitutionProvider component"
    );
  }

  return context;
};

type ProviderProps = {
  filterInactive?: boolean;
  children: React.ReactNode;
};

/**
 * Provides access to the Institution List hook
 *
 * @see {@link useInstitutionList} The context hook
 * @returns React Context Provider
 */
export const InstitutionProvider: FC<ProviderProps> = ({
  filterInactive = true,
  children,
}: ProviderProps) => {
  const [state, setState] = useState<InstitutionCtxState>(initialState);

  const { data, loading, error } = useQuery<ListInstitutionsResp, ListInstitutionsInput>(
    LIST_INSTITUTIONS,
    {
      variables: {
        status: filterInactive ? "Active" : undefined,
        first: -1,
        orderBy: "name",
        sortDirection: "asc",
      },
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  useEffect(() => {
    if (loading) {
      setState({ status: InstitutionCtxStatus.LOADING, total: 0, data: [] });
      return;
    }
    if (error || Array.isArray(data?.listInstitutions?.institutions) === false) {
      setState({ status: InstitutionCtxStatus.ERROR, total: 0, data: [] });
      return;
    }

    setState({
      status: InstitutionCtxStatus.LOADED,
      total: data.listInstitutions.total,
      data: data.listInstitutions.institutions,
    });
  }, [loading, error, data]);

  return <InstitutionCtx.Provider value={state}>{children}</InstitutionCtx.Provider>;
};
