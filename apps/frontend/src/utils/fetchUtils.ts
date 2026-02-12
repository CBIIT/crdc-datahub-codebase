import type { LazyQueryExecFunction } from "@apollo/client";

import env from "../env";

import { buildReleaseNotesUrl } from "./envUtils";
import { Logger } from "./logger";

/**
 * A utility function to fetch the release notes document from GitHub.
 *
 * @see Utilizes {@link buildReleaseNotesUrl} to build the URL to fetch the release notes document.
 * @note Handles caching the release notes document in {@link sessionStorage}.
 * @param signal An optional AbortSignal to cancel the fetch request
 * @returns The release notes document as a string
 * @throws An error if the fetch request fails
 */
export const fetchReleaseNotes = async (signal?: AbortSignal): Promise<string> => {
  const cachedNotes = sessionStorage.getItem("releaseNotes");
  if (cachedNotes) {
    return cachedNotes;
  }

  const url: string = buildReleaseNotesUrl();
  const response = await fetch(url, { method: "GET", signal });
  if (!response.ok || response.status !== 200) {
    throw new Error(`Failed to fetch release notes: HTTP Error ${response.status}`);
  }

  const md = await response.text();
  if (!md || md.length === 0) {
    throw new Error("Release notes document is empty.");
  }

  sessionStorage.setItem("releaseNotes", md);
  return md;
};

/**
 * Performs a authentication logout request to the authentication service.
 *
 * @param signal An optional AbortSignal to cancel the fetch request
 * @returns A boolean indicating if the logout was successful
 */
export const authenticationLogout = async (signal?: AbortSignal): Promise<boolean> => {
  const response = await fetch(`${window.origin}/api/authn/logout`, {
    method: "POST",
    signal,
  }).catch((error) => {
    if (error.name === "AbortError") {
      return;
    }

    Logger.error("Failed to logout user.", error);
  });

  if (!response || !response?.ok) {
    return false;
  }

  const { status } = await response.json().catch(() => ({}));
  return status || false;
};

/**
 * Performs a authentication login request to the authentication service.
 *
 * @param code The authorization code used to verify login
 * @param signal An optional AbortSignal to cancel the fetch request
 * @returns An object containing a boolean indicating if the login was successful and an error message
 */
export const authenticationLogin = async (
  code: string,
  signal?: AbortSignal
): Promise<{ success: boolean; error: string }> => {
  const response = await fetch(`${window.origin}/api/authn/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      IDP: "nih",
      redirectUri: env.VITE_NIH_REDIRECT_URL,
    }),
    signal,
  }).catch((error) => {
    if (error.name === "AbortError") {
      return;
    }

    Logger.error("Failed to login user.", error);
  });

  if (signal?.aborted) {
    return { success: false, error: undefined };
  }

  if (!response) {
    return { success: false, error: "An unknown error occurred during login." };
  }

  const { timeout, error } = await response.json().catch(() => ({
    timeout: null,
    error: "An unknown error occurred during login.",
  }));
  return { success: typeof timeout === "number" && typeof error === "undefined", error };
};

/**
 * A generic function to fetch all data from a given paginated query.
 *
 * @TODO Support generating fetch requests in parallel if `options.total` is finite.
 * @note `R`: Query Response, `I`: Query Input, `D`: Data Structure within `R`
 * @param query The query to execute.
 * @param input The input variables for the query.
 * @param getDataPath A function to extract the data array from the query response.
 * @param totalPath A function to extract the total count from the query response.
 * @param options Pagination options, including `pageSize` and `total`.
 * @returns All of the data for the given query.
 * @throws If any of the queries return an error.
 */
export const fetchAllData = async <R = never, I extends BasePaginationParams = never, D = never>(
  query: LazyQueryExecFunction<R, I>,
  input: Omit<I, "first" | "offset">,
  getDataPath: (data: R) => D[],
  totalPath: (data: R) => number,
  options: { pageSize?: number; total?: number } = {}
): Promise<D[]> => {
  const dataset: D[] = [];
  let offset = 0;

  const pageSize = options.pageSize ?? 1_000;
  let total = options.total ?? Infinity;

  while (offset < total) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await query({
      variables: { ...input, first: pageSize, offset } as I,
    });

    if (error) {
      throw error;
    }

    const items: D[] = getDataPath(data) ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      break;
    } else {
      dataset.push(...items);
    }

    if (!Number.isFinite(total)) {
      total = totalPath(data) ?? 0;
    }

    offset += pageSize;
  }

  return dataset;
};
