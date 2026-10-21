"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileBottomNav } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PWAInstallBanner } from "@/components/ui/PWAInstallPrompt";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

export interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminLayout({
  children,
  title,
  subtitle,
  actions,
}: AdminLayoutProps) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        router.push("/admin/tasks/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="app-atmosphere min-h-screen text-[var(--color-text-primary)] antialiased md:p-3 lg:p-4">
      <div className="app-chassis relative z-[1]">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 pb-16 md:pb-0">
          <OfflineBanner />
          <TopBar title={title} subtitle={subtitle} actions={actions} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 lg:pb-8 lg:pt-2">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav />
      <PWAInstallBanner />
    </div>
  );
}
