"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 select-none">
      <div className="w-full max-w-sm p-6 sm:p-8 rounded-3xl glass-panel shadow-2xl flex flex-col items-center">
        {/* Logo / Header */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl font-bold mb-4 shadow-inner">
          🔒
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Access</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6 text-center">
          Enter your 6-digit PIN to open your dashboard
        </p>

        {/* PIN Indicators */}
        <div
          role="status"
          aria-label={`${pin.length} of 6 digits entered`}
          className={`flex items-center justify-center gap-3.5 mb-6 ${
            error ? "animate-shake" : ""
          }`}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-emerald-600 scale-125 shadow-sm shadow-emerald-600/40"
                    : "border-2 border-slate-300 dark:border-slate-700 bg-transparent"
                }`}
              />
            );
          })}
        </div>

        {/* Lockout or Error Banner */}
        {lockoutSeconds !== null && lockoutSeconds > 0 ? (
          <div className="mb-4 text-xs font-medium text-amber-700 dark:text-amber-300 text-center px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 w-full flex flex-col gap-1 items-center animate-pulse">
            <span>Too many failed attempts.</span>
            <span className="font-bold text-sm">
              Retry available in: {formatCountdown(lockoutSeconds)}
            </span>
          </div>
        ) : error ? (
          <div className="mb-4 text-xs font-medium text-rose-500 text-center px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 w-full animate-scale-in">
            {error}
          </div>
        ) : null}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[270px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              aria-label={`Digit ${num}`}
              disabled={loading || (lockoutSeconds !== null && lockoutSeconds > 0)}
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl text-xl font-semibold text-slate-800 dark:text-slate-100 bg-white/70 dark:bg-slate-900/70 hover:bg-emerald-500/15 active:scale-95 transition-all duration-100 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
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
            className="h-14 rounded-2xl text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 active:scale-95 transition-all duration-100 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          >
            Clear
          </button>

          {/* 0 button */}
          <button
            type="button"
            aria-label="Digit 0"
            disabled={loading || (lockoutSeconds !== null && lockoutSeconds > 0)}
            onClick={() => handleDigit("0")}
            className="h-14 rounded-2xl text-xl font-semibold text-slate-800 dark:text-slate-100 bg-white/70 dark:bg-slate-900/70 hover:bg-emerald-500/15 active:scale-95 transition-all duration-100 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            aria-label="Delete last digit"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl text-base font-medium text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 hover:bg-rose-500/15 hover:text-rose-600 active:scale-95 transition-all duration-100 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
          >
            ⌫
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Verifying PIN...</span>
          </div>
        )}
      </div>
    </div>
  );
}
