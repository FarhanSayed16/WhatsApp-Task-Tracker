"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const node = modalRef.current;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const first = node?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    };
    // Defer so content is mounted
    requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay — lighter for friendlier feel */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel (Bottom sheet on mobile, centered card on desktop) */}
      <div
        ref={modalRef}
        className={cn(
          "relative w-full rounded-t-2xl sm:rounded-xl bg-[var(--color-surface-overlay)] border-t sm:border border-[var(--color-border-primary)] shadow-[var(--shadow-float)] overflow-hidden z-10 transition-all transform animate-slide-up sm:animate-scale-in my-0 sm:my-8 max-h-[92vh] flex flex-col",
          sizeClasses
        )}
      >
        {/* Mobile grab handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--color-border-input)] mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-3 sm:pt-5 pb-3 border-b border-[var(--color-border-secondary)] shrink-0">
            <div className="min-w-0 space-y-1">
              {title && (
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-[var(--color-border-secondary)] bg-[var(--color-surface-sunken)]/80 backdrop-blur-xs shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
