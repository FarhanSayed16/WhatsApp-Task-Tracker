import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "elevated" | "inset" | "status" | "ink";
  /** Status accent colour (left border) — only used when variant="status" */
  statusColor?: "pending" | "done" | "verified" | "overdue" | "draft";
}

export function Card({
  className,
  variant = "default",
  statusColor,
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: "glass-card",
    interactive:
      "glass-card hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)]/25 hover:-translate-y-0.5 cursor-pointer",
    elevated:
      "bg-[var(--color-surface-raised)] shadow-[var(--shadow-md)] border border-[var(--color-border-primary)]",
    inset:
      "bg-[var(--color-surface-sunken)] border border-dashed border-[var(--color-border-primary)] shadow-none",
    status:
      "glass-card border-l-[3px]",
    ink: "ink-card",
  }[variant];

  const statusBorderColors = {
    pending: "border-l-[var(--color-status-pending-fg)]",
    done: "border-l-[var(--color-status-done-fg)]",
    verified: "border-l-[var(--color-status-verified-fg)]",
    overdue: "border-l-[var(--color-status-overdue-fg)]",
    draft: "border-l-[var(--color-status-draft-fg)]",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-5 transition-all duration-[var(--transition-base)]",
        variantStyles,
        variant === "status" && statusColor && statusBorderColors[statusColor],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
