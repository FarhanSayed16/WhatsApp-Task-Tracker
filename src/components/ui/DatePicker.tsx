"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Calendar, AlertCircle } from "lucide-react";

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  error?: string;
  helperText?: string;
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  showQuickPicks?: boolean;
}

export function DatePicker({
  className,
  label,
  error,
  helperText,
  value,
  onChange,
  showQuickPicks = true,
  id,
  disabled,
  min,
  max,
  ...props
}: DatePickerProps) {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const setToday = () => {
    const today = new Date().toISOString().split("T")[0];
    onChange(today);
  };

  const setTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split("T")[0];
    onChange(tomorrow);
  };

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        {showQuickPicks && !disabled && (
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={setToday}
              className="text-[var(--color-primary-text)] hover:underline font-medium text-[11px]"
            >
              Today
            </button>
            <span className="text-[var(--color-text-disabled)]">·</span>
            <button
              type="button"
              onClick={setTomorrow}
              className="text-[var(--color-primary-text)] hover:underline font-medium text-[11px]"
            >
              Tomorrow
            </button>
          </div>
        )}
      </div>

      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
          <Calendar className="w-4 h-4" />
        </div>
        <input
          id={inputId}
          type="date"
          value={value}
          disabled={disabled}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-lg bg-[var(--color-surface)] border text-[var(--color-text-primary)] text-sm transition-all duration-150 h-11",
            "focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed pl-10 pr-3.5",
            error
              ? "border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]/20"
              : "border-[var(--color-border-input)] focus-visible:border-[var(--color-border-focus)] focus-visible:ring-[var(--color-primary)]/20",
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-xs text-[var(--color-danger)] font-medium animate-slide-up">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
