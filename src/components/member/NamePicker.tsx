"use client";

import React, { useEffect, useState } from "react";
import { Member } from "@/types";
import { User, Check, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NamePickerProps {
  members: Member[];
  selectedMemberId: string | null;
  onSelectMember: (member: Member | null) => void;
  disabled?: boolean;
}

export function NamePicker({
  members,
  selectedMemberId,
  onSelectMember,
  disabled = false,
}: NamePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Restore member choice from localStorage on initial load
  useEffect(() => {
    if (hasInitialized) return;

    try {
      const storedMemberId = localStorage.getItem("wtt_member_id");
      if (storedMemberId) {
        const found = members.find((m) => m.id === storedMemberId && m.active);
        if (found) {
          onSelectMember(found);
        }
      }
    } catch {
      // localStorage may not be available or blocked
    } finally {
      setHasInitialized(true);
    }
  }, [members, onSelectMember, hasInitialized]);

  const currentMember = members.find((m) => m.id === selectedMemberId);

  const handleSelect = (member: Member) => {
    try {
      localStorage.setItem("wtt_member_id", member.id);
      localStorage.setItem("wtt_member_name", member.name);
    } catch {
      // Ignore
    }
    onSelectMember(member);
    setIsOpen(false);
  };

  const handleClear = () => {
    try {
      localStorage.removeItem("wtt_member_id");
      localStorage.removeItem("wtt_member_name");
    } catch {
      // Ignore
    }
    onSelectMember(null);
    setIsOpen(true);
  };

  return (
    <div className="w-full">
      {currentMember ? (
        // Selected state: compact greeting pill with change button
        <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-sm shadow-emerald-600/30">
              {currentMember.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                Checking off as
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentMember.name}
              </p>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-emerald-500/10 transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change
            </button>
          )}
        </div>
      ) : (
        // Unselected state: Friendly prompt with chips or dropdown
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Who are you?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick your name once to tick off tasks.
              </p>
            </div>
          </div>

          {/* Member chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white text-slate-700 dark:text-slate-300 transition-all active:scale-95 shadow-sm"
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
