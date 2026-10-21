import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "whatsapp";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none tracking-tight";

    const variantStyles = {
      primary:
        "bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)] shadow-sm focus-visible:ring-[var(--color-primary)]",
      secondary:
        "glass-chrome text-[var(--color-text-primary)] border border-[var(--color-border-primary)] hover:bg-[var(--color-surface-raised)] focus-visible:ring-[var(--color-border-focus)]",
      danger:
        "bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] border border-transparent hover:border-[var(--color-danger)]/20 focus-visible:ring-[var(--color-danger)]",
      ghost:
        "bg-transparent hover:bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] focus-visible:ring-[var(--color-border-focus)]",
      outline:
        "border border-[var(--color-border-primary)] bg-transparent hover:bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] focus-visible:ring-[var(--color-border-focus)]",
      whatsapp:
        "bg-[var(--color-whatsapp)] text-white hover:bg-[var(--color-whatsapp-hover)] shadow-sm focus-visible:ring-[var(--color-whatsapp)]",
    }[variant];

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs gap-1.5 h-8",
      md: "px-4 py-2 text-sm gap-2 h-9",
      lg: "px-5 py-2.5 text-sm gap-2 h-11",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles, sizeStyles, className)}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
