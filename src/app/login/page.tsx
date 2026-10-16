"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Countdown timer for rate limiting lockout
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const submitPin = useCallback(async (fullPin: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
      } else {
        if (res.status === 429) {
          const retrySeconds = data.error?.details?.retryAfter || 900;
          setLockoutSeconds(retrySeconds);
          setError("Too many failed attempts. Temporary lockout active.");
        } else {
          setError(data.error?.message || "Invalid PIN. Please try again.");
        }
        setPin("");
      }
    } catch {
      setError("Network error. Please check your connection.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleDigit = useCallback((digit: string) => {
    if (lockoutSeconds !== null && lockoutSeconds > 0) return;
    if (loading) return;

    setPin((prev) => {
      if (prev.length < 6) {
        const next = prev + digit;
        if (next.length === 6) {
          submitPin(next);
        }
        return next;
      }
      return prev;
    });
    setError(null);
  }, [loading, lockoutSeconds, submitPin]);

  const handleDelete = useCallback(() => {
    if (lockoutSeconds !== null && lockoutSeconds > 0) return;
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [loading, lockoutSeconds]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        setPin("");
        setError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleDelete]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isLocked = lockoutSeconds !== null && lockoutSeconds > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-canvas)] select-none">
      {/* Subtle gradient overlay for visual interest */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary-subtle),transparent_70%)] pointer-events-none" />

      <div className="relative w-full max-w-[360px] p-6 sm:p-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-primary)] shadow-[var(--shadow-lg)] flex flex-col items-center">
        {/* Brand Mark */}
        <div className="w-14 h-14 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7" />
        </div>

        <h1 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
          TaskTracker
        </h1>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1 mb-6 text-center">
          Enter your 6-digit PIN to continue
        </p>

        {/* PIN Indicators */}
        <div
          role="status"
          aria-label={`${pin.length} of 6 digits entered`}
          className={`flex items-center justify-center gap-3 mb-6 ${
            error ? "animate-shake" : ""
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-[var(--color-primary)] scale-125"
                    : error
                    ? "border-2 border-[var(--color-danger)] bg-transparent"
                    : "border-2 border-[var(--color-border-input)] bg-transparent"
                }`}
              />
            );
          })}
        </div>

        {/* Lockout or Error Banner */}
        {isLocked ? (
          <div className="mb-4 text-xs font-medium text-[var(--color-warning)] text-center px-4 py-2.5 rounded-lg bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 w-full flex flex-col gap-1 items-center">
            <span>Too many failed attempts.</span>
            <span className="font-bold text-sm">
              Retry in: {formatCountdown(lockoutSeconds!)}
            </span>
          </div>
        ) : error ? (
          <div className="mb-4 text-xs font-medium text-[var(--color-danger)] text-center px-3.5 py-2 rounded-lg bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 w-full animate-scale-in">
            {error}
          </div>
        ) : null}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              aria-label={`Digit ${num}`}
              disabled={loading || isLocked}
              onClick={() => handleDigit(num)}
              className="h-14 rounded-xl text-xl font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-subtle)] active:scale-95 transition-all duration-100 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
            >
              {num}
            </button>
          ))}

          {/* Clear button */}
          <button
            type="button"
            aria-label="Clear all digits"
            disabled={loading || pin.length === 0}
            onClick={() => {
              setPin("");
              setError(null);
            }}
            className="h-14 rounded-xl text-xs font-semibold text-[var(--color-text-tertiary)] bg-[var(--color-surface-sunken)]/50 hover:bg-[var(--color-surface-sunken)] active:scale-95 transition-all duration-100 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          >
            Clear
          </button>

          {/* 0 button */}
          <button
            type="button"
            aria-label="Digit 0"
            disabled={loading || isLocked}
            onClick={() => handleDigit("0")}
            className="h-14 rounded-xl text-xl font-semibold text-[var(--color-text-primary)] bg-[var(--color-surface-sunken)] hover:bg-[var(--color-primary-subtle)] active:scale-95 transition-all duration-100 flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            aria-label="Delete last digit"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-xl text-base font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-sunken)]/50 hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] active:scale-95 transition-all duration-100 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          >
            ⌫
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-primary)] font-medium">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Verifying PIN…</span>
          </div>
        )}
      </div>
    </div>
  );
}
