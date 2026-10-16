import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "circle" | "card" | "tableRow";
}

export function Skeleton({
  className,
  variant = "line",
  ...props
}: SkeletonProps) {
  const base =
    "animate-pulse bg-[var(--color-border-primary)] transition-colors";

  if (variant === "circle") {
    return (
      <div
        className={cn(base, "rounded-full w-10 h-10 shrink-0", className)}
        {...props}
      />
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "rounded-xl border border-[var(--color-border-primary)] p-5 space-y-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div className={cn(base, "h-5 w-1/3 rounded-md")} />
          <div className={cn(base, "h-5 w-16 rounded-md")} />
        </div>
        <div className="space-y-2">
          <div className={cn(base, "h-4 w-full rounded")} />
          <div className={cn(base, "h-4 w-4/5 rounded")} />
        </div>
        <div className="pt-2 flex justify-between items-center">
          <div className={cn(base, "h-3 w-20 rounded")} />
          <div className={cn(base, "h-8 w-24 rounded-lg")} />
        </div>
      </div>
    );
  }

  if (variant === "tableRow") {
    return (
      <div
        className={cn(
          "flex items-center justify-between py-4 px-4 border-b border-[var(--color-border-secondary)] gap-4",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={cn(base, "h-9 w-9 rounded-full shrink-0")} />
          <div className="space-y-1.5 flex-1">
            <div className={cn(base, "h-4 w-32 rounded")} />
            <div className={cn(base, "h-3 w-24 rounded")} />
          </div>
        </div>
        <div className={cn(base, "h-6 w-16 rounded-md")} />
        <div className={cn(base, "h-8 w-8 rounded-lg")} />
      </div>
    );
  }

  // default: line
  return (
    <div
      className={cn(base, "h-4 w-full rounded-md", className)}
      {...props}
    />
  );
}
