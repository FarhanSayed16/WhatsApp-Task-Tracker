import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface ProgressBarProps {
  /** Current completed count */
  value: number;
  /** Total count (denominator) — defaults to 100 for percentage mode */
  max?: number;
  /** Show label like "3 of 5 done" instead of percentage */
  showLabel?: boolean;
  /** Custom label text (overrides default) */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Animate colour by progress threshold */
  animateColor?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  label,
  size = "md",
  className,
  animateColor = true,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const isComplete = percentage >= 100;

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  }[size];

  const getColor = (pct: number) => {
    if (!animateColor) return "bg-[var(--color-primary)]";
    if (pct >= 100) return "bg-[var(--color-status-verified-fg)]";
    if (pct >= 70) return "bg-[var(--color-primary)]";
    if (pct >= 30) return "bg-[var(--color-status-pending-fg)]";
    return "bg-[var(--color-status-overdue-fg)]";
  };

  // Build the display label: "3 of 5 done" is more meaningful than "60%"
  const displayLabel =
    label ??
    (max !== 100
      ? `${value} of ${max} done`
      : `${percentage}%`);

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs">
          <span className="font-medium text-[var(--color-text-secondary)]">
            {displayLabel}
          </span>
          {isComplete && (
            <span className="flex items-center gap-1 text-[var(--color-status-verified-fg)] font-semibold">
              <Check className="w-3.5 h-3.5" />
              Complete
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full bg-[var(--color-surface-sunken)] rounded-full overflow-hidden",
          heightClasses
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={displayLabel}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getColor(percentage)
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
