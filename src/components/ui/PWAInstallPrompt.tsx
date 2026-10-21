"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, X, Share, PlusSquare, Smartphone, Check } from "lucide-react";
import { Button } from "./Button";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

// BeforeInstallPromptEvent type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let pwaListenersBound = false;

function ensurePwaListeners() {
  if (pwaListenersBound || typeof window === "undefined") return;
  pwaListenersBound = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    ensurePwaListeners();
    // Detect standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice && !isStandalone);

    const updatePromptState = () => {
      setIsInstallable(Boolean(globalDeferredPrompt));
    };

    updatePromptState();
    listeners.add(updatePromptState);
    return () => {
      listeners.delete(updatePromptState);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "ios_manual"> => {
    if (isIOS) {
      return "ios_manual";
    }

    if (!globalDeferredPrompt) {
      return "dismissed";
    }

    try {
      await globalDeferredPrompt.prompt();
      const choice = await globalDeferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        globalDeferredPrompt = null;
        listeners.forEach((l) => l());
      }
      return choice.outcome;
    } catch {
      return "dismissed";
    }
  }, [isIOS]);

  return {
    isInstallable: isInstallable || isIOS,
    isInstalled,
    isIOS,
    promptInstall,
  };
}

/** Floating PWA Install Banner with iOS instructions modal */
export function PWAInstallBanner({ className }: { className?: string }) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if dismissed within the last 7 days
    try {
      const dismissedUntil = localStorage.getItem("wtt_pwa_dismissed_until");
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setDismissed(true);
        return;
      }
    } catch {
      // Ignore localStorage errors
    }
    setDismissed(false);
  }, []);

  if (dismissed || isInstalled || !isInstallable) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      // Dismiss for 7 days
      localStorage.setItem(
        "wtt_pwa_dismissed_until",
        String(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
    } catch {
      // Ignore
    }
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setDismissed(true);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="Install TaskTracker application"
        className={cn(
          "fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-[380px] z-50",
          "p-3.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-primary)]",
          "shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Logo size="sm" variant="badge" />

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-tight">
              Install TaskTracker App
            </h4>
            <p className="text-[11px] text-[var(--color-text-tertiary)] line-clamp-1">
              {isIOS
                ? "Add to your iPhone Home Screen"
                : "Fast one-tap launch from your home screen"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleInstallClick}
              className="text-xs py-1.5 px-3 h-8 shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari step-by-step instructions modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-primary)] p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Logo size="xs" variant="badge" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Install on iOS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Install <strong>TaskTracker</strong> on your iPhone or iPad for a full-screen, native app experience with zero browser bars:
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--color-surface-sunken)]">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center shrink-0 mt-0.5">
                  <Share className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    1. Tap Share
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Tap the Share icon at the bottom of Safari
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--color-surface-sunken)]">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    2. Add to Home Screen
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Scroll down and tap <strong>Add to Home Screen</strong>
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              className="w-full text-xs py-2"
              onClick={() => setShowIOSModal(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
