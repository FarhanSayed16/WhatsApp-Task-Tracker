import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "pending" | "done" | "verified" | "overdue" | "neutral" | "draft";
}

export function Badge({
  className,
  variant = "neutral",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    pending:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    // Plan: done = green, verified = blue
    done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    verified:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    overdue:
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    neutral:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
    draft:
      "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide",
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
