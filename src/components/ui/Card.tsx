import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive";
}

export function Card({
  className,
  variant = "default",
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: "shadow-sm shadow-slate-200/50 dark:shadow-none",
    interactive:
      "shadow-sm shadow-slate-200/50 dark:shadow-none hover:shadow-md hover:border-emerald-500/40 hover:-translate-y-0.5 cursor-pointer transition-all duration-200",
  }[variant];

  return (
    <div
      className={cn(
        "rounded-2xl glass-panel p-6 transition-all",
        variantStyles,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
