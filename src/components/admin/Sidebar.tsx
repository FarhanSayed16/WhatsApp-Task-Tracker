"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Layers,
  BarChart3,
  Settings,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react";

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

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-[220px] border-r border-[var(--color-border-primary)] bg-[var(--color-surface)] h-screen sticky top-0 shrink-0",
        className
      )}
    >
      {/* Brand / Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--color-border-secondary)] gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center">
          <MessageSquare className="w-4.5 h-4.5" />
        </div>
        <div>
          <span className="font-bold text-[var(--color-text-primary)] tracking-tight text-sm">
            TaskTracker
          </span>
          <span className="block text-[10px] text-[var(--color-primary-text)] font-medium">
            Dispatch
          </span>
        </div>
      </div>

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
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold"
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

      {/* Bottom: Settings (separated) */}
      <div className="px-3 pb-3 border-t border-[var(--color-border-secondary)] pt-3">
        <Link
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            pathname.startsWith("/admin/settings")
              ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] font-semibold"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Settings className={cn("w-4 h-4 shrink-0", pathname.startsWith("/admin/settings") ? "text-[var(--color-primary)]" : "")} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}

/** Mobile bottom navigation bar — 4 items max for thumb reach */
export function MobileBottomNav() {
  const pathname = usePathname();

  const mobileItems = [
    { href: "/admin", label: "Home", icon: LayoutDashboard },
    { href: "/admin/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/admin/groups", label: "Groups", icon: Users },
  ];

  return (
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
      {/* More button */}
      <Link
        href="/admin/templates"
        className={cn(
          "flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors min-w-[56px]",
          pathname.startsWith("/admin/templates") || pathname.startsWith("/admin/reports") || pathname.startsWith("/admin/settings")
            ? "text-[var(--color-primary)] font-bold"
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <MoreHorizontal className="w-5 h-5 mb-0.5" />
        <span>More</span>
      </Link>
    </nav>
  );
}
