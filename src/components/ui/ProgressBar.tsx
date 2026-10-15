import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  animateColor?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  size = "md",
  className,
  animateColor = true,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  }[size];

  const getColor = (pct: number) => {
    if (!animateColor) return "bg-emerald-500";
    if (pct >= 80) return "bg-emerald-500";
    if (pct >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-400">Progress</span>
          <span className="text-slate-900 dark:text-slate-100">{percentage}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5",
          heightClasses
        )}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
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
