"use client";

import React from "react";
import { Sidebar, MobileBottomNav } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PWAInstallBanner } from "@/components/ui/PWAInstallPrompt";

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
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)] text-[var(--color-text-primary)] antialiased">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-4 sm:p-6 max-w-[960px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileBottomNav />

      {/* PWA One-Tap Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}
