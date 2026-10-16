import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "pending"
  | "done"
  | "verified"
  | "overdue"
  | "neutral"
  | "draft"
  | "active";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Show status glyph (○ ✓ ✓✓ ⚠ ●) */
  showGlyph?: boolean;
}

const GLYPH: Record<BadgeVariant, string> = {
  pending: "○",
  done: "✓",
  verified: "✓✓",
  overdue: "⚠",
  active: "●",
  draft: "◌",
  neutral: "",
};

export function Badge({
  className,
  variant = "neutral",
  showGlyph = false,
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

  const glyph = showGlyph ? GLYPH[variant] : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold",
        variantStyles,
        className
      )}
      {...props}
    >
      {glyph ? <span aria-hidden className="text-[10px] leading-none">{glyph}</span> : null}
      {children}
    </span>
  );
}
