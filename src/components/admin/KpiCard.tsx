import React from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  color?: "emerald" | "blue" | "amber" | "rose" | "slate";
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  color = "emerald",
  className,
}: KpiCardProps) {
  const colorStyles = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  }[color];

  return (
    <Card className={cn("p-5 relative overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              colorStyles
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trend.direction === "up" && (
            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.direction === "down" && (
            <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.direction === "neutral" && (
            <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 font-medium">
              <Minus className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span className="text-slate-400 dark:text-slate-500">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
