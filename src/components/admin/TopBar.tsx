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
      <header className="h-16 px-4 sm:px-8 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 p-2"
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
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-medium text-slate-700 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-2"
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
