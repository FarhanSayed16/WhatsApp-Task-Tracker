"use client";

import React, { useState } from "react";
import { TaskItem, Completion, Member } from "@/types";
import { Check, ShieldCheck, Clock, User, AlertCircle } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

export interface TaskChecklistProps {
  items: TaskItem[];
  completions: Completion[];
  members: Member[];
  currentMemberId: string | null;
  readOnly?: boolean;
  onToggleItem: (item: TaskItem, isCurrentlyDone: boolean) => Promise<void> | void;
}

export function TaskChecklist({
  items,
  completions,
  members,
  currentMemberId,
  readOnly = false,
  onToggleItem,
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
    <div className="space-y-2.5">
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
              "p-4 rounded-2xl border transition-all duration-200 select-none",
              isDone
                ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/30",
              !readOnly && currentMemberId
                ? "cursor-pointer active:scale-[0.99]"
                : "cursor-default",
              isToggling && "opacity-60"
            )}
          >
            <div className="flex items-start gap-3.5">
              {/* Custom Checkbox */}
              <button
                type="button"
                disabled={readOnly || !currentMemberId || isToggling}
                aria-label={`Mark task ${item.text}`}
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                  isVerified
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                    : isDone
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 ring-2 ring-blue-500/20"
                    : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 bg-transparent"
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
                  <span className="text-xs font-bold text-slate-400 select-none">
                    #{index + 1}
                  </span>
                  <p
                    className={cn(
                      "text-sm font-medium transition-all leading-relaxed",
                      isDone
                        ? "line-through text-slate-400 dark:text-slate-500"
                        : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {item.text}
                  </p>
                </div>

                {/* Badges / Metadata */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {assignedMember && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                      <User className="w-3 h-3 text-slate-400" />
                      Assigned: {assignedMember.name}
                    </span>
                  )}

                  {completion && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Completed by {getMemberName(completion.member_id)}{" "}
                      · {formatRelativeTime(completion.completed_at)}
                    </span>
                  )}

                  {isVerified && !completion && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verified by Professor
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {!currentMemberId && !readOnly && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Pick your name above to check off items.</span>
        </div>
      )}
    </div>
  );
}
