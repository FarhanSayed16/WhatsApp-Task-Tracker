"use client";

import React, { useState } from "react";
import { LogOut, User, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

export interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
      <header className="h-16 px-4 sm:px-6 border-b border-[var(--color-border-primary)] bg-[var(--color-surface)]/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)] truncate tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-tertiary)] truncate">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          <div className="h-5 w-px bg-[var(--color-border-primary)] hidden sm:block" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="p-2 text-[var(--color-text-tertiary)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle light/dark theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          {/* User profile / Logout */}
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--color-surface-sunken)] text-xs font-medium text-[var(--color-text-secondary)]">
              <User className="w-3.5 h-3.5" />
              <span>Admin</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
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
