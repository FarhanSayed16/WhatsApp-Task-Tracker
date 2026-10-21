import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, AlertCircle } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: DropdownOption[];
  placeholder?: string;
}

export const Dropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      placeholder,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId =
      id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              "w-full appearance-none rounded-[var(--radius-md)] bg-[var(--color-surface-solid)]/70 border text-[var(--color-text-primary)] text-sm transition-all duration-150 h-11",
              "focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed pl-3.5 pr-10 cursor-pointer",
              error
                ? "border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]/20"
                : "border-[var(--color-border-input)] focus-visible:border-[var(--color-border-focus)] focus-visible:ring-[var(--color-primary)]/20",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
            <ChevronDown className="w-4 h-4" />
          </div>
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
);

Dropdown.displayName = "Dropdown";
