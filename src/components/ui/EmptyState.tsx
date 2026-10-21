import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  actionNode?: React.ReactNode;
  /** Optional workflow steps to display instead of a simple message */
  steps?: Array<{ icon: React.ReactNode; label: string; description: string }>;
  /** Compact mode — less padding, used when inline within a section */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  actionNode,
  steps,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-primary)] glass-card bg-[var(--color-surface-sunken)]",
        compact ? "p-6" : "p-8 sm:p-12",
        className
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center mb-4">
        {icon || <Inbox className="w-6 h-6" />}
      </div>

      {/* Title & Description */}
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-5 leading-relaxed">
        {description}
      </p>

      {/* Optional workflow steps — guided empty state */}
      {steps && steps.length > 0 && (
        <div className="w-full max-w-md space-y-3 mb-6 text-left">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-solid)]/70 border border-[var(--color-border-secondary)]"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary-text)] flex items-center justify-center shrink-0 text-sm">
                {step.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {step.label}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actionNode ? (
        actionNode
      ) : (actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} size="md">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button onClick={onSecondaryAction} variant="secondary" size="md">
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
