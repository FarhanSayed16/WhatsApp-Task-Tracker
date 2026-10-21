"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const defaultToastContext: ToastContextValue = {
  toast: {
    success: (msg: string) => console.log("[Toast success]:", msg),
    error: (msg: string) => console.error("[Toast error]:", msg),
    info: (msg: string) => console.log("[Toast info]:", msg),
  },
  removeToast: () => {},
};

export function useToast() {
  const context = useContext(ToastContext);
  return context || defaultToastContext;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 5000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    []
  );

  const toast = {
    success: (message: string, title?: string, duration?: number) =>
      addToast("success", message, title, duration),
    error: (message: string, title?: string, duration?: number) =>
      addToast("error", message, title, duration),
    info: (message: string, title?: string, duration?: number) =>
      addToast("info", message, title, duration),
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2 sm:p-0"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!item.duration || item.duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(item.id);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[var(--color-status-verified-fg)] shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0" />,
    info: <Info className="w-5 h-5 text-[var(--color-info)] shrink-0" />,
  }[item.type];

  const borderColor = {
    success: "border-l-[var(--color-status-verified-fg)]",
    error: "border-l-[var(--color-danger)]",
    info: "border-l-[var(--color-info)]",
  }[item.type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-4 rounded-[var(--radius-md)] glass-panel border-l-[3px] shadow-[var(--shadow-float)] transition-all animate-slide-up",
        borderColor
      )}
      role="alert"
    >
      <div className="pt-0.5">{icons}</div>
      <div className="flex-1 min-w-0">
        {item.title && (
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
            {item.title}
          </h4>
        )}
        <p className="text-xs text-[var(--color-text-secondary)] leading-snug break-words">
          {item.message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1 -mr-1 -mt-1 rounded transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
