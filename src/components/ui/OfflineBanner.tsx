"use client";

import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Thin top strip when the browser reports offline.
 * Complements the SW offline HTML page for in-app awareness.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-b border-[var(--color-warning)]/25 text-xs font-semibold"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>You&apos;re offline — changes will sync when you reconnect.</span>
    </div>
  );
}
