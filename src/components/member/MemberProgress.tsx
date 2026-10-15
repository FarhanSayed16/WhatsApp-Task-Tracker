"use client";

import React, { useEffect, useRef } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import confetti from "canvas-confetti";
import { CheckCircle2, Sparkles } from "lucide-react";

export interface MemberProgressProps {
  completedCount: number;
  totalCount: number;
  className?: string;
}

export function MemberProgress({
  completedCount,
  totalCount,
  className,
}: MemberProgressProps) {
  const percentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllComplete = totalCount > 0 && completedCount === totalCount;
  const prevCompleteRef = useRef(false);

  useEffect(() => {
    // Fire confetti once when transition to 100% occurs
    if (isAllComplete && !prevCompleteRef.current) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"],
      });
    }
    prevCompleteRef.current = isAllComplete;
  }, [isAllComplete]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isAllComplete ? (
            <Sparkles className="w-4 h-4 text-emerald-500 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {isAllComplete ? "All Tasks Completed!" : "List Progress"}
          </span>
        </div>
        <div className="text-xs font-bold text-slate-900 dark:text-white">
          <span>
            {completedCount} of {totalCount} completed ({percentage}%)
          </span>
        </div>
      </div>

      <ProgressBar value={percentage} size="md" animateColor={true} />

      {isAllComplete && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 text-center animate-slide-up">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            🎉 Great work! All tasks have been completed.
          </p>
        </div>
      )}
    </div>
  );
}
