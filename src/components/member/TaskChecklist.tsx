"use client";

import React, { useState } from "react";
import { TaskItem, Completion, Member } from "@/types";
import { Check, ShieldCheck, Clock, User, AlertCircle, MessageSquare } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

export interface TaskChecklistProps {
  items: TaskItem[];
  completions: Completion[];
  members: Member[];
  currentMemberId: string | null;
  readOnly?: boolean;
  onToggleItem: (item: TaskItem, isCurrentlyDone: boolean) => Promise<void> | void;
  onAddNote?: (item: TaskItem) => void;
}

export function TaskChecklist({
  items,
  completions,
  members,
  currentMemberId,
  readOnly = false,
  onToggleItem,
  onAddNote,
}: TaskChecklistProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  const getCompletion = (itemId: string) => {
    return completions.find((c) => c.task_item_id === itemId);
  };

  const getMemberName = (memberId?: string | null) => {
    if (!memberId) return "Professor";
    const member = members.find((m) => m.id === memberId);
    return member ? member.name : "Member";
  };

  const handleToggle = async (item: TaskItem) => {
    if (readOnly || !currentMemberId || togglingId) return;

    const completion = getCompletion(item.id);
    const isDone = item.status === "done" || item.status === "verified" || !!completion;

    try {
      setTogglingId(item.id);
      await onToggleItem(item, isDone);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {sortedItems.map((item, index) => {
        const completion = getCompletion(item.id);
        const isDone =
          item.status === "done" || item.status === "verified" || !!completion;
        const isVerified = item.status === "verified";
        const isToggling = togglingId === item.id;
        const assignedMember = members.find(
          (m) => m.id === item.assigned_member_id
        );

        return (
          <div
            key={item.id}
            onClick={() => !readOnly && currentMemberId && handleToggle(item)}
            className={cn(
              "p-3.5 rounded-xl border transition-all duration-200 select-none",
              isDone
                ? "bg-[var(--color-surface-sunken)] border-[var(--color-border-secondary)]"
                : "bg-[var(--color-surface)] border-[var(--color-border-primary)] shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]/30",
              !readOnly && currentMemberId
                ? "cursor-pointer active:scale-[0.99]"
                : "cursor-default",
              isToggling && "opacity-60"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Custom Checkbox */}
              <button
                type="button"
                disabled={readOnly || !currentMemberId || isToggling}
                aria-label={`Mark task ${item.text}`}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                  isVerified
                    ? "bg-[var(--color-status-verified-fg)] text-white"
                    : isDone
                    ? "bg-[var(--color-status-done-fg)] text-white"
                    : "border-2 border-[var(--color-border-input)] hover:border-[var(--color-primary)] bg-transparent"
                )}
              >
                {isVerified ? (
                  <ShieldCheck className="w-4 h-4 animate-scale-in" />
                ) : isDone ? (
                  <Check className="w-4 h-4 animate-scale-in" />
                ) : null}
              </button>

              {/* Task Text & Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--color-text-disabled)] select-none">
                    #{index + 1}
                  </span>
                  <p
                    className={cn(
                      "text-sm font-medium transition-all leading-relaxed",
                      isDone
                        ? "line-through text-[var(--color-text-tertiary)]"
                        : "text-[var(--color-text-primary)]"
                    )}
                  >
                    {item.text}
                  </p>
                </div>

                {/* Badges / Metadata */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {assignedMember && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] font-medium text-[11px]">
                      <User className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                      Assigned: {assignedMember.name}
                    </span>
                  )}

                  {completion && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Completed by {getMemberName(completion.member_id)}{" "}
                      · {formatRelativeTime(completion.completed_at)}
                    </span>
                  )}

                  {isVerified && !completion && (
                    <span className="text-[11px] text-[var(--color-status-verified-fg)] font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verified by Professor
                    </span>
                  )}
                </div>

                {/* Optional note display */}
                {completion?.note && (
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)] italic bg-[var(--color-surface-sunken)] border border-[var(--color-border-secondary)] px-2.5 py-1.5 rounded-lg">
                    &ldquo;{completion.note}&rdquo;
                  </div>
                )}
              </div>

              {/* Note action button */}
              {onAddNote && !readOnly && currentMemberId && !isDone && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNote(item);
                  }}
                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors shrink-0"
                  title="Add completion note"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!currentMemberId && !readOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-fg)] text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Pick your name above to check off items.</span>
        </div>
      )}
    </div>
  );
}
