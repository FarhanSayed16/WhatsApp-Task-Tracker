"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  loading?: boolean;
  className?: string;
}

export function SearchInput({
  value: controlledValue,
  defaultValue = "",
  onChange,
  onDebouncedChange,
  debounceMs = 300,
  placeholder = "Search...",
  loading = false,
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(
    controlledValue !== undefined ? controlledValue : defaultValue
  );

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  useEffect(() => {
    if (!onDebouncedChange) return;
    const timer = setTimeout(() => {
      onDebouncedChange(internalValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, onDebouncedChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    onChange?.(val);
  };

  const handleClear = () => {
    setInternalValue("");
    onChange?.("");
    onDebouncedChange?.("");
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>
      <input
        type="text"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-md)] bg-[var(--color-surface-solid)]/70 border border-[var(--color-border-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] text-sm pl-10 pr-9 py-2 h-10 focus:outline-none focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 transition-all"
      />
      {internalValue && !loading && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 p-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
