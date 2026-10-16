import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  }[size];

  return (
    <div
      className={cn(
        "inline-block border-current border-t-transparent rounded-full animate-spin text-[var(--color-primary)]",
        sizeClasses,
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
