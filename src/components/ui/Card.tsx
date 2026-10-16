import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "elevated" | "inset" | "status";
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
    default:
      "bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-card)]",
    interactive:
      "bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5 cursor-pointer transition-all duration-200",
    elevated:
      "bg-[var(--color-surface-raised)] shadow-[var(--shadow-md)] border-0",
    inset:
      "bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)] shadow-none",
    status:
      "bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-card)] border-l-[3px]",
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
        "rounded-xl p-5 transition-all",
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
