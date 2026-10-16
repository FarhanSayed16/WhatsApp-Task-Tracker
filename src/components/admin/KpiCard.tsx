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
    emerald: "bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)]",
    blue: "bg-[var(--color-status-done-bg)] text-[var(--color-status-done-fg)]",
    amber: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)]",
    rose: "bg-[var(--color-status-overdue-bg)] text-[var(--color-status-overdue-fg)]",
    slate: "bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]",
  }[color];

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
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
            <span className="flex items-center gap-0.5 text-[var(--color-status-verified-fg)] font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.direction === "down" && (
            <span className="flex items-center gap-0.5 text-[var(--color-status-overdue-fg)] font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.direction === "neutral" && (
            <span className="flex items-center gap-0.5 text-[var(--color-text-tertiary)] font-medium">
              <Minus className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span className="text-[var(--color-text-disabled)]">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
