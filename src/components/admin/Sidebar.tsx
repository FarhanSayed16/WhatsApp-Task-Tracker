"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Layers,
  BarChart3,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

async function fetchActiveListCount(url: string): Promise<number> {
  const res = await fetch(url, { credentials: "same-origin" });
  const json = await res.json();
  if (!res.ok || json.success === false) return 0;
  return typeof json.meta?.total === "number" ? json.meta.total : 0;
}

/** Navigation items grouped by purpose */
const NAV_GROUPS = [
  {
    label: "Work",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/tasks", label: "Task Lists", icon: CheckSquare },
      { href: "/admin/groups", label: "Groups", icon: Users },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/admin/templates", label: "Templates", icon: Layers },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

/** Flat list of all nav items for export (used by mobile nav, etc.) */
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { session } = useSession();
  const { data: activeListCount = 0 } = useSWR(
    "/api/admin/task-lists?status=active&limit=1",
    fetchActiveListCount,
    { refreshInterval: 30_000, revalidateOnFocus: true, dedupingInterval: 10_000 }
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-[220px] border-r border-[var(--color-border-primary)] bg-[var(--color-surface)] h-screen sticky top-0 shrink-0",
        className
      )}
    >
      {/* Brand / Logo */}
      <Link
        href="/admin"
        className="h-16 flex items-center px-5 border-b border-[var(--color-border-secondary)] hover:opacity-90 transition-opacity"
        title="TaskTracker Dashboard"
      >
        <Logo size="sm" showWordmark subtitle="Dispatch" />
      </Link>

      {/* Grouped Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold border-l-[3px] border-[var(--color-primary)] rounded-l-none"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[var(--color-primary)]" : "")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: active context, Settings, Professor */}
      <div className="px-3 pb-3 border-t border-[var(--color-border-secondary)] pt-3 space-y-2">
        <Link
          href="/admin/tasks"
          className="px-3 py-1.5 rounded-lg text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-primary-subtle)] transition-colors block"
        >
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {activeListCount}
          </span>{" "}
          active {activeListCount === 1 ? "list" : "lists"}
        </Link>

        <Link
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/admin/settings")
              ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold border-l-[3px] border-[var(--color-primary)] rounded-l-none"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Settings className={cn("w-4 h-4 shrink-0", pathname.startsWith("/admin/settings") ? "text-[var(--color-primary)]" : "")} />
          <span>Settings</span>
        </Link>

        {session?.name && (
          <div className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-sunken)] flex items-center gap-2 text-xs">
            <div className="w-5 h-5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-bold flex items-center justify-center text-[10px] shrink-0">
              {session.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="truncate font-medium text-[var(--color-text-secondary)]">
              {session.name}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

/** Mobile bottom navigation bar — 4 items max for thumb reach */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileItems = [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/admin/groups", label: "Groups", icon: Users },
  ];

  const moreItems = [
    { href: "/admin/templates", label: "Templates", icon: Layers },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const moreActive =
    pathname.startsWith("/admin/templates") ||
    pathname.startsWith("/admin/reports") ||
    pathname.startsWith("/admin/settings");

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-sm border-t border-[var(--color-border-primary)] px-2 py-1.5 flex items-center justify-around">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors min-w-[56px]",
                isActive
                  ? "text-[var(--color-primary)] font-bold"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] mt-0.5" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors min-w-[56px]",
            moreActive
              ? "text-[var(--color-primary)] font-bold"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
          {moreActive && (
            <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] mt-0.5" />
          )}
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[var(--color-surface)] border-t border-[var(--color-border-primary)] p-4 pb-8 shadow-float animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-sunken)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium",
                      isActive
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
