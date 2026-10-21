import React from "react";
import { cn } from "@/lib/utils";

export interface LogoProps {
  /** Size preset for the logo icon */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether to show the text wordmark "TaskTracker" */
  showWordmark?: boolean;
  /** Optional subtitle below the wordmark (e.g. "Dispatch") */
  subtitle?: string;
  /** Visual variant: "mark" is just the speech-bubble, "badge" puts it inside an app-icon rounded surface */
  variant?: "mark" | "badge";
  className?: string;
}

export function Logo({
  size = "md",
  showWordmark = false,
  subtitle,
  variant = "mark",
  className,
}: LogoProps) {
  const gradientId = `logo-grad-${size}-${variant}`;
  const shadowId = `logo-shadow-${size}-${variant}`;

  // Dimension mappings
  const dimensions = {
    xs: { icon: 20, text: "text-xs", sub: "text-[9px]", gap: "gap-1.5" },
    sm: { icon: 24, text: "text-sm", sub: "text-[10px]", gap: "gap-2" },
    md: { icon: 32, text: "text-base", sub: "text-[11px]", gap: "gap-2.5" },
    lg: { icon: 44, text: "text-xl", sub: "text-xs", gap: "gap-3" },
    xl: { icon: 56, text: "text-2xl", sub: "text-sm", gap: "gap-3.5" },
  }[size];

  const iconSvg = (
    <svg
      width={dimensions.icon}
      height={dimensions.icon}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform group-hover:scale-105 duration-200"
      aria-hidden="true"
    >
      <defs>
        {/* Luminous emerald to WhatsApp-green gradient */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="60%" stopColor="#0D9E5F" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        {/* Soft subtle elevation shadow */}
        <filter id={shadowId} x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.18" floodColor="#064E3B" />
        </filter>
      </defs>

      {/* Modern Speech Bubble with smooth curves and sleek tail */}
      <path
        d="M30 14 H70 C79.941 14 88 22.059 88 32 V78 C88 81.2 84.4 83 81.8 81.2 L68 72 H30 C20.059 72 12 63.941 12 54 V32 C12 22.059 20.059 14 30 14 Z"
        fill={`url(#${gradientId})`}
        filter={`url(#${shadowId})`}
      />

      {/* Bold Crisp Golden-Ratio Task Checkmark */}
      <path
        d="M33 44 L45 56 L67 32"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className={cn("inline-flex items-center group select-none", dimensions.gap, className)}>
      {variant === "badge" ? (
        <div
          className={cn(
            "rounded-2xl flex items-center justify-center p-3 shadow-md transition-all duration-200",
            "bg-[var(--color-surface)] border border-[var(--color-border-primary)] group-hover:border-[var(--color-primary)]/40"
          )}
        >
          {iconSvg}
        </div>
      ) : (
        iconSvg
      )}

      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center">
            <span className={cn("font-bold tracking-tight text-[var(--color-text-primary)]", dimensions.text)}>
              Task<span className="text-[var(--color-primary)]">Tracker</span>
            </span>
          </div>
          {subtitle && (
            <span className={cn("font-medium text-[var(--color-text-tertiary)] -mt-0.5", dimensions.sub)}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default Logo;
