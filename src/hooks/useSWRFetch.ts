"use client";

import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import { SWR_POLL_INTERVAL_MS } from "@/lib/constants";

/**
 * Standard fetcher for SWR that handles JSON parsing and error throwing.
 */
export async function defaultFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    const errorMsg =
      data?.error?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    // Attach details or status if available
    (err as any).status = res.status;
    (err as any).details = data?.error;
    throw err;
  }

  return (data.data !== undefined ? data.data : data) as T;
}

export interface UseSWRFetchOptions<T> extends SWRConfiguration<T> {
  pollInterval?: number; // Defaults to SWR_POLL_INTERVAL_MS (15s)
  disablePoll?: boolean;
}

/**
 * Typed wrapper around useSWR with 15-second polling, revalidation on focus, and error retry.
 */
export function useSWRFetch<T>(
  url: string | null,
  options?: UseSWRFetchOptions<T>
): SWRResponse<T, Error> & {
  isLoading: boolean;
} {
  const { pollInterval = SWR_POLL_INTERVAL_MS, disablePoll = false, ...swrConfig } =
    options || {};

  const response = useSWR<T, Error>(
    url,
    defaultFetcher,
    {
      refreshInterval: disablePoll ? 0 : pollInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      dedupingInterval: 2000,
      ...swrConfig,
    }
  );

  return {
    ...response,
    isLoading: !response.error && !response.data && !!url,
  };
}
