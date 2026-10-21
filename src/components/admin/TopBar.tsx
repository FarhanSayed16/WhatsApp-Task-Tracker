"use client";

import React, { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useSession } from "@/hooks/useSession";

export interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { session } = useSession();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = session?.name?.trim() || "Admin";
  const initial = displayName.slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <header className="h-[72px] px-4 sm:px-6 lg:px-8 z-30 flex items-center justify-between gap-4 bg-transparent">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-bold text-[var(--color-text-primary)] truncate tracking-[-0.035em]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle light/dark theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full glass-card text-xs font-medium text-[var(--color-text-secondary)]">
            <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-[var(--color-text-inverse)] flex items-center justify-center text-[10px] font-bold">
              {initial}
            </span>
            <span className="max-w-[120px] truncate">{displayName}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to end your admin session?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="danger"
        loading={loggingOut}
      />
    </>
  );
}
