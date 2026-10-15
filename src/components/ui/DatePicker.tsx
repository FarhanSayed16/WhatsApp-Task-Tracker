"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

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
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {showQuickPicks && !disabled && (
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={setToday}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-[11px]"
            >
              Today
            </button>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <button
              type="button"
              onClick={setTomorrow}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-[11px]"
            >
              Tomorrow
            </button>
          </div>
        )}
      </div>

      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
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
            "w-full rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 text-sm transition-all duration-150 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed pl-10 pr-3.5 py-2.5",
            error
              ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 focus:ring-rose-500/20"
              : "border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20",
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-xs text-rose-500 dark:text-rose-400 font-medium animate-slide-up">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
