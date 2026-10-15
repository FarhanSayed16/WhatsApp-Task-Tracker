"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSWRFetch } from "./useSWRFetch";

export interface AdminSession {
  id: string;
  orgId: string;
  name: string;
  role: string;
  timezone: string;
  sessionVersion: number;
}

export interface UseSessionOptions {
  requireAuth?: boolean;
  redirectTo?: string;
}

export function useSession(options?: UseSessionOptions) {
  const { requireAuth = false, redirectTo = "/login" } = options || {};
  const router = useRouter();

  const { data: session, error, isLoading, mutate } = useSWRFetch<AdminSession>(
    "/api/admin/me",
    {
      disablePoll: true,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );

  const isAuthenticated = !!session && !error;
  const isUnauthenticated = !isLoading && (!session || !!error);

  useEffect(() => {
    if (requireAuth && isUnauthenticated) {
      router.push(redirectTo);
    }
  }, [requireAuth, isUnauthenticated, redirectTo, router]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      mutate(undefined, false);
      router.push("/login");
      router.refresh();
    }
  };

  return {
    session: session || null,
    isAuthenticated,
    isUnauthenticated,
    isLoading,
    error,
    logout,
    refresh: () => mutate(),
  };
}
