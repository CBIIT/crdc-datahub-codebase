import { useLazyQuery } from "@apollo/client";
import React, { FC, createContext, useContext, useEffect, useMemo, useState } from "react";

import { query as GET_USER, Response as GetUserResp } from "../../graphql/getMyUser";
import { authenticationLogin, authenticationLogout, safeParse } from "../../utils";

export type ContextState = {
  status: Status;
  isLoggedIn: boolean;
  user: User;
  error?: string;
  logout?: () => Promise<boolean>;
  setData?: (data: Partial<User>) => void;
};

export enum Status {
  LOADING = "LOADING", // Retrieving user data
  LOADED = "LOADED", // Successfully retrieved user data
  SAVING = "SAVING", // Saving user data updates
  ERROR = "ERROR", // Error retrieving user data
}

const initialState: ContextState = {
  isLoggedIn: false,
  status: Status.LOADING,
  user: null,
};

/**
 * Auth Context
 *
 * NOTE: Do NOT use this context directly. Use the useAuthContext hook instead.
 *       this is exported for testing purposes only.
 *
 * @see ContextState – Auth context state
 * @see useAuthContext – Auth context hook
 */
export const Context = createContext<ContextState>(null);
Context.displayName = "AuthContext";

/**
 * Auth Context Hook
 *
 * @see AuthProvider – Must be wrapped in a AuthProvider component
 * @see ContextState – Auth context state returned by the hook
 * @returns {ContextState} - Auth context
 */
export const useAuthContext = (): ContextState => {
  const context = useContext<ContextState>(Context);

  if (!context) {
    throw new Error("AuthContext cannot be used outside of the AuthProvider component");
  }

  return context;
};

type ProviderProps = {
  children: React.ReactNode;
};

/**
 * Creates an auth context
 *
 * @see useAuthContext – Auth context hook
 * @param {ProviderProps} props - Auth context provider props
 * @returns {JSX.Element} - Auth context provider
 */
export const AuthProvider: FC<ProviderProps> = ({ children }: ProviderProps) => {
  const cachedUser = safeParse<User | null>(localStorage.getItem("userDetails"), null);
  const cachedState = cachedUser
    ? {
        isLoggedIn: true,
        status: Status.LOADED,
        user: cachedUser,
      }
    : null;
  const [state, setState] = useState<ContextState>(cachedState || initialState);

  const [getMyUser] = useLazyQuery<GetUserResp>(GET_USER, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const logout = async (): Promise<boolean> => {
    if (!state.isLoggedIn) {
      return true;
    }

    const status = await authenticationLogout();
    if (status) {
      setState({ ...initialState, status: Status.LOADED });
    }

    return status;
  };

  const setData = (data: Partial<User>): void => {
    if (!state.isLoggedIn) return;

    setState((prev) => ({ ...prev, user: { ...state.user, ...data } }));
  };

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      // User had an active session, reverify with BE
      if (cachedState) {
        const { data, error } = await getMyUser();
        if (error || !data?.getMyUser) {
          setState({ ...initialState, status: Status.LOADED });
          return;
        }

        setState({
          ...state,
          isLoggedIn: true,
          status: Status.LOADED,
          user: data?.getMyUser,
        });

        return;
      }

      // User came from NIH SSO, login to AuthN
      const searchParams = new URLSearchParams(document.location.search);
      const authCode = searchParams.get("code");
      if (authCode) {
        const { success: loginSuccess, error: loginError } = await authenticationLogin(
          authCode,
          signal
        );

        if (signal.aborted) {
          return;
        }

        if (loginSuccess) {
          const { data, error } = await getMyUser();
          if (error || !data?.getMyUser) {
            setState({ ...initialState, status: Status.LOADED });
            return;
          }

          window.history.replaceState({}, document.title, window.location.pathname);
          setState({
            isLoggedIn: true,
            status: Status.LOADED,
            user: data?.getMyUser,
          });
          const stateParam = searchParams.get("state");
          if (stateParam !== null) {
            window.location.href = stateParam;
          }
          return;
        }

        // Login failed
        setState({
          ...initialState,
          error: loginError,
          status: Status.LOADED,
        });
        return;
      }

      // User is not logged in
      setState({ ...initialState, status: Status.LOADED });
    })();

    // Cancel any pending requests
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.isLoggedIn && typeof state.user === "object") {
      localStorage.setItem("userDetails", JSON.stringify(state.user));
      return;
    }

    localStorage.removeItem("userDetails");
  }, [state.isLoggedIn, state.user]);

  const value = useMemo(() => ({ ...state, logout, setData }), [state]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
