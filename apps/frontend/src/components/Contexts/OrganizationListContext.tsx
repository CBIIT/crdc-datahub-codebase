import { useQuery } from "@apollo/client";
import React, { FC, createContext, useContext, useEffect, useState } from "react";

import { LIST_ORGS, ListOrgsInput, ListOrgsResp } from "../../graphql";

export type ContextState = {
  status: Status;
  data: ListOrgsResp["listPrograms"]["programs"];
  activeOrganizations: ListOrgsResp["listPrograms"]["programs"];
};

export enum Status {
  LOADING = "LOADING",
  LOADED = "LOADED",
  ERROR = "ERROR",
}

const initialState: ContextState = {
  status: Status.LOADING,
  data: [],
  activeOrganizations: [],
};

/**
 * Organization List Context
 *
 * NOTE: Do NOT use this context directly. Use the useOrganizationListContext hook instead.
 *       this is exported for testing purposes only.
 *
 * @see ContextState – Organization context state
 * @see useOrganizationListContext – Organization context hook
 */
export const Context = createContext<ContextState>(null);
Context.displayName = "OrganizationListContext";

/**
 * Org Context Hook
 *
 * Note:
 * - The organization list contains only Active organizations
 *
 * @see OrganizationProvider – Must be wrapped in a OrganizationProvider component
 * @see ContextState – Organization context state returned by the hook
 * @returns {ContextState} - Organization context
 */
export const useOrganizationListContext = (): ContextState => {
  const context = useContext<ContextState>(Context);

  if (!context) {
    throw new Error(
      "OrganizationListContext cannot be used outside of the OrganizationProvider component"
    );
  }

  return context;
};

type ProviderProps = {
  preload: boolean;
  children: React.ReactNode;
};

/**
 * Creates a organization context provider
 *
 * @see useOrganizationListContext
 * @param {ProviderProps} props
 * @returns {JSX.Element} Context provider
 */
export const OrganizationProvider: FC<ProviderProps> = ({ preload, children }: ProviderProps) => {
  const [state, setState] = useState<ContextState>(initialState);

  const { data, loading, error } = useQuery<ListOrgsResp, ListOrgsInput>(LIST_ORGS, {
    context: { clientName: "backend" },
    variables: { status: "All", first: -1, orderBy: "name", sortDirection: "asc" },
    fetchPolicy: "no-cache",
    skip: !preload,
  });

  useEffect(() => {
    if (loading) {
      setState({ status: Status.LOADING, data: [], activeOrganizations: [] });
      return;
    }
    if (error) {
      setState({ status: Status.ERROR, data: [], activeOrganizations: [] });
      return;
    }

    const activeOrganizations = data?.listPrograms?.programs.filter(
      (org) => org.status === "Active"
    );

    setState({
      status: Status.LOADED,
      data: data?.listPrograms?.programs || [],
      activeOrganizations: activeOrganizations || [],
    });
  }, [loading, error, data]);

  return <Context.Provider value={state}>{children}</Context.Provider>;
};
