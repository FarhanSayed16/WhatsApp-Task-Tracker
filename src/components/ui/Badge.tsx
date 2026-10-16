import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "pending" | "done" | "verified" | "overdue" | "neutral" | "draft" | "active";
}

export function Badge({
  className,
  variant = "neutral",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    pending:
      "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)] border border-[var(--color-status-pending-fg)]/20",
    done:
      "bg-[var(--color-status-done-bg)] text-[var(--color-status-done-fg)] border border-[var(--color-status-done-fg)]/20",
    verified:
      "bg-[var(--color-status-verified-bg)] text-[var(--color-status-verified-fg)] border border-[var(--color-status-verified-fg)]/20",
    overdue:
      "bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue-fg)] border border-[var(--color-status-overdue-fg)]/20",
    active:
      "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] border border-[var(--color-primary)]/20",
    neutral:
      "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] border border-[var(--color-border-primary)]",
    draft:
      "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-fg)] border border-dashed border-[var(--color-status-draft-fg)]/30",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide",
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
